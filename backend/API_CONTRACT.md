# API-контракт для фронта

База: `NEXT_PUBLIC_API_URL` + префикс `/api`. Auth: `Authorization: Bearer <token>`.

Swagger: `http://localhost:8001/docs` (локально)

## Auth

| Метод | Путь | Тело | Ответ |
|-------|------|------|-------|
| GET | `/auth/check-email?email=` | — | `{ available }` (rate limit) |
| POST | `/auth/register` | `{ email, password (≥8, буква+цифра), role, full_name, consent_152fz: true, … }` | `{ message, email, email_confirm_token? }` — **без JWT** |
| POST | `/auth/confirm-email` | `{ token }` | token + role (TTL токена, в БД только hash) |
| POST | `/auth/resend-confirmation?email=` | — | всегда одинаковый `message` (без enumeration) |
| POST | `/auth/login` | form: `username`=email, `password` | token + role (нужен подтверждённый email; rate limit) |
| GET | `/auth/me` | — | user |
| GET | `/fsp/{fsp_id}/achievements` | — | заглушка достижений ФСП |

`role`: `candidate` \| `employer`

`email_confirm_token` в ответе — **только** если `EXPOSE_EMAIL_CONFIRM_TOKEN=true` (локально без SMTP). В проде не включать.

При регистрации кандидата `privacy_public=false` (в подборку — явный opt-in в настройках).

## Кандидат

| Метод | Путь | Назначение |
|-------|------|------------|
| GET/PATCH | `/candidate/profile` | резюме, FSP ID, privacy, 152-ФЗ |
| POST | `/candidate/survey` | `{ industry, specialization, selected_grade }` |
| POST | `/candidate/test/start` | старт: вариант **A или B** целиком (без mixed) |
| POST | `/candidate/test/submit` | `{ attempt_id, answers }` — при прокторинг-флаге категория не присваивается |
| GET | `/candidate/category` | категория / грейд / кулдаун |
| GET | `/candidate/test/history` | история попыток |
| POST | `/candidate/sandbox/run` | песочница: `{ code, stdin?, language? }` — `python` \| `javascript` \| `sql` (rate limit) |
| GET | `/invitations/incoming` | входящие (зарплата + gross/net) |
| PATCH | `/invitations/{id}` | `{ status: "accepted" \| "declined" }` |
| PATCH | `/candidate/invitations/{id}/contacts` | `{ revoke: true }` |

### Справочники

- `specialization`: backend, frontend, fullstack, devops, data, qa, mobile  
- `grade`: junior, middle, senior  
- `industry`: it, fintech, ecommerce, edtech, healthtech, other  

### Правила

- Категория только после опроса + успешного теста (≥60%) **и** без прокторинг-флага.
- Антислив: вопросы строго одной `variant_group` (A/B), без смеси.
- Смена грейда — не чаще 1 раза в 90 дней.
- **152-ФЗ:** регистрация только с `consent_152fz`; профиль скрыт из match по умолчанию.
- Контакты работодателю — после `accepted`, пока не отозваны.
- Пустой FSP ID → `has_fsp_history=false`, ранжирование по тесту.
- Зарплата в приглашении: `salary_from` / `salary_to` + `salary_gross` (по умолчанию gross).

Подробнее: `PRIVACY_152FZ.md`, `docs/test.md`, `docs/match.md`.

## Работодатель (кратко)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET/PUT | `/employer/company` | профиль компании |
| POST/GET | `/employer/needs` | потребность (зарплата от–до + gross) |
| GET | `/employer/match` | подборка + `reason` + маски контактов |
| GET | `/employer/candidates/{id}` | карточка кандидата (резюме/стек/тест; контакты в масках до accept) |
| GET | `/employer/candidates/{id}/resume/file` | файл резюме (PDF/DOCX) |
| GET | `/employer/candidates/{id}/resume/preview` | HTML-превью DOCX |
| POST/GET | `/employer/invitations` | исходящие приглашения |

Контакты в ответах: `phone`/`email`/`telegram` пустые до accept; UI-маски в `phone_display` / `email_display` / `telegram_display`. В тексте резюме/about ПДн тоже маскируются, пока контакты не раскрыты.

## Демо (только при `ALLOW_DEMO_SEED=true`)

| Email | Пароль | Роль |
|-------|--------|------|
| `new@demo.ru` | `demo1234` (или `DEMO_PASSWORD`) | пустой кандидат → опрос → тест |
| `candidate@demo.ru` | то же | уже с категорией |
| `employer@demo.ru` | то же | работодатель |

В проде: `DEBUG=false`, уникальный `SECRET_KEY` ≥32, `EXPOSE_EMAIL_CONFIRM_TOKEN=false`, `ALLOW_DEMO_SEED=false`, без `CORS_ORIGIN_REGEX`.
