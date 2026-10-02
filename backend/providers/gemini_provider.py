from google import genai
from google.genai import types

from config.settings import settings


client = genai.Client(
    api_key=settings.GEMINI_API_KEY
)


def build_contents(
    message: str,
    history=None,
    attachments=None,
):
    contents = []

    # -----------------------------------
    # CHAT HISTORY
    # -----------------------------------

    if history:

        for item in history:

            role = (
                "model"
                if item.role == "assistant"
                else "user"
            )

            contents.append(
                types.Content(
                    role=role,
                    parts=[
                        types.Part.from_text(
                            text=item.content
                        )
                    ],
                )
            )

    # -----------------------------------
    # CURRENT USER INPUT
    # FILE + MESSAGE
    # -----------------------------------

    current_parts = []

    if attachments:

        for attachment in attachments:

            file_name = getattr(
                attachment,
                "name",
                None,
            )

            if not file_name:
                continue

            print(
                "Getting Gemini file:",
                file_name,
            )

            file_info = client.files.get(
                name=file_name
            )

            print(
                "Gemini file retrieved:",
                file_info.name,
            )

            print(
                "Gemini file MIME type:",
                file_info.mime_type,
            )

            print(
                "Gemini file state:",
                file_info.state,
            )

            # Add the uploaded Gemini file
            # to the current user content.
            current_parts.append(
                types.Part.from_uri(
                    file_uri=file_info.uri,
                    mime_type=file_info.mime_type,
                )
            )

    if message.strip():

        current_parts.append(
            types.Part.from_text(
                text=message
            )
        )

    # -----------------------------------
    # ADD CURRENT USER CONTENT
    # -----------------------------------

    if current_parts:

        contents.append(
            types.Content(
                role="user",
                parts=current_parts,
            )
        )

    return contents


def generate_gemini_response(
    message: str,
    history=None,
    attachments=None,
    model: str = "gemini-3.5-flash-lite",
):
    contents = build_contents(
        message=message,
        history=history,
        attachments=attachments,
    )

    print(
        "Starting Gemini generation..."
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
    )

    print(
        "Gemini generation completed."
    )

    return response.text


def stream_gemini_response(
    message: str,
    history=None,
    attachments=None,
    model: str = "gemini-3.5-flash-lite",
):
    contents = build_contents(
        message=message,
        history=history,
        attachments=attachments,
    )

    print(
        "Starting Gemini streaming..."
    )

    response = client.models.generate_content_stream(
        model=model,
        contents=contents,
    )

    print(
        "Gemini streaming started successfully."
    )

    for chunk in response:

        if chunk.text:

            yield chunk.text