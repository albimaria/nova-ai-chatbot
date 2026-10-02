from datetime import datetime

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from pydantic import BaseModel
from pydantic import Field

from sqlalchemy.orm import Session

from auth import get_current_user

from database.connection import get_db
from database.models import Conversation
from database.models import Message
from database.models import User

from schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatMessage,
    FileAttachment,
)

from services.chat_service import (
    generate_response,
    stream_response,
)

from services.conversation_service import (
    create_conversation,
    save_message,
    save_message_attachments,
    update_conversation_timestamp,
    get_message,
    get_conversation_messages,
    update_message,
)


router = APIRouter(
    prefix="/api/v1/chat",
    tags=["Chat"],
)


# ============================================================
# NORMAL CHAT
# ============================================================

@router.post(
    "",
    response_model=ChatResponse,
)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    conversation_id = (
        request.conversation_id
    )

    conversation = None

    if conversation_id:
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
            existing_conversation = (
                db.query(Conversation)
                .filter(
                    Conversation.id ==
                    conversation_id
                )
                .first()
            )

            if existing_conversation:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "You do not have access "
                        "to this conversation."
                    ),
                )

    if not conversation:
        if not conversation_id:
            conversation_id = (
                f"conversation-"
                f"{int(datetime.now().timestamp() * 1000)}"
            )

        conversation = create_conversation(
            db=db,
            conversation_id=conversation_id,
            title=request.conversation_title,
        )

        conversation.user_id = current_user.id

        db.commit()

        db.refresh(
            conversation
        )

    user_message_id = (
        request.message_id
        or
        f"user-"
        f"{int(datetime.now().timestamp() * 1000)}"
    )

    save_message(
        db=db,
        message_id=user_message_id,
        conversation_id=conversation_id,
        role="user",
        content=request.message,
        model=request.model,
    )

    save_message_attachments(
        db=db,
        message_id=user_message_id,
        attachments=request.attachments,
    )

    content = generate_response(
        request.message,
        request.model,
        request.history,
        request.attachments,
    )

    assistant_message_id = (
        f"assistant-"
        f"{int(datetime.now().timestamp() * 1000)}"
    )

    save_message(
        db=db,
        message_id=assistant_message_id,
        conversation_id=conversation_id,
        role="assistant",
        content=content["content"],
        model=request.model,
    )

    update_conversation_timestamp(
        db=db,
        conversation_id=conversation_id,
    )

    return {
        **content,
        "conversation_id":
            conversation_id,
    }


# ============================================================
# EDIT MESSAGE REQUEST
# ============================================================

class EditMessageRequest(
    BaseModel
):
    message_id: str

    content: str = Field(
        ...,
        min_length=1,
    )

    model: str = "Nova Standard"

    history: list[ChatMessage] = Field(
        default_factory=list
    )

    attachments: list[FileAttachment] = Field(
        default_factory=list
    )


# ============================================================
# EDIT MESSAGE
# ============================================================

@router.put(
    "/message/edit",
)
async def edit_message(
    request: EditMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    message = get_message(
        db=db,
        message_id=request.message_id,
    )

    if not message:
        raise HTTPException(
            status_code=404,
            detail="Message not found",
        )

    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id ==
            message.conversation_id,
            Conversation.user_id ==
            current_user.id,
        )
        .first()
    )

    if not conversation:
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have access "
                "to this conversation."
            ),
        )

    if message.role != "user":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only user messages can be edited"
            ),
        )

    conversation_id = (
        message.conversation_id
    )

    updated_message = update_message(
        db=db,
        message_id=request.message_id,
        content=request.content,
    )

    content = generate_response(
        request.content,
        request.model,
        request.history,
        request.attachments,
    )

    messages = get_conversation_messages(
        db=db,
        conversation_id=conversation_id,
    )

    old_assistant_message = None

    user_index = None

    for index, item in enumerate(messages):
        if item.id == request.message_id:
            user_index = index
            break

    if user_index is not None:
        for item in messages[
            user_index + 1:
        ]:
            if item.role == "assistant":
                old_assistant_message = item
                break

    if old_assistant_message:
        updated_assistant = update_message(
            db=db,
            message_id=old_assistant_message.id,
            content=content["content"],
        )

        assistant_id = (
            updated_assistant.id
        )

    else:
        assistant_id = (
            f"assistant-"
            f"{int(datetime.now().timestamp() * 1000)}"
        )

        save_message(
            db=db,
            message_id=assistant_id,
            conversation_id=conversation_id,
            role="assistant",
            content=content["content"],
            model=request.model,
        )

    update_conversation_timestamp(
        db=db,
        conversation_id=conversation_id,
    )

    return {
        "userMessage": {
            "id": updated_message.id,
            "role": updated_message.role,
            "content": updated_message.content,
            "model": updated_message.model,
            "conversation_id":
                conversation_id,
        },
        "assistantMessage": {
            "id": assistant_id,
            "role": "assistant",
            "content": content["content"],
            "model": request.model,
            "conversation_id":
                conversation_id,
        },
        "conversation_id":
            conversation_id,
    }


# ============================================================
# REGENERATE MESSAGE REQUEST
# ============================================================

class RegenerateMessageRequest(
    BaseModel
):
    message_id: str

    model: str = "Nova Standard"

    history: list[ChatMessage] = Field(
        default_factory=list
    )

    attachments: list[FileAttachment] = Field(
        default_factory=list
    )


# ============================================================
# REGENERATE RESPONSE
# ============================================================

@router.post(
    "/message/regenerate",
)
async def regenerate_message(
    request: RegenerateMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    user_message = get_message(
        db=db,
        message_id=request.message_id,
    )

    if not user_message:
        raise HTTPException(
            status_code=404,
            detail="Message not found",
        )

    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id ==
            user_message.conversation_id,
            Conversation.user_id ==
            current_user.id,
        )
        .first()
    )

    if not conversation:
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have access "
                "to this conversation."
            ),
        )

    if user_message.role != "user":
        raise HTTPException(
            status_code=400,
            detail=(
                "Regeneration requires "
                "a user message"
            ),
        )

    conversation_id = (
        user_message.conversation_id
    )

    content = generate_response(
        user_message.content,
        request.model,
        request.history,
        request.attachments,
    )

    messages = get_conversation_messages(
        db=db,
        conversation_id=conversation_id,
    )

    user_index = None

    for index, item in enumerate(messages):
        if item.id == request.message_id:
            user_index = index
            break

    old_assistant_message = None

    if user_index is not None:
        for item in messages[
            user_index + 1:
        ]:
            if item.role == "assistant":
                old_assistant_message = item
                break

    if old_assistant_message:
        updated_assistant = update_message(
            db=db,
            message_id=old_assistant_message.id,
            content=content["content"],
        )

        assistant_id = (
            updated_assistant.id
        )

    else:
        assistant_id = (
            f"assistant-"
            f"{int(datetime.now().timestamp() * 1000)}"
        )

        save_message(
            db=db,
            message_id=assistant_id,
            conversation_id=conversation_id,
            role="assistant",
            content=content["content"],
            model=request.model,
        )

    update_conversation_timestamp(
        db=db,
        conversation_id=conversation_id,
    )

    return {
        "userMessage": {
            "id": user_message.id,
            "role": user_message.role,
            "content": user_message.content,
            "model": user_message.model,
            "conversation_id":
                conversation_id,
        },
        "assistantMessage": {
            "id": assistant_id,
            "role": "assistant",
            "content": content["content"],
            "model": request.model,
            "conversation_id":
                conversation_id,
        },
        "conversation_id":
            conversation_id,
    }


# ============================================================
# STREAMING CHAT
# ============================================================

@router.post(
    "/stream",
)
async def stream_chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    conversation_id = (
        request.conversation_id
    )

    # --------------------------------------------------------
    # CREATE CONVERSATION IF NEEDED
    # --------------------------------------------------------

    conversation = None

    if conversation_id:
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
            existing_conversation = (
                db.query(Conversation)
                .filter(
                    Conversation.id ==
                    conversation_id
                )
                .first()
            )

            if existing_conversation:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "You do not have access "
                        "to this conversation."
                    ),
                )

    if not conversation:
        if not conversation_id:
            conversation_id = (
                f"conversation-"
                f"{int(datetime.now().timestamp() * 1000)}"
            )

        conversation = create_conversation(
            db=db,
            conversation_id=conversation_id,
            title=request.conversation_title,
        )

        conversation.user_id = current_user.id

        db.commit()

        db.refresh(
            conversation
        )

    # --------------------------------------------------------
    # USER MESSAGE ID
    # --------------------------------------------------------

    user_message_id = (
        request.message_id
        or
        f"user-"
        f"{int(datetime.now().timestamp() * 1000)}"
    )

    # --------------------------------------------------------
    # SAVE USER MESSAGE
    # --------------------------------------------------------

    save_message(
        db=db,
        message_id=user_message_id,
        conversation_id=conversation_id,
        role="user",
        content=request.message,
        model=request.model,
    )

    save_message_attachments(
        db=db,
        message_id=user_message_id,
        attachments=request.attachments,
    )

    # --------------------------------------------------------
    # ASSISTANT MESSAGE ID
    # --------------------------------------------------------

    assistant_message_id = (
        f"assistant-"
        f"{int(datetime.now().timestamp() * 1000)}"
    )

    # --------------------------------------------------------
    # STREAM GENERATOR
    # --------------------------------------------------------

    def generate_stream():

        full_content = ""

        try:

            chunks = stream_response(
                message=request.message,
                model=request.model,
                history=request.history,
                attachments=request.attachments,
            )

            for chunk in chunks:

                full_content += chunk

                yield (
                    "data: "
                    + chunk.replace(
                        "\n",
                        "\\n"
                    )
                    + "\n\n"
                )

            # ------------------------------------------------
            # SAVE COMPLETE ASSISTANT RESPONSE
            # ------------------------------------------------

            save_message(
                db=db,
                message_id=assistant_message_id,
                conversation_id=conversation_id,
                role="assistant",
                content=full_content,
                model=request.model,
            )

            update_conversation_timestamp(
                db=db,
                conversation_id=conversation_id,
            )

            # ------------------------------------------------
            # SEND FINAL METADATA EVENT
            # ------------------------------------------------

            yield (
                "event: done\n"
                f"data: {assistant_message_id}|"
                f"{conversation_id}\n\n"
            )

        except Exception as error:

            print(
                "Streaming error:",
                error,
            )

            error_text = str(error)

            if (
                "429" in error_text
                or "RESOURCE_EXHAUSTED"
                in error_text
                or "quota" in error_text.lower()
            ):

                user_error = (
                    "Nova has reached the current "
                    "free-tier usage limit. "
                    "Please try again later."
                )

            elif (
                "400" in error_text
                or "INVALID_ARGUMENT"
                in error_text
            ):

                user_error = (
                    "Nova could not process that "
                    "request or file. Please check "
                    "the input and try again."
                )

            elif (
                "404" in error_text
                or "NOT_FOUND"
                in error_text
            ):

                user_error = (
                    "The selected AI model is "
                    "currently unavailable."
                )

            elif (
                "401" in error_text
                or "403" in error_text
                or "UNAUTHENTICATED"
                in error_text
                or "PERMISSION_DENIED"
                in error_text
            ):

                user_error = (
                    "Nova could not authenticate "
                    "with the AI service. Please "
                    "check the API configuration."
                )

            else:

                user_error = (
                    "Nova could not generate a "
                    "response right now. Please "
                    "try again later."
                )

            yield (
                "event: error\n"
                f"data: {user_error}\n\n"
            )

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":
                "no-cache",

            "Connection":
                "keep-alive",

            "X-Accel-Buffering":
                "no",
        },
    )