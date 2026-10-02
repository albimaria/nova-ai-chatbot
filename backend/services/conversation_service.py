from datetime import datetime

from sqlalchemy.orm import Session

from database.models import Conversation
from database.models import Message
from database.models import MessageAttachment


def create_conversation(
    db: Session,
    conversation_id: str,
    title: str,
):
    conversation = Conversation(
        id=conversation_id,
        title=title,
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation


def save_message(
    db: Session,
    message_id: str,
    conversation_id: str,
    role: str,
    content: str,
    model: str = None,
):
    message = Message(
        id=message_id,
        conversation_id=conversation_id,
        role=role,
        content=content,
        model=model,
    )

    db.add(message)

    db.commit()
    db.refresh(message)

    return message


# ============================================================
# SAVE MESSAGE ATTACHMENTS
# ============================================================

def save_message_attachments(
    db: Session,
    message_id: str,
    attachments=None,
):
    if not attachments:
        return []

    saved_attachments = []

    for attachment in attachments:

        # Pydantic FileAttachment
        name = getattr(
            attachment,
            "name",
            None,
        )

        display_name = getattr(
            attachment,
            "displayName",
            None,
        )

        mime_type = getattr(
            attachment,
            "mimeType",
            None,
        )

        uri = getattr(
            attachment,
            "uri",
            None,
        )

        file_size = getattr(
            attachment,
            "fileSize",
            None,
        )

        # Safety check
        if not name or not uri:
            continue

        attachment_id = (
            f"attachment-"
            f"{int(datetime.now().timestamp() * 1000)}-"
            f"{len(saved_attachments)}"
        )

        saved_attachment = MessageAttachment(
            id=attachment_id,
            message_id=message_id,
            name=name,
            display_name=(
                display_name
                or name
            ),
            mime_type=(
                mime_type
                or "application/octet-stream"
            ),
            uri=uri,
            file_size=file_size,
        )

        db.add(
            saved_attachment
        )

        saved_attachments.append(
            saved_attachment
        )

    db.commit()

    for attachment in saved_attachments:
        db.refresh(attachment)

    return saved_attachments


# ============================================================
# GET MESSAGE
# ============================================================

def get_message(
    db: Session,
    message_id: str,
):
    return (
        db.query(Message)
        .filter(
            Message.id ==
            message_id
        )
        .first()
    )


# ============================================================
# GET MESSAGE ATTACHMENTS
# ============================================================

def get_message_attachments(
    db: Session,
    message_id: str,
):
    return (
        db.query(
            MessageAttachment
        )
        .filter(
            MessageAttachment.message_id
            ==
            message_id
        )
        .order_by(
            MessageAttachment.created_at.asc()
        )
        .all()
    )


# ============================================================
# GET CONVERSATION MESSAGES
# ============================================================

def get_conversation_messages(
    db: Session,
    conversation_id: str,
):
    return (
        db.query(Message)
        .filter(
            Message.conversation_id ==
            conversation_id
        )
        .order_by(
            Message.created_at.asc()
        )
        .all()
    )


# ============================================================
# UPDATE MESSAGE
# ============================================================

def update_message(
    db: Session,
    message_id: str,
    content: str,
):
    message = get_message(
        db,
        message_id,
    )

    if not message:
        return None

    message.content = content

    db.commit()
    db.refresh(message)

    return message


# ============================================================
# DELETE MESSAGE
# ============================================================

def delete_message(
    db: Session,
    message_id: str,
):
    message = get_message(
        db,
        message_id,
    )

    if not message:
        return None

    # Delete attachments belonging
    # to this message first.

    db.query(
        MessageAttachment
    ).filter(
        MessageAttachment.message_id
        ==
        message_id
    ).delete(
        synchronize_session=False
    )

    db.delete(message)

    db.commit()

    return message


# ============================================================
# UPDATE CONVERSATION TIMESTAMP
# ============================================================

def update_conversation_timestamp(
    db: Session,
    conversation_id: str,
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id ==
            conversation_id
        )
        .first()
    )

    if conversation:
        conversation.updated_at = (
            datetime.utcnow()
        )

        db.commit()

    return conversation