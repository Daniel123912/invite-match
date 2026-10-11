"""Хеширование одноразовых токенов (confirm email и т.п.)."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone


def new_urlsafe_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


def tokens_equal(plain: str, hashed: str) -> bool:
    return hmac.compare_digest(hash_token(plain), hashed)


def expires_at(*, hours: int = 24) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def is_expired(dt: datetime | None) -> bool:
    if dt is None:
        return True
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) > dt.astimezone(timezone.utc)
