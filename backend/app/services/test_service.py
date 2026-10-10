import json
import random
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    Candidate,
    Category,
    GradeLevel,
    TestAttempt,
    TestQuestion,
)
from app.services.plagiarism_service import plagiarism_similarity

settings = get_settings()
PASS_THRESHOLD = 0.6


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def assert_grade_change_allowed(candidate: Candidate, target_grade: GradeLevel) -> None:
    """Кулдаун 90 дней на смену подтверждённого грейда (пересдача того же — ок)."""
    if candidate.confirmed_grade is None or target_grade == candidate.confirmed_grade:
        return
    if not candidate.last_grade_change_at:
        return
    cooldown = timedelta(days=settings.grade_change_cooldown_days)
    last = _ensure_utc(candidate.last_grade_change_at)
    elapsed = datetime.now(timezone.utc) - last
    if elapsed < cooldown:
        days_left = (cooldown - elapsed).days + 1
        raise HTTPException(
            400,
            f"Смена грейда доступна через {days_left} дн. (лимит {settings.grade_change_cooldown_days} дн.)",
        )


def abandon_open_attempts(db: Session, candidate_id: int) -> None:
    """Закрыть незавершённые попытки — нельзя копить старты под обход кулдауна."""
    now = datetime.now(timezone.utc)
    open_attempts = (
        db.query(TestAttempt)
        .filter(TestAttempt.candidate_id == candidate_id, TestAttempt.finished_at.is_(None))
        .all()
    )
    for attempt in open_attempts:
        attempt.finished_at = now
        attempt.passed = False
        if attempt.score is None:
            attempt.score = 0.0


def start_test(db: Session, candidate: Candidate) -> TestAttempt:
    if not candidate.specialization or not candidate.selected_grade:
        raise HTTPException(400, "Сначала пройдите опрос (отрасль, специализация, грейд)")

    assert_grade_change_allowed(candidate, candidate.selected_grade)

    category = (
        db.query(Category)
        .filter(
            Category.specialization == candidate.specialization,
            Category.grade == candidate.selected_grade,
        )
        .first()
    )
    if not category:
        raise HTTPException(404, "Категория не найдена")

    questions = db.query(TestQuestion).filter(TestQuestion.category_id == category.id).all()
    if not questions:
        raise HTTPException(404, "Нет заданий для этой категории")

    # Одна активная попытка: предыдущие незавершённые аннулируем
    abandon_open_attempts(db, candidate.id)

    # Anti-leak: pick a random variant group, then take up to 5 questions from it
    groups = list({q.variant_group for q in questions})
    variant = random.choice(groups)
    pool = [q for q in questions if q.variant_group == variant]
    selected = random.sample(pool, min(5, len(pool)))

    attempt = TestAttempt(
        candidate_id=candidate.id,
        category_id=category.id,
        variant_group=variant,
        question_ids_json=json.dumps([q.id for q in selected]),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def get_attempt_questions(db: Session, attempt: TestAttempt) -> list[TestQuestion]:
    ids = json.loads(attempt.question_ids_json)
    questions = db.query(TestQuestion).filter(TestQuestion.id.in_(ids)).all()
    by_id = {q.id: q for q in questions}
    return [by_id[i] for i in ids if i in by_id]


def submit_test(
    db: Session,
    candidate: Candidate,
    attempt_id: int,
    answers: dict[int, int],
) -> TestAttempt:
    attempt = (
        db.query(TestAttempt)
        .filter(TestAttempt.id == attempt_id, TestAttempt.candidate_id == candidate.id)
        .first()
    )
    if not attempt:
        raise HTTPException(404, "Попытка не найдена")
    if attempt.finished_at:
        raise HTTPException(400, "Тест уже сдан")

    questions = get_attempt_questions(db, attempt)
    if not questions:
        raise HTTPException(400, "Нет вопросов в попытке")

    correct = 0
    for q in questions:
        if answers.get(q.id) == q.correct_index:
            correct += 1

    score = correct / len(questions)
    passed = score >= PASS_THRESHOLD

    attempt.answers_json = json.dumps({str(k): v for k, v in answers.items()})
    attempt.score = round(score * 100, 1)
    attempt.passed = passed
    attempt.finished_at = datetime.now(timezone.utc)
    attempt.plagiarism_score = plagiarism_similarity(db, attempt, answers)
    if attempt.plagiarism_score >= 0.85:
        attempt.proctor_flagged = True
    if attempt.proctor_blur_count >= 5 or attempt.proctor_paste_count >= 2:
        attempt.proctor_flagged = True

    candidate.test_score = attempt.score
    if passed:
        category = db.query(Category).filter(Category.id == attempt.category_id).first()
        if not category:
            raise HTTPException(400, "Категория попытки не найдена")
        # Грейд результата — только из категории начатого теста, не из текущего опроса
        result_grade = category.grade
        assert_grade_change_allowed(candidate, result_grade)
        candidate.confirmed_grade = result_grade
        candidate.selected_grade = result_grade
        candidate.specialization = category.specialization
        candidate.category_id = attempt.category_id
        candidate.last_grade_change_at = datetime.now(timezone.utc)
    # Failed: keep previous confirmed_grade / category

    db.commit()
    db.refresh(attempt)
    return attempt


def record_proctor_event(db: Session, candidate: Candidate, attempt_id: int, event: str) -> TestAttempt:
    attempt = (
        db.query(TestAttempt)
        .filter(TestAttempt.id == attempt_id, TestAttempt.candidate_id == candidate.id)
        .first()
    )
    if not attempt or attempt.finished_at:
        raise HTTPException(404, "Попытка не найдена или уже завершена")
    if event in ("blur", "visibility"):
        attempt.proctor_blur_count += 1
    elif event == "paste":
        attempt.proctor_paste_count += 1
    if attempt.proctor_blur_count >= 5 or attempt.proctor_paste_count >= 2:
        attempt.proctor_flagged = True
    db.commit()
    db.refresh(attempt)
    return attempt


def grade_label(g: GradeLevel | None) -> str:
    mapping = {
        GradeLevel.JUNIOR: "Junior",
        GradeLevel.MIDDLE: "Middle",
        GradeLevel.SENIOR: "Senior",
    }
    return mapping.get(g, "—") if g else "—"
