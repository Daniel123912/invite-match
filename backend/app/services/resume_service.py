import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "resumes"
MAX_BYTES = 5 * 1024 * 1024
ALLOWED = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def save_resume(file: UploadFile) -> tuple[str, str, str, str]:
    if file.content_type not in ALLOWED:
        raise HTTPException(400, "Допустимы только PDF и DOCX")
    raw = file.file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(400, "Файл больше 5 МБ")
    ext = ".pdf" if file.content_type == "application/pdf" else ".docx"
    key = f"{uuid.uuid4().hex}{ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = UPLOAD_DIR / key
    path.write_bytes(raw)
    text = extract_text(raw, file.content_type)
    return key, file.filename or key, file.content_type, text


def extract_text(raw: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        try:
            from pypdf import PdfReader
            from io import BytesIO

            reader = PdfReader(BytesIO(raw))
            parts = [p.extract_text() or "" for p in reader.pages[:20]]
            return "\n".join(parts).strip()
        except Exception:
            return ""
    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            from io import BytesIO

            from docx import Document

            doc = Document(BytesIO(raw))
            return "\n".join(p.text for p in doc.paragraphs).strip()
        except Exception:
            return ""
    return ""


def docx_preview_html(raw: bytes) -> str:
    text = extract_text(raw, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    safe = re.sub(r"[<>&]", " ", text)
    return f"<html><body style='font-family:sans-serif;padding:1rem'>{safe}</body></html>"


def delete_storage(key: str | None) -> None:
    if not key:
        return
    path = UPLOAD_DIR / key
    if path.is_file():
        path.unlink()
