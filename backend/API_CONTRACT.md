# API-контракт для фронта

База: `NEXT_PUBLIC_API_URL` + префикс `/api`. Auth: `Authorization: Bearer <token>`.

Swagger: `http://localhost:8000/docs`

## Auth

| Метод | Путь | Тело | Ответ |
|-------|------|------|-------|
| GET | `/auth/check-email?email=` | — | `{ available }` |
| POST | `/auth/register` | `{ email, password (≥6), role, full_name, consent_152fz: true, … }` | `{ message, email, email_confirm_token? }` — **без JWT** |
| POST | `/auth/confirm-email` | `{ token }` | token + role |
| POST | `/auth/resend-confirmation?email=` | — | новый токен (в DEBUG) |
| POST | `/auth/login` | form: `username`=email, `password` | token + role (нужен подтверждённый email) |
| GET | `/auth/me` | — | user |
| GET | `/fsp/{fsp_id}/achievements` | — | заглушка достижений ФСП |

`role`: `candidate` \| `employer`

В DEBUG токен подтверждения возвращается в ответе register (без SMTP).

## Кандидат

| Метод | Путь | Назначение |
|-------|------|------------|
| GET/PATCH | `/candidate/profile` | резюме, FSP ID, privacy, 152-ФЗ |
| POST | `/candidate/survey` | `{ industry, specialization, selected_grade }` |
| POST | `/candidate/test/start` | старт: вариант **A или B** целиком |
| POST | `/candidate/test/submit` | `{ attempt_id, answers }` |
| GET | `/candidate/category` | категория / грейд / кулдаун |
| GET | `/candidate/test/history` | история попыток |
| GET | `/invitations/incoming` | входящие (зарплата + gross/net) |
| PATCH | `/invitations/{id}` | `{ status: "accepted" \| "declined" }` |
| PATCH | `/candidate/invitations/{id}/contacts` | `{ revoke: true }` |

### Справочники

- `specialization`: backend, frontend, fullstack, devops, data, qa, mobile  
- `grade`: junior, middle, senior  
- `industry`: it, fintech, ecommerce, edtech, healthtech, other  

### Правила

- Категория только после опроса + успешного теста (≥60%).
- Антислив: вопросы одной `variant_group` (A/B), не смесь, если банк позволяет.
- Смена грейда — не чаще 1 раза в 90 дней.
- **152-ФЗ:** регистрация только с `consent_152fz`.
- Контакты работодателю — после `accepted`, пока не отозваны.
- Пустой FSP ID → `has_fsp_history=false`, ранжирование по тесту.
- Зарплата в приглашении: `salary_from` / `salary_to` + `salary_gross` (по умолчанию gross).

Подробнее: `PRIVACY_152FZ.md`, `docs/test.md`, `docs/match.md`.

## Работодатель (кратко)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET/PUT | `/employer/company` | профиль компании |
| POST/GET | `/employer/needs` | потребность (зарплата от–до + gross) |
| GET | `/employer/match` | подборка + `reason` |
| POST/GET | `/employer/invitations` | исходящие приглашения |

## Демо

| Email | Пароль | Роль |
|-------|--------|------|
| `new@demo.ru` | `demo1234` | пустой кандидат → опрос → тест |
| `candidate@demo.ru` | `demo1234` | уже с категорией |
| `employer@demo.ru` | `demo1234` | работодатель |
