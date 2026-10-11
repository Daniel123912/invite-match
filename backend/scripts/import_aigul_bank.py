"""Импорт sql/*_TASKS_ONLY.sql + *_ANSWERS_ONLY.sql → таблицы заданий/ответов.

Банки: Айгуль + Луиза. Бланки теста (test_questions) собираются из обоих:
готовые MCQ и открытые Теория/Анализ (через варианты из ключей ответов).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import Base, SessionLocal, engine
from app.db_migrate import ensure_columns
from app.models import Category, GradeLevel, Specialization, TestQuestion
from app.services.aigul_bank import theory_questions_by_category, upsert_raw_tables
from app.services.question_expand import ensure_min_questions


def sync_theory_to_test_questions(db) -> int:
    bank = theory_questions_by_category()
    created = 0
    for (spec_s, grade_s), questions in bank.items():
        try:
            spec = Specialization(spec_s)
            grade = GradeLevel(grade_s)
        except ValueError:
            continue

        cat = (
            db.query(Category)
            .filter(Category.specialization == spec, Category.grade == grade)
            .first()
        )
        if not cat:
            cat = Category(
                specialization=spec,
                grade=grade,
                title=f"{spec.value.capitalize()} × {grade.value.capitalize()}",
                description="Категория после подтверждения тестом",
            )
            db.add(cat)
            db.flush()

        db.query(TestQuestion).filter(TestQuestion.category_id == cat.id).delete()
        for q in questions:
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
            created += 1
    return created


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    db = SessionLocal()
    try:
        n_tasks, n_ans = upsert_raw_tables(db)
        n_q = sync_theory_to_test_questions(db)
        filled = ensure_min_questions(db)
        db.commit()
        print(f"OK: tasks={n_tasks}, answer_keys={n_ans}, theory_synced={n_q}")
        print(f"Per category (>=20): {filled}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
