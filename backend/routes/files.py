import os
import tempfile
import time

from fastapi import APIRouter
from fastapi import File
from fastapi import HTTPException
from fastapi import UploadFile

from config.settings import settings
from google import genai


router = APIRouter(
    prefix="/api/v1/files",
    tags=["Files"],
)


client = genai.Client(
    api_key=settings.GEMINI_API_KEY
)


ALLOWED_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "image/png",
    "image/jpeg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


MAX_FILE_SIZE = 50 * 1024 * 1024


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Supported files are PDF, TXT, "
                "DOC, DOCX, PNG and JPG."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size cannot exceed 50 MB.",
        )

    suffix = ""

    if file.filename:
        _, extension = os.path.splitext(
            file.filename
        )

        suffix = extension

    temporary_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
        ) as temporary_file:

            temporary_file.write(
                file_bytes
            )

            temporary_path = (
                temporary_file.name
            )

        print(
            f"Uploading file to Gemini: "
            f"{file.filename}"
        )

        uploaded_file = client.files.upload(
            file=temporary_path,
            config={
                "mime_type":
                    file.content_type,

                "display_name":
                    file.filename,
            },
        )

        print(
            f"Gemini file uploaded: "
            f"{uploaded_file.name}"
        )

        # -------------------------------------------------
        # WAIT FOR GEMINI FILE PROCESSING
        # -------------------------------------------------

        file_info = uploaded_file

        for attempt in range(30):

            file_info = client.files.get(
                name=uploaded_file.name
            )

            state = getattr(
                file_info,
                "state",
                None,
            )

            print(
                f"Gemini file state "
                f"(attempt {attempt + 1}): "
                f"{state}"
            )

            if state is None:
                break

            state_value = getattr(
                state,
                "name",
                str(state),
            )

            if state_value == "ACTIVE":
                break

            if state_value == "FAILED":
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Gemini failed to process "
                        "the uploaded file."
                    ),
                )

            time.sleep(1)

        else:
            raise HTTPException(
                status_code=504,
                detail=(
                    "Gemini took too long to "
                    "process the uploaded file."
                ),
            )

        # -------------------------------------------------
        # RETURN PROCESSED FILE INFORMATION
        # -------------------------------------------------

        return {
            "name":
                file_info.name,

            "displayName":
                file.filename,

            "mimeType":
                getattr(
                    file_info,
                    "mime_type",
                    file.content_type,
                ),

            "uri":
                file_info.uri,

            "fileSize":
                len(file_bytes),
        }

    except HTTPException:
        raise

    except Exception as error:

        print(
            "File upload error:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to upload or "
                "process file with Gemini."
            ),
        )

    finally:

        if (
            temporary_path
            and os.path.exists(
                temporary_path
            )
        ):
            os.remove(
                temporary_path
            )