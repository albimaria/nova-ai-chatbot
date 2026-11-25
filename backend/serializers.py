"""Convert database rows to the JSON shapes the frontend expects."""

import json

from datetime import datetime
from datetime import timedelta

from config.settings import settings
from database.models import Conversation
from database.models import Message
from database.models import MessageAttachment
from database.models import utcnow


def iso(value: datetime | None) -> str | None:
    # Stored values are naive UTC; mark them so browsers convert correctly.
    return value.isoformat() + "Z" if value else None


def attachment_is_expired(attachment: MessageAttachment) -> bool:
    if not attachment.created_at:
        return True

    return utcnow() - attachment.created_at > timedelta(hours=settings.FILE_TTL_HOURS)


def attachment_dict(attachment: MessageAttachment) -> dict:
    return {
        "id": attachment.id,
        "name": attachment.name,
        "displayName": attachment.display_name,
        "mimeType": attachment.mime_type,
        "uri": attachment.uri,
        "fileSize": attachment.file_size,
        "createdAt": iso(attachment.created_at),
        "expired": attachment_is_expired(attachment),
    }


def message_dict(message: Message, include_feedback: bool = True) -> dict:
    data = {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "model": message.model,
        "createdAt": iso(message.created_at),
        "attachments": [attachment_dict(a) for a in message.attachments],
        "sources": json.loads(message.sources) if message.sources else [],
    }

    if include_feedback:
        data["feedback"] = message.feedback

    return data


def conversation_summary(conversation: Conversation) -> dict:
    return {
        "id": conversation.id,
        "title": conversation.title,
        "pinned": bool(conversation.pinned),
        "shared": bool(conversation.share_token),
        "createdAt": iso(conversation.created_at),
        "updatedAt": iso(conversation.updated_at),
    }


def conversation_detail(conversation: Conversation) -> dict:
    return {
        **conversation_summary(conversation),
        "shareToken": conversation.share_token,
        "messages": [message_dict(m) for m in conversation.messages],
    }
