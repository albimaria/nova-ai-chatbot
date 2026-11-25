from typing import Literal

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pydantic import Field
from sqlalchemy.orm import Session

from auth import daily_limit
from auth import get_current_user
from config.settings import settings
from database.connection import get_db
from database.models import User
from providers.gemini_provider import DEFAULT_NOVA_MODEL
from providers.gemini_provider import NOVA_MODELS
from rate_limit import limiter
from services import chat_service
from services import usage_service


router = APIRouter(prefix="/api/v1/chat", tags=["Chat"])

MAX_MESSAGE_CHARS = 32000
MAX_ATTACHMENTS = 10


class FileAttachment(BaseModel):
    name: str = Field(max_length=200)
    displayName: str = Field(default="", max_length=300)
    mimeType: str = Field(default="", max_length=200)
    uri: str = Field(max_length=2000)
    fileSize: int | None = None


class GenerationOptions(BaseModel):
    model: str = DEFAULT_NOVA_MODEL
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    web_search: bool = False


class SendMessageRequest(GenerationOptions):
    message: str = Field(default="", max_length=MAX_MESSAGE_CHARS)
    conversation_id: str | None = None
    attachments: list[FileAttachment] = Field(default_factory=list, max_length=MAX_ATTACHMENTS)


class EditMessageRequest(GenerationOptions):
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)


class RegenerateRequest(GenerationOptions):
    pass


class FeedbackRequest(BaseModel):
    feedback: Literal["up", "down"] | None = None


def _check_limits(db: Session, user: User) -> None:
    # Daily limit is counted from the database so it survives server restarts.
    limit = daily_limit(user)

    if usage_service.user_messages_last_24h(db, user.id) >= limit > 0:
        raise HTTPException(
            status_code=429,
            detail="You've reached today's message limit. Please come back tomorrow.",
        )

    limiter.check(f"chat-min:{user.id}", settings.RATE_LIMIT_PER_MINUTE, 60)


def _validate_model(model: str) -> str:
    if model not in NOVA_MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown model: {model}")
    return model


def _stream(user: User, conversation_id: str, user_message_id: str, options: GenerationOptions):
    return StreamingResponse(
        chat_service.stream_reply(
            user_id=user.id,
            conversation_id=conversation_id,
            user_message_id=user_message_id,
            model=options.model,
            temperature=options.temperature,
            web_search=options.web_search,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/models")
def list_models():
    return {
        "default": DEFAULT_NOVA_MODEL,
        "webSearch": settings.WEB_SEARCH_ENABLED,
        "models": [
            {"id": "Nova Fast", "description": "Quickest answers for everyday questions"},
            {"id": "Nova Standard", "description": "Balanced speed and quality"},
            {"id": "Nova Reasoning", "description": "Deeper thinking for hard problems"},
        ],
    }


@router.post("/stream")
def send_message(
    body: SendMessageRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _validate_model(body.model)

    if not body.message.strip() and not body.attachments:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    _check_limits(db, user)

    if body.conversation_id:
        conversation = chat_service.get_owned_conversation(db, body.conversation_id, user)
    else:
        conversation = chat_service.create_conversation(db, user)

    message = chat_service.add_user_message(
        db, conversation, body.message, body.model, body.attachments
    )
    db.commit()

    return _stream(user, conversation.id, message.id, body)


@router.post("/messages/{message_id}/edit")
def edit_message(
    message_id: str,
    body: EditMessageRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _validate_model(body.model)
    message = chat_service.get_owned_message(db, message_id, user)

    if message.role != "user":
        raise HTTPException(status_code=400, detail="Only your own messages can be edited.")

    _check_limits(db, user)

    conversation = message.conversation
    message.content = body.content
    message.model = body.model
    chat_service.delete_messages_after(db, conversation, message)
    db.commit()

    return _stream(user, conversation.id, message.id, body)


@router.post("/messages/{message_id}/regenerate")
def regenerate(
    message_id: str,
    body: RegenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Accepts either the assistant reply to replace or the user message before it."""

    _validate_model(body.model)
    message = chat_service.get_owned_message(db, message_id, user)
    conversation = message.conversation

    if message.role == "assistant":
        messages = list(conversation.messages)
        index = next(i for i, m in enumerate(messages) if m.id == message.id)
        previous_users = [m for m in messages[:index] if m.role == "user"]

        if not previous_users:
            raise HTTPException(status_code=400, detail="Nothing to regenerate.")

        message = previous_users[-1]

    _check_limits(db, user)

    chat_service.delete_messages_after(db, conversation, message)
    db.commit()

    return _stream(user, conversation.id, message.id, body)


@router.put("/messages/{message_id}/feedback")
def set_feedback(
    message_id: str,
    body: FeedbackRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    message = chat_service.get_owned_message(db, message_id, user)

    if message.role != "assistant":
        raise HTTPException(status_code=400, detail="Feedback is only for Nova's replies.")

    message.feedback = body.feedback
    db.commit()
    return {"id": message.id, "feedback": message.feedback}
