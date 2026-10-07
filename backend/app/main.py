from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import api_router
from app.config import get_settings
from app.database import Base, engine
from app.db_migrate import ensure_columns

settings = get_settings()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Базовые заголовки безопасности (минимум для демо)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        return response


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "Платформа подбора ИТ-специалистов с категоризацией через тест (ФСП спец. трек). "
        "ПДн: согласие 152-ФЗ, контакты скрыты до accept, возможен отзыв доступа."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}
