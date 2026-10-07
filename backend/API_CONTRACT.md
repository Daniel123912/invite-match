# API-контракт для фронта (кабинет кандидата)

База: `NEXT_PUBLIC_API_URL` + префикс `/api`. Auth: `Authorization: Bearer <token>`.

Swagger: `http://localhost:8000/docs`

## Auth

| Метод | Путь | Тело | Ответ |
|-------|------|------|-------|
| POST | `/auth/register` | `{ email, password, role, full_name, consent_152fz: true }` | token + role |
| POST | `/auth/login` | form: `username`=email, `password` | token + role |
| GET | `/auth/me` | — | user |

`role`: `candidate` \| `employer`

## Кандидат

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/candidate/profile` | профиль |
| PATCH | `/candidate/profile` | резюме, FSP ID, privacy, 152-ФЗ |
| POST | `/candidate/survey` | `{ industry, specialization, selected_grade }` |
| POST | `/candidate/test/start` | старт теста (антислив A/B) |
| POST | `/candidate/test/submit` | `{ attempt_id, answers: { question_id: optionIndex } }` |
| GET | `/candidate/category` | текущая категория / грейд / кулдаун |
| GET | `/candidate/test/history` | история попыток |
| GET | `/invitations/incoming` | входящие (зарплата видна) |
| PATCH | `/invitations/{id}` | `{ status: "accepted" \| "declined" }` |
| PATCH | `/candidate/invitations/{id}/contacts` | `{ revoke: true }` — отозвать контакты |

### Справочники (enum)

- `specialization`: backend, frontend, fullstack, devops, data, qa, mobile  
- `grade`: junior, middle, senior  
- `industry`: it, fintech, ecommerce, edtech, healthtech, other  

### Правила

- Категория только после опроса + успешного теста (≥60%).
- Смена грейда — не чаще 1 раза в 90 дней.
- **152-ФЗ:** регистрация и обработка ПДн только с `consent_152fz`.
- Без согласия: нет опроса/теста, нет в подборке, нельзя публиковать профиль.
- Контакты работодателю открываются только после `accepted` и пока согласие живо / доступ не отозван.
- Пустой FSP ID / нет достижений → `has_fsp_history=false`, ранжирование по тесту.

Подробнее: `PRIVACY_152FZ.md`.

## Демо

| Email | Пароль | Роль |
|-------|--------|------|
| `new@demo.ru` | `demo1234` | пустой кандидат → опрос → тест |
| `candidate@demo.ru` | `demo1234` | уже с категорией |
