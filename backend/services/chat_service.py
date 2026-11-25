"""Conversation flow: save messages, build model context, stream and persist replies."""

import json
import logging
import time
from typing import Iterator
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from config.settings import settings
from database.connection import SessionLocal
from database.models import Conversation
from database.models import Message
from database.models import MessageAttachment
from database.models import User
from database.models import utcnow
from providers import gemini_provider as provider
from providers.gemini_provider import Turn
from serializers import attachment_is_expired
from services import usage_service


logger = logging.getLogger("nova.chat")

DEFAULT_TITLE = "New chat"


def new_id() -> str:
    return str(uuid4())


# ------------------------------------------------------------
# Lookups
# ------------------------------------------------------------

def get_owned_conversation(db: Session, conversation_id: str, user: User) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user.id)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    return conversation


def get_owned_message(db: Session, message_id: str, user: User) -> Message:
    message = (
        db.query(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(Message.id == message_id, Conversation.user_id == user.id)
        .first()
    )

    if not message:
        raise HTTPException(status_code=404, detail="Message not found.")

    return message


# ------------------------------------------------------------
# Writes
# ------------------------------------------------------------

def create_conversation(db: Session, user: User, title: str = DEFAULT_TITLE) -> Conversation:
    conversation = Conversation(id=new_id(), user_id=user.id, title=title)
    db.add(conversation)
    db.flush()
    return conversation


def add_user_message(db: Session, conversation: Conversation, content: str, model: str, attachments) -> Message:
    message = Message(
        id=new_id(),
        conversation_id=conversation.id,
        role="user",
        content=content,
        model=model,
    )

    for attachment in attachments or []:
        message.attachments.append(
            MessageAttachment(
                id=new_id(),
                name=attachment.name,
                display_name=attachment.displayName or attachment.name,
                mime_type=attachment.mimeType or "application/octet-stream",
                uri=attachment.uri,
                file_size=attachment.fileSize,
            )
        )

    db.add(message)
    conversation.updated_at = utcnow()
    db.flush()
    return message


def delete_messages_after(db: Session, conversation: Conversation, message: Message) -> None:
    """Remove everything that came after `message` (used by edit and regenerate)."""

    messages = list(conversation.messages)

    try:
        index = next(i for i, m in enumerate(messages) if m.id == message.id)
    except StopIteration:
        return

    for later in messages[index + 1:]:
        db.delete(later)

    db.flush()


# ------------------------------------------------------------
# Context
# ------------------------------------------------------------

def build_turns(conversation: Conversation, upto: Message) -> list[Turn]:
    """Messages up to and including `upto`, trimmed to the history budget."""

    messages: list[Message] = []

    for message in conversation.messages:
        messages.append(message)

        if message.id == upto.id:
            break

    messages = messages[-settings.HISTORY_MAX_MESSAGES:]

    turns: list[Turn] = []
    total_chars = 0

    for message in reversed(messages):
        total_chars += len(message.content or "")

        if turns and total_chars > settings.HISTORY_MAX_CHARS:
            break

        files = [
            (a.uri, a.mime_type)
            for a in message.attachments
            if message.role == "user" and not attachment_is_expired(a)
        ]

        turns.append(Turn(message.role, message.content or "", files))

    turns.reverse()

    # The model must see a user turn first.
    while turns and turns[0].role != "user":
        turns.pop(0)

    return turns


# ------------------------------------------------------------
# Streaming
# ------------------------------------------------------------

def sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def fallback_title(text: str) -> str:
    words = " ".join(text.split()).split(" ")
    title = " ".join(words[:6]).strip()

    if len(words) > 6:
        title += "…"

    return title[:80] or DEFAULT_TITLE


def stream_reply(
    *,
    user_id: str,
    conversation_id: str,
    user_message_id: str,
    model: str,
    temperature: float | None,
    web_search: bool,
) -> Iterator[str]:
    """SSE generator. Uses its own DB session because it outlives the request."""

    db = SessionLocal()
    assistant_id = new_id()
    content = ""
    sources: list[dict] = []
    saved = False
    meta: dict = {}
    started = time.monotonic()
    recorded = False

    def record(status: str) -> None:
        nonlocal recorded

        if recorded:
            return

        recorded = True
        usage_service.record(
            db,
            user_id=user_id,
            conversation_id=conversation_id,
            kind="chat",
            nova_model=model,
            meta=meta,
            status=status,
            latency_ms=int((time.monotonic() - started) * 1000),
        )

    def save(final_content: str) -> Message | None:
        nonlocal saved

        if saved or not final_content.strip():
            return None

        saved = True
        reply = Message(
            id=assistant_id,
            conversation_id=conversation_id,
            role="assistant",
            content=final_content,
            model=model,
            sources=json.dumps(sources) if sources else None,
        )
        db.add(reply)

        conversation = db.get(Conversation, conversation_id)

        if conversation:
            conversation.updated_at = utcnow()

        db.commit()
        return reply

    try:
        user = db.get(User, user_id)
        conversation = db.get(Conversation, conversation_id)
        user_message = db.get(Message, user_message_id)

        yield sse(
            "start",
            {
                "conversationId": conversation_id,
                "userMessageId": user_message_id,
                "assistantMessageId": assistant_id,
                "model": model,
            },
        )

        turns = build_turns(conversation, user_message)
        system_prompt = provider.build_system_prompt(
            user.name if user else None,
            user.custom_instructions if user else None,
        )

        for event in provider.stream_reply(
            turns,
            nova_model=model,
            system_prompt=system_prompt,
            temperature=temperature,
            web_search=web_search and settings.WEB_SEARCH_ENABLED,
            meta=meta,
        ):
            if event.kind == "text":
                content += event.value
                yield sse("delta", {"text": event.value})

            elif event.kind == "notice":
                yield sse("notice", {"message": event.value})

            elif event.kind == "sources":
                sources = event.value
                yield sse("sources", {"sources": sources})

        if not content.strip():
            content = "_Nova didn't return any text for this request. Try rephrasing it._"

        save(content)
        record("ok")

        title = None

        if conversation and conversation.title == DEFAULT_TITLE:
            title_meta: dict = {}
            title_started = time.monotonic()
            title = provider.generate_title(
                user_message.content, content, meta=title_meta
            ) or fallback_title(user_message.content or "Attachment")
            conversation.title = title
            db.commit()
            usage_service.record(
                db,
                user_id=user_id,
                conversation_id=conversation_id,
                kind="title",
                nova_model=None,
                meta=title_meta,
                status="error" if title_meta.get("error_code") is not None else "ok",
                latency_ms=int((time.monotonic() - title_started) * 1000),
            )

        yield sse(
            "done",
            {
                "conversationId": conversation_id,
                "assistantMessageId": assistant_id,
                "title": title,
            },
        )

    except GeneratorExit:
        # The client pressed Stop or disconnected: keep what we have.
        save(content)
        record("stopped")
        raise

    except Exception as error:
        logger.exception("Streaming failed")
        db.rollback()
        save(content)
        code = getattr(error, "code", None)
        meta.setdefault("error_code", code if isinstance(code, int) else 0)
        record("rate_limited" if meta.get("error_code") == 429 else "error")
        yield sse("error", {"message": provider.friendly_error(error)})

    finally:
        db.close()
