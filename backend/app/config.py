from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "FSP Match Platform"
    debug: bool = True
    secret_key: str = "change-me-in-production-fsp-hackathon-2026"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # SQLite by default so the team can start without Docker.
    # For Postgres: postgresql+psycopg2://fsp:fsp@localhost:5432/fsp_talent_db
    database_url: str = "sqlite:///./fsp_talent_db.db"

    # Grade change cooldown (days)
    grade_change_cooldown_days: int = 90

    # CORS (точный список через запятую) — 3001 если Next занял другой порт
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001"
    )
    # Preview-деплои Vercel: https://*.vercel.app
    cors_origin_regex: str = r"https://.*\.vercel\.app"

    resume_upload_dir: str = "uploads/resumes"
    resume_max_bytes: int = 5 * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
