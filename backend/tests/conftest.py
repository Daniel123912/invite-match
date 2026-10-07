import os
from pathlib import Path

TEST_DB = Path(__file__).resolve().parent / "test_fsp.db"
if TEST_DB.exists():
    TEST_DB.unlink()

# Изолированная БД для тестов — ДО импорта app
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.db_migrate import ensure_columns
from app.main import app
from seed import seed

get_settings.cache_clear()


@pytest.fixture(scope="session", autouse=True)
def prepare_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    seed()
    yield
    Base.metadata.drop_all(bind=engine)
    try:
        TEST_DB.unlink(missing_ok=True)
    except OSError:
        pass


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
