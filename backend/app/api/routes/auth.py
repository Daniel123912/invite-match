from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import EmailStr
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import Candidate, Employer, User, UserRole
from app.schemas import EmailCheckResponse, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/check-email", response_model=EmailCheckResponse)
def check_email(email: EmailStr = Query(...), db: Session = Depends(get_db)):
    """Проверка занятости email без создания аккаунта (для UI без перезагрузки)."""
    normalized = str(email).lower().strip()
    taken = db.query(User.id).filter(User.email == normalized).first() is not None
    if taken:
        return EmailCheckResponse(
            email=normalized,
            available=False,
            message="Email уже зарегистрирован",
        )
    return EmailCheckResponse(
        email=normalized,
        available=True,
        message="Email свободен",
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if body.role == UserRole.ADMIN:
        raise HTTPException(400, "Cannot register as admin")

    if not body.consent_152fz:
        raise HTTPException(
            400,
            "Для регистрации нужно согласие на обработку персональных данных (152-ФЗ)",
        )

    email = body.email.lower().strip()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(400, "Email уже зарегистрирован")

    user = User(
        email=email,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    db.flush()

    now = datetime.now(timezone.utc)
    if body.role == UserRole.CANDIDATE:
        db.add(
            Candidate(
                user_id=user.id,
                full_name=body.full_name.strip(),
                consent_152fz=True,
                consent_152fz_at=now,
                privacy_public=True,
            )
        )
    elif body.role == UserRole.EMPLOYER:
        db.add(
            Employer(
                user_id=user.id,
                full_name=body.full_name.strip(),
                consent_152fz=True,
                consent_152fz_at=now,
            )
        )

    db.commit()
    db.refresh(user)

    token = create_access_token(user.email, user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username.lower().strip()).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный email или пароль")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт отключён")
    token = create_access_token(user.email, user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
