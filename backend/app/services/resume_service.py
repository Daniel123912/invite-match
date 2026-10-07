import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

ALLOWED_RESUME_TYPES: dict[str, str] = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

# Некоторые браузеры шлют укороченный или пустой content-type
EXTENSION_FALLBACK: dict[str, str] = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def ensure_upload_dir(upload_dir: Path) -> None:
    upload_dir.mkdir(parents=True, exist_ok=True)


def _guess_type(filename: str, content_type: str | None) -> tuple[str, str]:
    name = (filename or "").lower()
    ext = Path(name).suffix
    if content_type in ALLOWED_RESUME_TYPES:
        return content_type, ALLOWED_RESUME_TYPES[content_type]
    if ext in EXTENSION_FALLBACK:
        return EXTENSION_FALLBACK[ext], ext
    raise HTTPException(400, "Допустимы только PDF и DOCX")


def validate_resume_upload(file: UploadFile, max_bytes: int) -> tuple[str, str]:
    content_type, ext = _guess_type(file.filename or "", file.content_type)
    return content_type, ext


async def read_resume_bytes(file: UploadFile, max_bytes: int) -> bytes:
    data = await file.read()
    if not data:
        raise HTTPException(400, "Файл пустой")
    if len(data) > max_bytes:
        raise HTTPException(400, f"Файл больше {max_bytes // (1024 * 1024)} МБ")
    return data


def save_resume_file(upload_dir: Path, data: bytes, ext: str) -> str:
    ensure_upload_dir(upload_dir)
    key = f"{uuid.uuid4().hex}{ext}"
    path = upload_dir / key
    path.write_bytes(data)
    return key


def delete_resume_file(upload_dir: Path, storage_key: str | None) -> None:
    if not storage_key:
        return
    path = upload_dir / storage_key
    if path.is_file():
        path.unlink()


def resolve_resume_path(upload_dir: Path, storage_key: str) -> Path:
    path = (upload_dir / storage_key).resolve()
    if not path.is_file() or upload_dir.resolve() not in path.parents:
        raise HTTPException(404, "Файл резюме не найден")
    return path


def extract_resume_text(path: Path, content_type: str) -> str:
    if content_type == "application/pdf":
        return _extract_pdf_text(path)
    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _extract_docx_text(path)
    return ""


def docx_to_html(path: Path) -> str:
    from docx import Document

    doc = Document(path)
    parts: list[str] = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        safe = (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
        )
        parts.append(f"<p>{safe}</p>")
    for table in doc.tables:
        rows_html: list[str] = []
        for row in table.rows:
            cells = "".join(
                f"<td>{c.text.strip().replace('&', '&amp;')}</td>" for c in row.cells
            )
            rows_html.append(f"<tr>{cells}</tr>")
        if rows_html:
            parts.append("<table>" + "".join(rows_html) + "</table>")
    body = "".join(parts) if parts else "<p>(пустой документ)</p>"
    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        "<style>body{font-family:system-ui,sans-serif;line-height:1.5;padding:1rem;}"
        "table{border-collapse:collapse;width:100%;margin:1rem 0;}"
        "td{border:1px solid #ccc;padding:6px;}</style></head><body>"
        f"{body}</body></html>"
    )


def _extract_pdf_text(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    chunks: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            chunks.append(text)
    return "\n\n".join(chunks).strip()


def _extract_docx_text(path: Path) -> str:
    from docx import Document

    doc = Document(path)
    parts = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n".join(parts).strip()
