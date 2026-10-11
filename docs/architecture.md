# Архитектура

## Обзор

Модульный монолит: **Next.js** (кабинеты) ↔ **FastAPI** (API + бизнес-логика) ↔ **PostgreSQL** (или SQLite для локальной разработки).

```
┌─────────────┐     JWT      ┌──────────────┐      SQL      ┌────────────┐
│  Frontend   │ ───────────► │   Backend    │ ────────────► │     DB     │
│  Next.js    │ ◄─────────── │   FastAPI    │ ◄──────────── │ Postgres/  │
│  :3000      │   JSON/OpenAPI│   :8000      │              │ SQLite     │
└─────────────┘              └──────────────┘              └────────────┘
```

## Компоненты

| Слой | Назначение |
|------|------------|
| `frontend/src/app/candidate/*` | Кабинет кандидата: профиль, опрос, тест, приглашения, настройки |
| `frontend/src/app/employer/*` | Кабинет работодателя: компания, потребность, подборка, приглашения |
| `backend/app/api/routes/` | HTTP: auth, candidate, employer, invitations, fsp, chat |
| `backend/app/services/` | Тест, матчинг, резюме, песочница, антиплагиат |
| `backend/app/models/` | SQLAlchemy-модели |
| `backend/seed.py` | Демо-данные для жюри |

## Роли и данные

- **User** — email, пароль (bcrypt), роль (`candidate` / `employer`), подтверждение email.
- **Candidate** — профиль, опрос, грейд, категория, FSP ID, согласие 152-ФЗ, приватность.
- **Employer + Company** — профиль компании и контакты для связи.
- **Category** — специализация × грейд (например `Backend × Middle`).
- **TestQuestion / TestAttempt** — банк заданий и попытки (вариант A/B).
- **Invitation** — адресное приглашение с зарплатой от–до и статусами.

## Auth

1. Регистрация с согласием 152-ФЗ → токен подтверждения email (в DEBUG возвращается в ответе).
2. `POST /api/auth/confirm-email` → JWT.
3. Дальше `Authorization: Bearer <token>`.

## Запуск

См. корневой [README.md](../README.md): `docker compose up --build` или локальный venv + `npm run dev`.

OpenAPI: `http://localhost:8000/docs`.

## Версии библиотек

- Backend: [backend/requirements.txt](../backend/requirements.txt)
- Frontend: [frontend/package.json](../frontend/package.json) (Next 16, React 19, Tailwind 4)
