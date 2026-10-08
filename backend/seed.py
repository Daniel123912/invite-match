"""Seed demo data: categories, test questions, demo users, FSP achievements."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from datetime import datetime, timezone

from app.core.security import hash_password
from app.database import Base, SessionLocal, engine
from app.db_migrate import ensure_columns
from app.models import (
    Candidate,
    Category,
    Company,
    Employer,
    EmployerNeed,
    FspAchievement,
    GradeLevel,
    Industry,
    Specialization,
    TestQuestion,
    User,
    UserRole,
)

# ── Question bank (anti-leak: A/B variants) ───────────

BACKEND_JUNIOR = [
    {
        "variant_group": "A",
        "topic": "HTTP",
        "text": "Какой HTTP-метод идемпотентен и обычно используется для получения ресурса?",
        "options": ["POST", "GET", "PATCH", "CONNECT"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "A",
        "topic": "SQL",
        "text": "Какой оператор выбирает уникальные значения?",
        "options": ["UNIQUE SELECT", "SELECT DISTINCT", "SELECT ONLY", "SELECT UNIQUE"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "A",
        "topic": "Python",
        "text": "Что вернёт len([1, 2, 3])?",
        "options": ["2", "3", "4", "Ошибку"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "A",
        "topic": "Git",
        "text": "Какая команда создаёт новую ветку и переключается на неё?",
        "options": ["git branch -d", "git checkout -b", "git merge", "git stash"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "A",
        "topic": "REST",
        "text": "Код ответа при успешном создании ресурса чаще всего:",
        "options": ["200", "201", "204", "301"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "B",
        "topic": "HTTP",
        "text": "Какой статус означает «не найдено»?",
        "options": ["400", "401", "403", "404"],
        "correct_index": 3,
        "difficulty": 1,
    },
    {
        "variant_group": "B",
        "topic": "SQL",
        "text": "Какой JOIN возвращает только совпадающие строки из обеих таблиц?",
        "options": ["LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL OUTER JOIN"],
        "correct_index": 2,
        "difficulty": 1,
    },
    {
        "variant_group": "B",
        "topic": "Python",
        "text": "Как объявить словарь в Python?",
        "options": ["[]", "()", "{}", "set()"],
        "correct_index": 2,
        "difficulty": 1,
    },
    {
        "variant_group": "B",
        "topic": "Git",
        "text": "Команда для отправки коммитов на удалённый репозиторий:",
        "options": ["git pull", "git fetch", "git push", "git clone"],
        "correct_index": 2,
        "difficulty": 1,
    },
    {
        "variant_group": "B",
        "topic": "REST",
        "text": "PUT обычно используется для:",
        "options": ["Частичного обновления", "Полной замены ресурса", "Удаления", "Поиска"],
        "correct_index": 1,
        "difficulty": 1,
    },
]

BACKEND_MIDDLE = [
    {
        "variant_group": "A",
        "topic": "Architecture",
        "text": "Что такое идемпотентность API?",
        "options": [
            "Запрос всегда быстрый",
            "Повторный запрос даёт тот же эффект",
            "Запрос без тела",
            "Только GET-эндпоинты",
        ],
        "correct_index": 1,
        "difficulty": 2,
    },
    {
        "variant_group": "A",
        "topic": "DB",
        "text": "N+1 проблема возникает когда:",
        "options": [
            "Слишком много индексов",
            "На каждую строку делается отдельный запрос",
            "Нет транзакций",
            "Используется NoSQL",
        ],
        "correct_index": 1,
        "difficulty": 2,
    },
    {
        "variant_group": "A",
        "topic": "Auth",
        "text": "JWT хранит данные пользователя в:",
        "options": ["Серверной сессии", "Самом токене (payload)", "Только в Redis", "Cookie HttpOnly обязательно"],
        "correct_index": 1,
        "difficulty": 2,
    },
    {
        "variant_group": "A",
        "topic": "Caching",
        "text": "Cache-Aside означает:",
        "options": [
            "Кэш пишет БД сам",
            "Приложение читает кэш, при miss — БД и пишет в кэш",
            "Только CDN",
            "Отключение кэша",
        ],
        "correct_index": 1,
        "difficulty": 2,
    },
    {
        "variant_group": "A",
        "topic": "Concurrency",
        "text": "Гонка данных (race condition) — это:",
        "options": [
            "Медленный SQL",
            "Результат зависит от порядка параллельных операций",
            "Ошибка DNS",
            "Утечка памяти",
        ],
        "correct_index": 1,
        "difficulty": 2,
    },
    {
        "variant_group": "B",
        "topic": "Architecture",
        "text": "CQRS разделяет:",
        "options": ["Frontend и Backend", "Чтение и запись", "SQL и NoSQL", "Sync и Async только"],
        "correct_index": 1,
        "difficulty": 2,
    },
    {
        "variant_group": "B",
        "topic": "DB",
        "text": "Индекс B-Tree лучше всего для:",
        "options": ["Полного скана", "Диапазонных и equality-запросов", "Только JSON", "Только full-text"],
        "correct_index": 1,
        "difficulty": 2,
    },
    {
        "variant_group": "B",
        "topic": "Auth",
        "text": "Refresh token обычно нужен чтобы:",
        "options": [
            "Шифровать пароль",
            "Обновлять access token без повторного логина",
            "Хранить роли в URL",
            "Заменить HTTPS",
        ],
        "correct_index": 1,
        "difficulty": 2,
    },
    {
        "variant_group": "B",
        "topic": "Caching",
        "text": "TTL в кэше — это:",
        "options": ["Тип данных", "Время жизни записи", "Размер ключа", "Алгоритм хеширования"],
        "correct_index": 1,
        "difficulty": 2,
    },
    {
        "variant_group": "B",
        "topic": "Concurrency",
        "text": "Optimistic locking опирается на:",
        "options": ["Долгие блокировки строк", "Версию/версионирование записи", "Только mutex", "Один поток"],
        "correct_index": 1,
        "difficulty": 2,
    },
]

FRONTEND_JUNIOR = [
    {
        "variant_group": "A",
        "topic": "JS",
        "text": "typeof null в JavaScript:",
        "options": ["null", "undefined", "object", "number"],
        "correct_index": 2,
        "difficulty": 1,
    },
    {
        "variant_group": "A",
        "topic": "React",
        "text": "Хук для состояния в функциональном компоненте:",
        "options": ["useFetch", "useState", "useClass", "useStoreOnly"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "A",
        "topic": "CSS",
        "text": "flex-direction: column располагает элементы:",
        "options": ["В ряд", "В колонку", "По диагонали", "Абсолютно"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "A",
        "topic": "HTML",
        "text": "Семантический тег для навигации:",
        "options": ["<div>", "<nav>", "<span>", "<section id=nav>"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "A",
        "topic": "HTTP",
        "text": "CORS нужен для:",
        "options": [
            "Сжатия картинок",
            "Контроля кросс-доменных запросов браузером",
            "Кэширования CSS",
            "SSR",
        ],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "B",
        "topic": "JS",
        "text": "=== сравнивает:",
        "options": ["Только значение", "Значение и тип", "Только ссылки", "Хеши"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "B",
        "topic": "React",
        "text": "useEffect без массива зависимостей выполняется:",
        "options": ["Никогда", "После каждого рендера", "Только при unmount", "Раз в жизнь приложения"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "B",
        "topic": "CSS",
        "text": "Единица rem относительно:",
        "options": ["Родителя", "Корневого шрифта", "Viewport width", "Экрана"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "B",
        "topic": "HTML",
        "text": "Атрибут alt у <img> нужен для:",
        "options": ["SEO только", "Доступности и fallback-текста", "Размера", "Ленивой загрузки"],
        "correct_index": 1,
        "difficulty": 1,
    },
    {
        "variant_group": "B",
        "topic": "TS",
        "text": "Тип unknown отличается от any тем, что:",
        "options": [
            "Это то же самое",
            "Перед использованием нужна проверка типа",
            "Только для чисел",
            "Запрещён в React",
        ],
        "correct_index": 1,
        "difficulty": 1,
    },
]

QUESTIONS_BY_CAT = {
    (Specialization.BACKEND, GradeLevel.JUNIOR): BACKEND_JUNIOR,
    (Specialization.BACKEND, GradeLevel.MIDDLE): BACKEND_MIDDLE,
    (Specialization.BACKEND, GradeLevel.SENIOR): BACKEND_MIDDLE,  # reuse for demo
    (Specialization.FRONTEND, GradeLevel.JUNIOR): FRONTEND_JUNIOR,
    (Specialization.FRONTEND, GradeLevel.MIDDLE): FRONTEND_JUNIOR,
    (Specialization.FRONTEND, GradeLevel.SENIOR): FRONTEND_JUNIOR,
}


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    consent_at = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        if db.query(Category).count() > 0:
            print("Already seeded — skip")
            return

        # Categories
        specs = [Specialization.BACKEND, Specialization.FRONTEND]
        grades = [GradeLevel.JUNIOR, GradeLevel.MIDDLE, GradeLevel.SENIOR]
        categories: dict[tuple, Category] = {}
        for spec in specs:
            for grade in grades:
                title = f"{spec.value.capitalize()} × {grade.value.capitalize()}"
                cat = Category(
                    specialization=spec,
                    grade=grade,
                    title=title,
                    description=f"Категория {title} после подтверждения тестом",
                )
                db.add(cat)
                db.flush()
                categories[(spec, grade)] = cat

                for q in QUESTIONS_BY_CAT.get((spec, grade), BACKEND_JUNIOR):
                    db.add(
                        TestQuestion(
                            category_id=cat.id,
                            variant_group=q["variant_group"],
                            topic=q["topic"],
                            text=q["text"],
                            options_json=json.dumps(q["options"], ensure_ascii=False),
                            correct_index=q["correct_index"],
                            difficulty=q["difficulty"],
                        )
                    )

        # FSP achievements stub
        for fsp_id, items in {
            "FSP-1001": [("Чемпионат ФСП 2025 — финалист", 40), ("Хакатон — 1 место", 30)],
            "FSP-1002": [("Региональный этап — призёр", 25)],
            "FSP-2001": [("Всероссийский турнир — участник", 15)],
        }.items():
            for title, points in items:
                db.add(FspAchievement(fsp_id=fsp_id, title=title, points=points))

        # Demo employer
        emp_user = User(
            email="employer@demo.ru",
            hashed_password=hash_password("demo1234"),
            role=UserRole.EMPLOYER,
        )
        db.add(emp_user)
        db.flush()
        company = Company(
            name="ДемоТех",
            description="IT-компания для демо хакатона. Разрабатываем B2B SaaS для подбора.",
            website="https://example.com",
            industry=Industry.IT,
            city="Москва",
            verified=True,
            verification_note="Демо: компания проверена",
        )
        db.add(company)
        db.flush()
        employer = Employer(
            user_id=emp_user.id,
            full_name="Анна Работодатель",
            company_id=company.id,
            consent_152fz=True,
            consent_152fz_at=consent_at,
        )
        db.add(employer)
        db.flush()
        db.add(
            EmployerNeed(
                employer_id=employer.id,
                title="Backend Middle Python",
                specialization=Specialization.BACKEND,
                grade=GradeLevel.MIDDLE,
                stack="Python, FastAPI, PostgreSQL",
                description="Нужен разработчик API для платформы подбора. Стек Python/FastAPI, опыт от 2 лет.",
                salary_from=200000,
                salary_to=350000,
                salary_gross=True,
            )
        )

        from app.models import EmployerTask, EmployerTaskType
        from scripts.ensure_demo_task import CODE_TASKS

        for item in CODE_TASKS:
            db.add(
                EmployerTask(
                    employer_id=employer.id,
                    title=item["title"],
                    task_type=EmployerTaskType.CODE,
                    prompt=item["prompt"],
                    expected_stdout=item["expected_stdout"],
                )
            )

        # Demo candidates (pre-categorized for employer match demo)
        demo_candidates = [
            ("candidate@demo.ru", "Иван Кандидат", Specialization.BACKEND, GradeLevel.MIDDLE, "Python, FastAPI, SQL", "FSP-1001", 85.0),
            ("cand2@demo.ru", "Мария Петрова", Specialization.BACKEND, GradeLevel.MIDDLE, "Python, Django, Redis", "FSP-1002", 72.0),
            ("cand3@demo.ru", "Олег Сидоров", Specialization.BACKEND, GradeLevel.MIDDLE, "Go, PostgreSQL", None, 90.0),
            ("cand4@demo.ru", "Елена Код", Specialization.FRONTEND, GradeLevel.JUNIOR, "React, TypeScript", "FSP-2001", 78.0),
            ("cand5@demo.ru", "Павел Нов", Specialization.FRONTEND, GradeLevel.JUNIOR, "Vue, JS", None, 65.0),
        ]

        for email, name, spec, grade, stack, fsp_id, score in demo_candidates:
            u = User(email=email, hashed_password=hash_password("demo1234"), role=UserRole.CANDIDATE)
            db.add(u)
            db.flush()
            cat = categories[(spec, grade)]
            fsp_score = 0.0
            has_fsp = False
            if fsp_id:
                ach = db.query(FspAchievement).filter(FspAchievement.fsp_id == fsp_id).all()
                fsp_score = sum(a.points for a in ach)
                has_fsp = bool(ach)
            db.add(
                Candidate(
                    user_id=u.id,
                    full_name=name,
                    city="Москва",
                    about=f"Демо-профиль: {name}",
                    stack=stack,
                    industry=Industry.IT,
                    specialization=spec,
                    selected_grade=grade,
                    confirmed_grade=grade,
                    category_id=cat.id,
                    test_score=score,
                    fsp_id=fsp_id,
                    fsp_score=fsp_score,
                    has_fsp_history=has_fsp,
                    privacy_public=True,
                    consent_152fz=True,
                    consent_152fz_at=consent_at,
                    phone="+79001112233" if email == "candidate@demo.ru" else None,
                    telegram="@demo_cand" if email == "candidate@demo.ru" else None,
                )
            )

        # Fresh candidate without category (for full flow demo)
        fresh = User(
            email="new@demo.ru",
            hashed_password=hash_password("demo1234"),
            role=UserRole.CANDIDATE,
        )
        db.add(fresh)
        db.flush()
        db.add(
            Candidate(
                user_id=fresh.id,
                full_name="Новый Кандидат",
                consent_152fz=True,
                consent_152fz_at=consent_at,
            )
        )

        db.commit()
        print("Seed OK")
        print("  employer@demo.ru / demo1234")
        print("  candidate@demo.ru / demo1234  (Backend Middle, FSP)")
        print("  new@demo.ru / demo1234        (empty profile -> survey -> test)")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
