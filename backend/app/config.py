from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_SECRETS = frozenset(
    {
        "",
        "change-me-in-production-fsp-hackathon-2026",
        "fsp-hackathon-dev-secret-change-me",
        "dev-only-insecure-key-set-SECRET_KEY",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "FSP Match Platform"
    # В проде всегда DEBUG=false
    debug: bool = False
    secret_key: str = Field(default="dev-only-insecure-key-set-SECRET_KEY")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # PostgreSQL — основная БД (локально: docker compose up -d db)
    database_url: str = "postgresql+psycopg2://fsp:fsp@localhost:5432/fsp_talent_db"

    # Grade change cooldown (days)
    grade_change_cooldown_days: int = 90

    # Сколько вопросов выдавать в одной попытке теста
    test_question_count: int = 16

    # CORS (точный список через запятую). Regex preview — только явно в .env
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cors_origin_regex: str = ""

    # Только локально/тесты без SMTP: вернуть confirm-токен в JSON
    expose_email_confirm_token: bool = False
    email_confirm_ttl_hours: int = 24

    # Демо-учётки в seed (в проде выключить)
    allow_demo_seed: bool = True
    demo_password: str = "demo1234"

    @field_validator("secret_key")
    @classmethod
    def secret_not_blank(cls, v: str) -> str:
        if not v or not str(v).strip():
            raise ValueError("SECRET_KEY не может быть пустым")
        return str(v).strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()


def assert_secure_settings() -> None:
    """Падать при старте, если прод-конфиг с дырявыми секретами."""
    s = get_settings()
    insecure = s.secret_key in _INSECURE_SECRETS or len(s.secret_key) < 32
    if not s.debug and insecure:
        raise RuntimeError(
            "Небезопасный SECRET_KEY при DEBUG=false. "
            "Задайте уникальный SECRET_KEY (≥32 символов) в окружении."
        )
    if not s.debug and s.expose_email_confirm_token:
        raise RuntimeError(
            "EXPOSE_EMAIL_CONFIRM_TOKEN нельзя включать при DEBUG=false."
        )
    if not s.debug and s.cors_origin_regex:
        raise RuntimeError(
            "CORS_ORIGIN_REGEX нельзя использовать при DEBUG=false — только явный CORS_ORIGINS."
        )
