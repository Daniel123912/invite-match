# Описание API

## Базовый URL

- Локально: `http://localhost:8000`
- Префикс REST: `/api`
- Интерактивная спецификация: **`/docs`** (OpenAPI 3, Swagger UI)
- Health: `GET /health`

## Аутентификация

JWT Bearer после `POST /api/auth/login` (form: `username`=email, `password`) или `POST /api/auth/register`.

Заголовок: `Authorization: Bearer <access_token>`.

## Основные группы

| Группа | Префикс | Роль |
|--------|---------|------|
| Auth | `/api/auth` | все |
| Кандидат | `/api/candidate` | candidate |
| Работодатель | `/api/employer` | employer |
| Приглашения | `/api/invitations` | candidate (входящие) |

## Ключевые контракты

Подробная таблица для фронта: `backend/API_CONTRACT.md`.

Примеры:

```http
POST /api/candidate/survey
{ "industry": "it", "specialization": "backend", "selected_grade": "middle" }

POST /api/candidate/test/submit
{ "attempt_id": 1, "answers": { "12": 2, "13": 0 } }

GET /api/employer/match?specialization=backend&grade=middle&stack=Python

POST /api/employer/invitations
{ "candidate_id": 1, "message": "...", "salary_from": 200000, "salary_to": 350000 }
```

## Ошибки

Стандартные HTTP-коды FastAPI: `400` валидация/бизнес-правила, `401`/`403` auth, `404` не найдено.

## Версия

Версия приложения в OpenAPI: `0.1.0` (`backend/app/main.py`).
