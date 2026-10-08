"""Matching & ranking: test_score * 0.7 + fsp_score * 0.3."""

from sqlalchemy.orm import Session

from app.models import Candidate, Category, GradeLevel, Specialization
from app.services.candidate_utils import candidate_specializations

# Неподтверждённый грейд виден в выдаче, но ниже подтверждённых (Q&A жюри)
UNCONFIRMED_RANK_FACTOR = 0.55


def rank_score(candidate: Candidate) -> float:
    test = candidate.test_score or 0.0
    fsp = candidate.fsp_score or 0.0
    # Normalize fsp to 0-100 scale (stub achievements give points up to ~100)
    fsp_norm = min(fsp, 100.0)
    return round(test * 0.7 + fsp_norm * 0.3, 2)


def grade_confirmed_in_category(
    candidate: Candidate, category: Category, grade: GradeLevel
) -> bool:
    return (
        candidate.category_id == category.id
        and candidate.confirmed_grade == grade
    )


def build_reason(candidate: Candidate, *, grade_confirmed: bool = True) -> str:
    parts = []
    if not grade_confirmed:
        parts.append("грейд не подтверждён тестом — ниже в выдаче")
    if candidate.test_score is not None:
        parts.append(f"тест {candidate.test_score:.0f}%")
    if candidate.has_fsp_history:
        parts.append(f"ФСП {candidate.fsp_score:.0f} баллов")
    else:
        parts.append("истории ФСП нет — ранжирование по тесту")
    if candidate.stack:
        parts.append(f"стек: {candidate.stack}")
    return "; ".join(parts)


def match_candidates(
    db: Session,
    specialization: Specialization,
    grade: GradeLevel,
    stack_filter: str | None = None,
    only_with_fsp: bool | None = None,
    limit: int = 20,
) -> tuple[Category | None, list[tuple[Candidate, float, str]]]:
    category = (
        db.query(Category)
        .filter(Category.specialization == specialization, Category.grade == grade)
        .first()
    )
    if not category:
        return None, []

    q = db.query(Candidate).filter(
        Candidate.privacy_public.is_(True),
        Candidate.consent_152fz.is_(True),
    )
    if only_with_fsp is True:
        q = q.filter(Candidate.has_fsp_history.is_(True))
    if only_with_fsp is False:
        q = q.filter(Candidate.has_fsp_history.is_(False))

    pool: list[tuple[Candidate, bool]] = []
    for c in q.all():
        specs = candidate_specializations(c)
        if specialization not in specs:
            continue
        confirmed = grade_confirmed_in_category(c, category, grade)
        unconfirmed = (
            c.selected_grade == grade
            and c.test_score is not None
            and not confirmed
        )
        if confirmed or unconfirmed:
            pool.append((c, confirmed))

    if stack_filter:
        needles = [s.strip().lower() for s in stack_filter.split(",") if s.strip()]
        filtered: list[tuple[Candidate, bool]] = []
        for c, confirmed in pool:
            hay = (c.stack or "").lower()
            if any(n in hay for n in needles):
                filtered.append((c, confirmed))
        pool = filtered

    ranked: list[tuple[Candidate, float, str, bool]] = []
    for c, confirmed in pool:
        score = rank_score(c)
        if not confirmed:
            score = round(score * UNCONFIRMED_RANK_FACTOR, 2)
        ranked.append((c, score, build_reason(c, grade_confirmed=confirmed), confirmed))

    ranked.sort(key=lambda x: (x[3], x[1]), reverse=True)  # confirmed first, then score
    slim = [(c, score, reason) for c, score, reason, _ in ranked[:limit]]
    return category, slim
