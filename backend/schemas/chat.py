from typing import List

from pydantic import BaseModel
from pydantic import Field


class ChatMessage(BaseModel):
    role: str

    content: str


class FileAttachment(BaseModel):
    name: str

    displayName: str

    mimeType: str

    uri: str

    fileSize: int | None = None


class ChatRequest(BaseModel):
    message: str = ""

    model: str = "Nova Standard"

    history: List[ChatMessage] = Field(
        default_factory=list
    )

    conversation_id: str | None = None

    conversation_title: str = "New conversation"

    message_id: str | None = None

    attachments: List[FileAttachment] = Field(
        default_factory=list
    )


class EditMessageRequest(BaseModel):
    message_id: str

    content: str

    model: str = "Nova Standard"

    history: List[ChatMessage] = Field(
        default_factory=list
    )

    attachments: List[FileAttachment] = Field(
        default_factory=list
    )


class RegenerateMessageRequest(BaseModel):
    message_id: str

    model: str = "Nova Standard"

    history: List[ChatMessage] = Field(
        default_factory=list
    )

    attachments: List[FileAttachment] = Field(
        default_factory=list
    )


class ChatResponse(BaseModel):
    id: str

    role: str

    content: str

    model: str

    conversation_id: str