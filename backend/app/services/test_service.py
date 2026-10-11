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


def get_open_attempt(db: Session, candidate_id: int) -> TestAttempt | None:
    return (
        db.query(TestAttempt)
        .filter(TestAttempt.candidate_id == candidate_id, TestAttempt.finished_at.is_(None))
        .order_by(TestAttempt.id.desc())
        .first()
    )


def _pick_antileak_variant(
    questions: list[TestQuestion], pick: int
) -> tuple[list[TestQuestion], str]:
    """Выдать набор строго из одной группы A/B (антислив, без mixed)."""
    by_group: dict[str, list[TestQuestion]] = {}
    for q in questions:
        group = (q.variant_group or "A").strip() or "A"
        if group.lower() == "mixed":
            continue
        by_group.setdefault(group, []).append(q)

    eligible = [g for g, qs in by_group.items() if len(qs) >= pick]
    if not eligible:
        sizes = ", ".join(f"{g}:{len(qs)}" for g, qs in sorted(by_group.items())) or "пусто"
        raise HTTPException(
            400,
            f"Антислив: нужно ≥{pick} вопросов в одной группе A или B (сейчас: {sizes}). "
            "Запустите seed/import_aigul_bank или ensure_min_questions.",
        )
    variant = random.choice(eligible)
    return random.sample(by_group[variant], pick), variant


def parse_saved_answers(attempt: TestAttempt) -> dict[int, int]:
    if not attempt.answers_json:
        return {}
    try:
        raw = json.loads(attempt.answers_json)
    except json.JSONDecodeError:
        return {}
    out: dict[int, int] = {}
    for k, v in raw.items():
        try:
            out[int(k)] = int(v)
        except (TypeError, ValueError):
            continue
    return out


def start_test(db: Session, candidate: Candidate) -> tuple[TestAttempt, bool]:
    """Вернуть (попытка, resumed). Незавершённую попытку той же категории продолжаем."""
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

    open_attempt = get_open_attempt(db, candidate.id)
    if open_attempt and open_attempt.category_id == category.id:
        return open_attempt, True

    questions = db.query(TestQuestion).filter(TestQuestion.category_id == category.id).all()
    if not questions:
        raise HTTPException(404, "Нет заданий для этой категории")

    pick = settings.test_question_count
    if len(questions) < pick:
        raise HTTPException(
            400,
            f"В категории недостаточно вопросов для теста ({len(questions)}/{pick}). "
            "Запустите seed/import_aigul_bank или ensure_min_questions.",
        )

    # Другая категория / нет открытой — старые незавершённые аннулируем
    abandon_open_attempts(db, candidate.id)

    selected, variant = _pick_antileak_variant(questions, pick)

    attempt = TestAttempt(
        candidate_id=candidate.id,
        category_id=category.id,
        variant_group=variant,
        question_ids_json=json.dumps([q.id for q in selected]),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt, False


def get_attempt_questions(db: Session, attempt: TestAttempt) -> list[TestQuestion]:
    ids = json.loads(attempt.question_ids_json)
    questions = db.query(TestQuestion).filter(TestQuestion.id.in_(ids)).all()
    by_id = {q.id: q for q in questions}
    return [by_id[i] for i in ids if i in by_id]


def save_progress(
    db: Session,
    candidate: Candidate,
    attempt_id: int,
    answers: dict[int, int],
) -> TestAttempt:
    """Сохранить частичные ответы без завершения попытки."""
    attempt = (
        db.query(TestAttempt)
        .filter(TestAttempt.id == attempt_id, TestAttempt.candidate_id == candidate.id)
        .first()
    )
    if not attempt:
        raise HTTPException(404, "Попытка не найдена")
    if attempt.finished_at:
        raise HTTPException(400, "Тест уже сдан")

    allowed = set(json.loads(attempt.question_ids_json))
    merged = parse_saved_answers(attempt)
    for qid, idx in answers.items():
        if qid not in allowed:
            continue
        if not isinstance(idx, int) or idx < 0:
            continue
        merged[qid] = idx

    attempt.answers_json = json.dumps({str(k): v for k, v in merged.items()})
    db.commit()
    db.refresh(attempt)
    return attempt


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
    attempt.finished_at = datetime.now(timezone.utc)
    attempt.plagiarism_score = plagiarism_similarity(db, attempt, answers)
    if attempt.plagiarism_score is not None and attempt.plagiarism_score >= 0.85:
        attempt.proctor_flagged = True
    if attempt.proctor_blur_count >= 5 or attempt.proctor_paste_count >= 2:
        attempt.proctor_flagged = True
    # Прокторинг / антиплагиат: флаг снимает зачёт категории (балл сохраняется)
    if attempt.proctor_flagged:
        passed = False
    attempt.passed = passed

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
