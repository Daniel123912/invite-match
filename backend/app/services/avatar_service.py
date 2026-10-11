"""Загрузка и хранение аватаров кандидатов."""

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "avatars"
MAX_BYTES = 2 * 1024 * 1024
JPEG = "image/jpeg"
PNG = "image/png"
WEBP = "image/webp"
ALLOWED = {JPEG, PNG, WEBP}
EXT = {JPEG: ".jpg", PNG: ".png", WEBP: ".webp"}


def _guess_content_type(filename: str | None, declared: str | None, raw: bytes) -> str | None:
    name = (filename or "").lower()
    declared = (declared or "").split(";")[0].strip().lower()
    if declared in ALLOWED:
        return declared
    if raw[:3] == b"\xff\xd8\xff" or name.endswith((".jpg", ".jpeg")):
        return JPEG
    if raw[:8] == b"\x89PNG\r\n\x1a\n" or name.endswith(".png"):
        return PNG
    if len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return WEBP
    if name.endswith(".webp"):
        return WEBP
    return None


def save_avatar(file: UploadFile) -> tuple[str, str]:
    raw = file.file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(400, "Фото больше 2 МБ")
    ctype = _guess_content_type(file.filename, file.content_type, raw)
    if ctype not in ALLOWED:
        raise HTTPException(400, "Допустимы JPEG, PNG и WebP")
    key = f"{uuid.uuid4().hex}{EXT[ctype]}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / key).write_bytes(raw)
    return key, ctype


def delete_storage(key: str | None) -> None:
    if not key:
        return
    path = UPLOAD_DIR / key
    if path.is_file():
        path.unlink()
