from datetime import datetime

from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy.orm import relationship

from database.connection import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    email = Column(
        String,
        unique=True,
        nullable=False,
        index=True,
    )

    password_hash = Column(
        String,
        nullable=False,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    conversations = relationship(
        "Conversation",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        String,
        ForeignKey(
            "users.id"
        ),
        nullable=True,
        index=True,
    )

    title = Column(
        String,
        nullable=False,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    user = relationship(
        "User",
        back_populates="conversations",
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    conversation_id = Column(
        String,
        ForeignKey(
            "conversations.id"
        ),
        nullable=False,
        index=True,
    )

    role = Column(
        String,
        nullable=False,
    )

    content = Column(
        Text,
        nullable=False,
    )

    model = Column(
        String,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )


class MessageAttachment(Base):
    __tablename__ = "message_attachments"

    id = Column(
        String,
        primary_key=True,
        index=True,
    )

    message_id = Column(
        String,
        ForeignKey(
            "messages.id"
        ),
        nullable=False,
        index=True,
    )

    name = Column(
        String,
        nullable=False,
    )

    display_name = Column(
        String,
        nullable=False,
    )

    mime_type = Column(
        String,
        nullable=False,
    )

    uri = Column(
        Text,
        nullable=False,
    )

    file_size = Column(
        Integer,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )