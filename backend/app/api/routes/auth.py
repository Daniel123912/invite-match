import re
import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.rate_limit import client_ip, limiter
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.core.tokens import expires_at, hash_token, is_expired, new_urlsafe_token
from app.database import get_db
from app.models import Candidate, Employer, User, UserRole
from app.schemas import (
    ConfirmEmailRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserOut,
)
from app.services.minor_consent import parse_birth_date, require_parental_consent_if_minor

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

_GENERIC_RESEND_MSG = (
    "Если аккаунт существует и email ещё не подтверждён, отправлена новая ссылка подтверждения."
)
_GENERIC_FORGOT_MSG = (
    "Если аккаунт с таким email существует, на почту отправлен новый пароль."
)


def _generate_temp_password(length: int = 12) -> str:
    """Пароль ≥8 символов с буквой и цифрой (как при регистрации)."""
    alphabet = string.ascii_letters + string.digits
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if re.search(r"[A-Za-z]", pwd) and re.search(r"\d", pwd):
            return pwd


def _token_response(user: User) -> TokenResponse:
    token = create_access_token(user.email, user.role.value)
    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        email_verified=bool(user.email_verified),
    )


def _issue_confirm_token(user: User) -> str:
    plain = new_urlsafe_token(32)
    user.email_confirm_token = hash_token(plain)
    user.email_confirm_expires_at = expires_at(hours=settings.email_confirm_ttl_hours)
    return plain


@router.get("/check-email")
def check_email(
    request: Request,
    email: str = Query(...),
    db: Session = Depends(get_db),
):
    """Проверка занятости email. Rate-limited; не раскрывает лишнего в ошибках."""
    limiter.check(f"check-email:{client_ip(request)}", limit=20, window_sec=60)
    normalized = email.lower().strip()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", normalized):
        return {"available": False}
    exists = db.query(User).filter(User.email == normalized).first()
    return {"available": exists is None}


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    limiter.check(f"register:{client_ip(request)}", limit=10, window_sec=60)

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

    user = User(
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        role=body.role,
        email_verified=False,
    )
    plain_token = _issue_confirm_token(user)
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
                # 152-ФЗ: в подборку только после явного opt-in в настройках
                privacy_public=False,
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

    return RegisterResponse(
        message=(
            "Проверьте email и подтвердите адрес."
            if not settings.expose_email_confirm_token
            else "Аккаунт создан. В локальном режиме токен подтверждения в ответе API."
        ),
        email=user.email,
        email_confirm_token=plain_token if settings.expose_email_confirm_token else None,
    )


@router.post("/confirm-email", response_model=TokenResponse)
def confirm_email(request: Request, body: ConfirmEmailRequest, db: Session = Depends(get_db)):
    limiter.check(f"confirm-email:{client_ip(request)}", limit=20, window_sec=60)
    token_hash = hash_token(body.token)
    user = db.query(User).filter(User.email_confirm_token == token_hash).first()
    if not user or is_expired(user.email_confirm_expires_at):
        raise HTTPException(400, "Неверный или устаревший токен подтверждения")
    user.email_verified = True
    user.email_confirm_token = None
    user.email_confirm_expires_at = None
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/resend-confirmation", response_model=RegisterResponse)
def resend_confirmation(
    request: Request,
    email: str = Query(...),
    db: Session = Depends(get_db),
):
    """Одинаковый ответ всегда — без enumeration."""
    limiter.check(f"resend:{client_ip(request)}", limit=5, window_sec=60)
    normalized = email.lower().strip()
    user = db.query(User).filter(User.email == normalized).first()
    plain: str | None = None
    if user and not user.email_verified:
        plain = _issue_confirm_token(user)
        db.commit()
    return RegisterResponse(
        message=_GENERIC_RESEND_MSG,
        email=normalized,
        email_confirm_token=(
            plain if plain and settings.expose_email_confirm_token else None
        ),
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Сброс пароля: генерируем новый. Без SMTP — temporary_password в ответе при EXPOSE_…"""
    limiter.check(f"forgot-password:{client_ip(request)}", limit=5, window_sec=60)
    normalized = body.email.lower().strip()
    user = db.query(User).filter(User.email == normalized).first()
    temp: str | None = None
    if user and user.is_active:
        temp = _generate_temp_password()
        user.hashed_password = hash_password(temp)
        db.commit()
        # TODO: отправить temp на email, когда появится SMTP
    return ForgotPasswordResponse(
        message=_GENERIC_FORGOT_MSG,
        email=normalized,
        temporary_password=(
            temp if temp and settings.expose_email_confirm_token else None
        ),
    )


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    limiter.check(f"login:{client_ip(request)}", limit=20, window_sec=60)
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
