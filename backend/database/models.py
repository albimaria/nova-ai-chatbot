from datetime import datetime
from datetime import timezone

from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import false
from sqlalchemy.orm import relationship

from database.connection import Base


def utcnow():
    # Stored as naive UTC for compatibility with existing SQLite rows.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=True)
    custom_instructions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    conversations = relationship(
        "Conversation",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String, nullable=False)
    pinned = Column(Boolean, nullable=False, default=False, server_default=false())
    share_token = Column(String, nullable=True, unique=True, index=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="conversations")

    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, index=True)
    conversation_id = Column(
        String, ForeignKey("conversations.id"), nullable=False, index=True
    )
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    model = Column(String, nullable=True)
    # "up", "down" or NULL
    feedback = Column(String, nullable=True)
    # JSON list of {"url", "title"} when web search was used
    sources = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    conversation = relationship("Conversation", back_populates="messages")

    attachments = relationship(
        "MessageAttachment",
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="MessageAttachment.created_at",
    )


class MessageAttachment(Base):
    __tablename__ = "message_attachments"

    id = Column(String, primary_key=True, index=True)
    message_id = Column(String, ForeignKey("messages.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    uri = Column(Text, nullable=False)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    message = relationship("Message", back_populates="attachments")


class UsageEvent(Base):
    """One call to the AI provider, with the token counts Gemini reports back."""

    __tablename__ = "usage_events"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    conversation_id = Column(String, nullable=True)
    # "chat" | "title" | "upload"
    kind = Column(String, nullable=False, default="chat")
    nova_model = Column(String, nullable=True)
    gemini_model = Column(String, nullable=True, index=True)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    thinking_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    attempts = Column(Integer, nullable=False, default=1)
    latency_ms = Column(Integer, nullable=True)
    first_token_ms = Column(Integer, nullable=True)
    # "ok" | "error" | "stopped" | "rate_limited"
    status = Column(String, nullable=False, default="ok")
    error_code = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)
