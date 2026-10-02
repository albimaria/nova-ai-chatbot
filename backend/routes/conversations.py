from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from pydantic import BaseModel

from sqlalchemy.orm import Session

from auth import get_current_user

from database.connection import get_db
from database.models import Conversation
from database.models import Message
from database.models import MessageAttachment
from database.models import User

from services.conversation_service import (
    get_message_attachments,
)


router = APIRouter(
    prefix="/api/v1/conversations",
    tags=["Conversations"],
)


class RenameConversationRequest(
    BaseModel
):
    title: str


# ============================================================
# GET ALL CONVERSATIONS
# ============================================================

@router.get("")
async def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.user_id ==
            current_user.id
        )
        .order_by(
            Conversation.updated_at.desc()
        )
        .all()
    )

    return [
        {
            "id":
                conversation.id,

            "title":
                conversation.title,

            "createdAt": (
                conversation.created_at.isoformat()
                if conversation.created_at
                else None
            ),

            "updatedAt": (
                conversation.updated_at.isoformat()
                if conversation.updated_at
                else None
            ),
        }
        for conversation in conversations
    ]


# ============================================================
# GET ONE CONVERSATION
# ============================================================

@router.get(
    "/{conversation_id}"
)
async def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id ==
            conversation_id,
            Conversation.user_id ==
            current_user.id,
        )
        .first()
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    messages = (
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

    conversation_messages = []

    for message in messages:

        attachments = (
            get_message_attachments(
                db=db,
                message_id=message.id,
            )
        )

        conversation_messages.append(
            {
                "id":
                    message.id,

                "role":
                    message.role,

                "content":
                    message.content,

                "model":
                    message.model,

                "createdAt": (
                    message.created_at.isoformat()
                    if message.created_at
                    else None
                ),

                "attachments": [
                    {
                        "id":
                            attachment.id,

                        "name":
                            attachment.name,

                        "displayName":
                            attachment.display_name,

                        "mimeType":
                            attachment.mime_type,

                        "uri":
                            attachment.uri,

                        "fileSize":
                            attachment.file_size,

                        "createdAt": (
                            attachment.created_at.isoformat()
                            if attachment.created_at
                            else None
                        ),
                    }
                    for attachment
                    in attachments
                ],
            }
        )

    return {
        "id":
            conversation.id,

        "title":
            conversation.title,

        "createdAt": (
            conversation.created_at.isoformat()
            if conversation.created_at
            else None
        ),

        "updatedAt": (
            conversation.updated_at.isoformat()
            if conversation.updated_at
            else None
        ),

        "messages":
            conversation_messages,
    }


# ============================================================
# RENAME CONVERSATION
# ============================================================

@router.put(
    "/{conversation_id}"
)
async def rename_conversation(
    conversation_id: str,
    request: RenameConversationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id ==
            conversation_id,
            Conversation.user_id ==
            current_user.id,
        )
        .first()
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    title = request.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Conversation title cannot be empty",
        )

    conversation.title = title

    db.commit()

    db.refresh(
        conversation
    )

    return {
        "id":
            conversation.id,

        "title":
            conversation.title,

        "createdAt": (
            conversation.created_at.isoformat()
            if conversation.created_at
            else None
        ),

        "updatedAt": (
            conversation.updated_at.isoformat()
            if conversation.updated_at
            else None
        ),
    }


# ============================================================
# DELETE CONVERSATION
# ============================================================

@router.delete(
    "/{conversation_id}"
)
async def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id ==
            conversation_id,
            Conversation.user_id ==
            current_user.id,
        )
        .first()
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    message_ids = [
        message.id
        for message in (
            db.query(Message)
            .filter(
                Message.conversation_id ==
                conversation_id
            )
            .all()
        )
    ]

    if message_ids:
        db.query(
            MessageAttachment
        ).filter(
            MessageAttachment.message_id.in_(
                message_ids
            )
        ).delete(
            synchronize_session=False
        )

    db.query(Message).filter(
        Message.conversation_id ==
        conversation_id
    ).delete(
        synchronize_session=False
    )

    db.delete(
        conversation
    )

    db.commit()

    return {
        "message":
            "Conversation deleted",

        "conversation_id":
            conversation_id,
    }