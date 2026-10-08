# FSP Match Platform

Веб-платформа подбора ИТ-специалистов (ФСП спец. трек): кандидат проходит опрос + тест → получает категорию; работодатель находит категорию и приглашает.

## Стек

| Слой | Технология |
|------|------------|
| Frontend | Next.js 16 + TypeScript + Tailwind |
| Backend | FastAPI + SQLAlchemy |
| БД | PostgreSQL 16 |
| Auth | JWT (python-jose + passlib/bcrypt) |
| Деплой | Docker Compose |

## Быстрый старт (Docker)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000  
- API / Swagger: http://localhost:8000/docs  
- Health: http://localhost:8000/health  

## Локальная разработка (PostgreSQL + pgAdmin)

БД — **локальный PostgreSQL** (через pgAdmin 4). Docker для БД не обязателен.

### 0. База в pgAdmin

1. Убедитесь, что служба PostgreSQL запущена (у вас может быть 16 или 18).
2. Откройте pgAdmin → сервер → Query Tool под пользователем `postgres`.
3. Выполните скрипт [`backend/scripts/init_pg.sql`](backend/scripts/init_pg.sql)  
   (создаёт роль `fsp` / пароль `fsp` и БД `fsp_talent_db`).

   Если `\gexec` в вашей версии pgAdmin не сработает, вручную:

   ```sql
   CREATE ROLE fsp LOGIN PASSWORD 'fsp';
   CREATE DATABASE fsp_talent_db OWNER fsp;
   ```

4. В `backend/.env` должен быть URL:

   `DATABASE_URL=postgresql+psycopg2://fsp:fsp@localhost:5432/fsp_talent_db`

   Либо свой пользователь/пароль из pgAdmin — подставьте в URL.

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Альтернатива: весь стек в Docker — `docker compose up --build` (там Postgres внутри Compose).

## Демо-аккаунты (после seed)

| Email | Пароль | Роль |
|-------|--------|------|
| `employer@demo.ru` | `demo1234` | Работодатель |
| `candidate@demo.ru` | `demo1234` | Кандидат (Backend Middle + ФСП) |
| `new@demo.ru` | `demo1234` | Пустой кандидат → опрос → тест |
| `cand2@demo.ru` … | `demo1234` | Ещё кандидаты в подборке |

FSP ID для демо: `FSP-1001`, `FSP-1002`, `FSP-2001`.

## Сквозной сценарий

1. Войти как `new@demo.ru` → профиль → опрос → тест → категория  
2. Войти как `employer@demo.ru` → подборка (Backend × Middle) → пригласить с зарплатой  
3. Снова кандидат → принять/отклонить приглашение  
4. У работодателя после accept открываются контакты  

## Структура

```
backend/app/          # FastAPI
  api/routes/         # auth, candidate, employer, invitations
  models/             # SQLAlchemy
  schemas/            # Pydantic
  services/           # тест, матчинг
  core/               # JWT, пароли
frontend/src/app/     # Next.js App Router
  candidate/          # кабинет кандидата
  employer/           # кабинет работодателя
docs/                 # полная документация для сдачи (см. docs/README.md)
```

## API (кратко)

- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`
- Кандидат: `/api/candidate/profile`, `/survey`, `/test/start`, `/test/submit`
- Работодатель: `/api/employer/company`, `/needs`, `/match`, `/categories`, `/invitations`
- Приглашения кандидата: `/api/invitations/incoming`, `PATCH /api/invitations/{id}`

Полный OpenAPI: `/docs`.

## Механики MVP

- **Тест:** банк A/B-вариантов (антислив), канонические вопросы в БД, порог 60%, кулдаун 90 дней, без принудительного понижения  
- **Подбор:** ранг = `test_score × 0.7 + fsp_score × 0.3`, текст `reason`, неподтверждённый грейд виден, но ниже в выдаче  
- **Контакты:** скрыты до `accepted`, можно отозвать после accept  
- **ФСП:** заглушка achievements по `fsp_id`; кейс «истории нет» обработан  

Подробно: [docs/README.md](docs/README.md)

## Кто что пилит (из ТЗ)

1. Product — механики, сиды, питч, доки  
2. Backend lead — auth, модели, тест, категории  
3. Backend match — подборка, приглашения  
4. Frontend кандидат  
5. Frontend работодатель + Docker  

Код-скелет уже разложен по этим контурам — можно сразу дописывать.

## Preview на Vercel (фронт)

**Публичная ссылка для команды (без логина):**  
https://invite-match-daniel123912.vercel.app

Альтернатива: https://invite-match-sooty.vercel.app

Deployment Protection / Vercel Auth выключены — открывается в браузере у всех.

Каждый push / PR → отдельная preview-ссылка в комментарии к PR (если репо подключено к проекту Vercel с Root Directory = `frontend`).

Локально: скопируй `frontend/.env.example` → `frontend/.env.local`.

CORS на бэкенде уже пускает `https://*.vercel.app`. Когда появится публичный API — пропиши `NEXT_PUBLIC_API_URL` в настройках Vercel и сделай Redeploy. До тех пор на preview работает UI, а логин/API — только с локальным бэкендом.
