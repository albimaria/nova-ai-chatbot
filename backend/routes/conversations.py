import secrets

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from pydantic import BaseModel
from pydantic import Field
from sqlalchemy.orm import Session

from auth import get_current_user
from database.connection import get_db
from database.models import Conversation
from database.models import User
from serializers import conversation_detail
from serializers import conversation_summary
from serializers import iso
from serializers import message_dict
from services.chat_service import get_owned_conversation


router = APIRouter(prefix="/api/v1/conversations", tags=["Conversations"])

shared_router = APIRouter(prefix="/api/v1/shared", tags=["Sharing"])


class UpdateConversationRequest(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    pinned: bool | None = None


@router.get("")
def list_conversations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id)
        .order_by(Conversation.pinned.desc(), Conversation.updated_at.desc())
        .all()
    )

    return [conversation_summary(c) for c in conversations]


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return conversation_detail(get_owned_conversation(db, conversation_id, user))


def _update(conversation_id: str, body: UpdateConversationRequest, db: Session, user: User):
    conversation = get_owned_conversation(db, conversation_id, user)

    if body.title is not None:
        title = body.title.strip()

        if not title:
            raise HTTPException(status_code=400, detail="Title cannot be empty.")

        conversation.title = title

    if body.pinned is not None:
        conversation.pinned = body.pinned

    # Renaming or pinning should not move the chat to the top of "recent".
    updated_at = conversation.updated_at
    db.flush()
    conversation.updated_at = updated_at
    db.commit()
    db.refresh(conversation)
    return conversation_summary(conversation)


@router.patch("/{conversation_id}")
def update_conversation(
    conversation_id: str,
    body: UpdateConversationRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _update(conversation_id, body, db, user)


# Kept for older frontends that rename with PUT.
@router.put("/{conversation_id}", include_in_schema=False)
def rename_conversation(
    conversation_id: str,
    body: UpdateConversationRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _update(conversation_id, body, db, user)


@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversation = get_owned_conversation(db, conversation_id, user)
    db.delete(conversation)
    db.commit()
    return {"message": "Conversation deleted", "conversation_id": conversation_id}


@router.delete("")
def delete_all_conversations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversations = db.query(Conversation).filter(Conversation.user_id == user.id).all()

    for conversation in conversations:
        db.delete(conversation)

    db.commit()
    return {"deleted": len(conversations)}


@router.post("/{conversation_id}/share")
def share_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversation = get_owned_conversation(db, conversation_id, user)

    if not conversation.share_token:
        conversation.share_token = secrets.token_urlsafe(16)
        db.commit()

    return {"shareToken": conversation.share_token}


@router.delete("/{conversation_id}/share")
def unshare_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversation = get_owned_conversation(db, conversation_id, user)
    conversation.share_token = None
    db.commit()
    return {"shareToken": None}


@shared_router.get("/{share_token}")
def get_shared_conversation(share_token: str, db: Session = Depends(get_db)):
    conversation = (
        db.query(Conversation).filter(Conversation.share_token == share_token).first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="This shared chat no longer exists.")

    return {
        "title": conversation.title,
        "createdAt": iso(conversation.created_at),
        "messages": [
            {
                **message_dict(m, include_feedback=False),
                # Don't expose file URIs publicly.
                "attachments": [
                    {"displayName": a.display_name, "mimeType": a.mime_type}
                    for a in m.attachments
                ],
            }
            for m in conversation.messages
        ],
    }
