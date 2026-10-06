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

## Локальная разработка (без Docker)

По умолчанию используется **SQLite** (`backend/fsp_match.db`) — можно стартовать сразу.

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

Для Postgres: поднимите `docker compose up -d db` и в `backend/.env` поставьте  
`DATABASE_URL=postgresql+psycopg2://fsp:fsp@localhost:5432/fsp_match`.

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
docs/                 # доки механик (для Product)
```

## API (кратко)

- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`
- Кандидат: `/api/candidate/profile`, `/survey`, `/test/start`, `/test/submit`
- Работодатель: `/api/employer/company`, `/needs`, `/match`, `/categories`, `/invitations`
- Приглашения кандидата: `/api/invitations/incoming`, `PATCH /api/invitations/{id}`

Полный OpenAPI: `/docs`.

## Механики MVP

- **Тест:** банк A/B-вариантов (антислив), порог 60%, кулдаун смены грейда 90 дней, без принудительного понижения  
- **Подбор:** ранг = `test_score × 0.7 + fsp_score × 0.3`, текст `reason`  
- **Контакты:** скрыты до `accepted`  
- **ФСП:** заглушка achievements по `fsp_id`; кейс «истории нет» обработан  

## Кто что пилит (из ТЗ)

1. Product — механики, сиды, питч, доки  
2. Backend lead — auth, модели, тест, категории  
3. Backend match — подборка, приглашения  
4. Frontend кандидат  
5. Frontend работодатель + Docker  

Код-скелет уже разложен по этим контурам — можно сразу дописывать.

## Preview на Vercel (фронт)

Каждый push / PR → отдельная ссылка превью UI.

1. Открой [vercel.com/new](https://vercel.com/new) и импортируй репо `Daniel123912/invite-match`
2. **Root Directory:** `frontend` (важно)
3. Framework: Next.js (подхватится сам)
4. Environment Variable:
   - `NEXT_PUBLIC_API_URL` = URL бэкенда (пока можно оставить пустым / локальный API не откроется из браузера на Vercel)
5. Deploy

После первого деплоя включи **Automatic deployments** для ветки `main` и Preview для PR — в каждом PR появится комментарий со ссылкой.

Локально: скопируй `frontend/.env.example` → `frontend/.env.local`.

CORS на бэкенде уже пускает `https://*.vercel.app`. Когда появится публичный API — пропиши его в `NEXT_PUBLIC_API_URL` в настройках Vercel и сделай Redeploy.
