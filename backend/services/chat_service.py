from datetime import datetime

from providers.gemini_provider import (
    generate_gemini_response,
    stream_gemini_response,
)


def generate_response(
    message: str,
    model: str,
    history=None,
    attachments=None,
):
    gemini_model = "gemini-3.5-flash-lite"

    content = generate_gemini_response(
        message=message,
        history=history,
        attachments=attachments,
        model=gemini_model,
    )

    return {
        "id": (
            f"message-"
            f"{int(datetime.now().timestamp() * 1000)}"
        ),
        "role": "assistant",
        "content": content,
        "model": model,
    }


def stream_response(
    message: str,
    model: str,
    history=None,
    attachments=None,
):
    gemini_model = "gemini-3.5-flash-lite"

    return stream_gemini_response(
        message=message,
        history=history,
        attachments=attachments,
        model=gemini_model,
    )