from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

_is_sqlite = settings.database_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if _is_sqlite else {}
# Пул для Postgres: десятки одновременных пользователей на демо-стенде
_engine_kwargs: dict = {"connect_args": connect_args}
if not _is_sqlite:
    _engine_kwargs.update(pool_size=10, max_overflow=30, pool_pre_ping=True)
else:
    _engine_kwargs["pool_pre_ping"] = False
engine = create_engine(settings.database_url, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
