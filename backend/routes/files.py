import io
import logging
import os
import re
import tempfile
import time
import zipfile
from xml.etree import ElementTree

from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import HTTPException
from fastapi import UploadFile

from auth import get_current_user
from config.settings import settings
from database.models import User
from providers import gemini_provider as provider
from rate_limit import limiter


logger = logging.getLogger("nova.files")

router = APIRouter(prefix="/api/v1/files", tags=["Files"])


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Types Gemini can read directly.
NATIVE_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/html",
    "application/json",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/heic",
}

EXTENSION_MIME_TYPES = {
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".json": "application/json",
    ".txt": "text/plain",
    ".py": "text/plain",
    ".js": "text/plain",
    ".jsx": "text/plain",
    ".ts": "text/plain",
    ".tsx": "text/plain",
    ".java": "text/plain",
    ".c": "text/plain",
    ".cpp": "text/plain",
    ".html": "text/html",
    ".css": "text/plain",
    ".sql": "text/plain",
    ".docx": DOCX_MIME,
}

MAX_FILE_SIZE = 50 * 1024 * 1024


def docx_to_text(data: bytes) -> str:
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        root = ElementTree.fromstring(archive.read("word/document.xml"))

    paragraphs = []

    for paragraph in root.iter(f"{namespace}p"):
        text = "".join(node.text or "" for node in paragraph.iter(f"{namespace}t"))
        paragraphs.append(text)

    return re.sub(r"\n{3,}", "\n\n", "\n".join(paragraphs)).strip()


def detect_mime(file: UploadFile) -> str:
    extension = os.path.splitext(file.filename or "")[1].lower()
    content_type = (file.content_type or "").split(";")[0].strip().lower()

    if content_type in NATIVE_MIME_TYPES or content_type == DOCX_MIME:
        return content_type

    if extension in EXTENSION_MIME_TYPES:
        return EXTENSION_MIME_TYPES[extension]

    if content_type.startswith("text/"):
        return "text/plain"

    raise HTTPException(
        status_code=400,
        detail=(
            "Unsupported file type. You can upload PDFs, images (PNG, JPG, WEBP, GIF), "
            "Word (.docx), and text or code files."
        ),
    )


def wait_until_active(name: str):
    file_info = None

    for _ in range(60):
        file_info = provider.get_file(name)
        state = getattr(file_info, "state", None)
        state_value = getattr(state, "name", str(state)) if state is not None else None

        if state_value in (None, "ACTIVE"):
            return file_info

        if state_value == "FAILED":
            raise HTTPException(status_code=422, detail="Nova couldn't process this file.")

        time.sleep(1)

    raise HTTPException(status_code=504, detail="Processing the file took too long.")


@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    limiter.check(f"upload:{user.id}", settings.UPLOAD_LIMIT_PER_HOUR, 3600)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    mime_type = detect_mime(file)
    data = file.file.read(MAX_FILE_SIZE + 1)

    if not data:
        raise HTTPException(status_code=400, detail="The file is empty.")

    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Files can be at most 50 MB.")

    upload_bytes = data
    upload_mime = mime_type
    suffix = os.path.splitext(file.filename)[1]

    if mime_type == DOCX_MIME:
        try:
            text = docx_to_text(data)
        except Exception:
            raise HTTPException(status_code=400, detail="This Word file couldn't be read.")

        if not text:
            raise HTTPException(status_code=400, detail="This Word file has no text.")

        upload_bytes = text.encode("utf-8")
        upload_mime = "text/plain"
        suffix = ".txt"

    temporary_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
            temporary.write(upload_bytes)
            temporary_path = temporary.name

        uploaded = provider.upload_file(temporary_path, upload_mime, file.filename)
        file_info = wait_until_active(uploaded.name)

        return {
            "name": file_info.name,
            "displayName": file.filename,
            "mimeType": getattr(file_info, "mime_type", None) or upload_mime,
            "uri": file_info.uri,
            "fileSize": len(data),
        }

    except HTTPException:
        raise

    except Exception as error:
        logger.exception("File upload failed")
        raise HTTPException(status_code=502, detail=provider.friendly_error(error))

    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)
