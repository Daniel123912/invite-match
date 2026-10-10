import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import Candidate, Employer, User, UserRole
from app.schemas import (
    ConfirmEmailRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserOut,
)
from app.services.minor_consent import parse_birth_date, require_parental_consent_if_minor

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _token_response(user: User) -> TokenResponse:
    token = create_access_token(user.email, user.role.value)
    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        email_verified=bool(user.email_verified),
    )


@router.get("/check-email")
def check_email(email: str = Query(...), db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == email.lower().strip()).first()
    return {"available": exists is None}


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if body.role == UserRole.ADMIN:
        raise HTTPException(400, "Cannot register as admin")

    if not body.consent_152fz:
        raise HTTPException(
            400,
            "Для регистрации нужно согласие на обработку персональных данных (152-ФЗ)",
        )

    existing = db.query(User).filter(User.email == body.email.lower()).first()
    if existing:
        raise HTTPException(400, "Email уже зарегистрирован")

    confirm_token = secrets.token_urlsafe(32)
    user = User(
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        role=body.role,
        email_verified=False,
        email_confirm_token=confirm_token,
    )
    db.add(user)
    db.flush()

    now = datetime.now(timezone.utc)
    if body.role == UserRole.CANDIDATE:
        birth = parse_birth_date(body.birth_date)
        require_parental_consent_if_minor(birth, body.parental_consent)
        db.add(
            Candidate(
                user_id=user.id,
                full_name=body.full_name,
                consent_152fz=True,
                consent_152fz_at=now,
                privacy_public=True,
                birth_date=body.birth_date,
                parental_consent=body.parental_consent,
            )
        )
    elif body.role == UserRole.EMPLOYER:
        db.add(
            Employer(
                user_id=user.id,
                full_name=body.full_name,
                consent_152fz=True,
                consent_152fz_at=now,
            )
        )

    db.commit()

    # Без SMTP: токен возвращаем в ответе (демо / DEBUG)
    return RegisterResponse(
        message="Проверьте email и подтвердите адрес. В демо-режиме токен в ответе API.",
        email=user.email,
        email_confirm_token=confirm_token if settings.debug else None,
    )


@router.post("/confirm-email", response_model=TokenResponse)
def confirm_email(body: ConfirmEmailRequest, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .filter(User.email_confirm_token == body.token.strip())
        .first()
    )
    if not user:
        raise HTTPException(400, "Неверный или устаревший токен подтверждения")
    user.email_verified = True
    user.email_confirm_token = None
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/resend-confirmation", response_model=RegisterResponse)
def resend_confirmation(email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    if user.email_verified:
        raise HTTPException(400, "Email уже подтверждён")
    token = secrets.token_urlsafe(32)
    user.email_confirm_token = token
    db.commit()
    return RegisterResponse(
        message="Токен подтверждения обновлён",
        email=user.email,
        email_confirm_token=token if settings.debug else None,
    )


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username.lower()).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный email или пароль")
    if not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Аккаунт отключён")
    if not user.email_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Подтвердите email перед входом (POST /api/auth/confirm-email)",
        )
    return _token_response(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
