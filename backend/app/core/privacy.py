"""Правила 152-ФЗ / видимости ПДн (минимум для MVP)."""

import re
from datetime import datetime, timezone

from fastapi import HTTPException

from app.models import Candidate, Invitation, InvitationStatus


CONSENT_REQUIRED = "Нужно согласие на обработку персональных данных (152-ФЗ)"

MASK_PHONE = "+7 ••• •••-••-••"
MASK_EMAIL = "•••@•••.••"
MASK_TELEGRAM = "@••••••"

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(
    r"(?:\+?\d[\d\-\s()]{8,}\d)|(?:\b8[\d\-\s()]{9,}\d)"
)
_TELEGRAM_RE = re.compile(r"(?<!\w)@([A-Za-z0-9_]{4,})")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require_consent(candidate: Candidate) -> None:
    if not candidate.consent_152fz:
        raise HTTPException(400, CONSENT_REQUIRED)


def apply_consent(candidate: Candidate, granted: bool) -> None:
    """Выдать или отозвать согласие; при отзыве скрываем профиль из подборки."""
    if granted:
        candidate.consent_152fz = True
        if not candidate.consent_152fz_at:
            candidate.consent_152fz_at = utcnow()
    else:
        candidate.consent_152fz = False
        candidate.consent_152fz_at = None
        candidate.privacy_public = False


def can_reveal_contacts(invitation: Invitation, candidate: Candidate | None) -> bool:
    """Контакты только после accept, при живом согласии и без отзыва доступа."""
    if invitation.status != InvitationStatus.ACCEPTED:
        return False
    if invitation.contacts_revoked:
        return False
    if not candidate or not candidate.consent_152fz:
        return False
    return True


def assert_candidate_invitable(candidate: Candidate) -> None:
    """Скрытых / без согласия нельзя приглашать даже по прямому ID."""
    if not candidate.consent_152fz:
        raise HTTPException(400, "Кандидат отозвал согласие на обработку ПДн")
    if not candidate.privacy_public:
        raise HTTPException(403, "Кандидат скрыл профиль — приглашение недоступно")


def redact_pii(text: str | None) -> str | None:
    """Маскирует email/телефон/telegram в свободном тексте (резюме, about)."""
    if not text:
        return text
    out = _EMAIL_RE.sub(MASK_EMAIL, text)
    out = _PHONE_RE.sub(MASK_PHONE, out)
    out = _TELEGRAM_RE.sub(MASK_TELEGRAM, out)
    return out


def contact_masks(*, revealed: bool, phone: str | None, email: str | None, telegram: str | None) -> dict:
    """Контакты: либо реальные, либо маски (всегда отдаём placeholders для UI)."""
    return {
        "contacts_revealed": revealed,
        "phone": phone if revealed else None,
        "email": email if revealed else None,
        "telegram": telegram if revealed else None,
        "phone_display": phone if revealed and phone else MASK_PHONE,
        "email_display": email if revealed and email else MASK_EMAIL,
        "telegram_display": telegram if revealed and telegram else MASK_TELEGRAM,
    }
