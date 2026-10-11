"""Простой in-memory rate limit (на процесс). Достаточно для демо/MVP."""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, key: str, *, limit: int, window_sec: float) -> None:
        now = time.monotonic()
        with self._lock:
            recent = [t for t in self._hits[key] if now - t < window_sec]
            if len(recent) >= limit:
                raise HTTPException(
                    status_code=429,
                    detail="Слишком много запросов. Подождите немного и повторите.",
                )
            recent.append(now)
            self._hits[key] = recent


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:128]
    if request.client and request.client.host:
        return request.client.host
    return "unknown"
