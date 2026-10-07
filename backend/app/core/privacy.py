"""Правила 152-ФЗ / видимости ПДн (минимум для MVP)."""

from datetime import datetime, timezone

from fastapi import HTTPException

from app.models import Candidate, Invitation, InvitationStatus


CONSENT_REQUIRED = "Нужно согласие на обработку персональных данных (152-ФЗ)"


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
