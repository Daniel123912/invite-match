# Зависимости и версии

## Backend (`backend/requirements.txt`)

| Пакет | Версия |
|-------|--------|
| fastapi | 0.115.6 |
| uvicorn[standard] | 0.34.0 |
| sqlalchemy | 2.0.36 |
| alembic | 1.14.0 |
| psycopg2-binary | 2.9.10 |
| asyncpg | 0.30.0 |
| pydantic | 2.10.4 |
| pydantic-settings | 2.7.0 |
| python-jose[cryptography] | 3.3.0 |
| passlib[bcrypt] | 1.7.4 |
| bcrypt | 4.2.1 |
| python-multipart | 0.0.20 |
| email-validator | 2.2.0 |
| httpx | 0.28.1 |
| pytest | 8.3.4 |
| pytest-asyncio | 0.25.0 |
| greenlet | 3.1.1 |

**Runtime:** Python 3.11+ (рекомендуется).

## Frontend (`frontend/package.json`)

| Пакет | Версия |
|-------|--------|
| next | 16.3.8 |
| react | 19.2.8 |
| react-dom | 19.2.8 |
| tailwindcss | ^4 |
| typescript | ^5 |

## Инфраструктура

| Компонент | Версия |
|-----------|--------|
| PostgreSQL (Docker) | 16-alpine |
| Node.js | 20+ для сборки фронта |

## Инструкция сборки и запуска

См. корневой [README.md](../README.md):

- Локально (рекомендуется): PostgreSQL + pgAdmin → `backend/scripts/init_pg.sql` → seed → uvicorn / `npm run dev`.
- Либо полный Docker: `docker compose up --build`.

Переменные: `backend/.env` (`DATABASE_URL` на ваш локальный Postgres), `frontend/.env.example`.
