"""Matching & ranking: test_score * 0.7 + fsp_score * 0.3."""

from sqlalchemy.orm import Session

from app.models import Candidate, Category, GradeLevel, Specialization


def rank_score(candidate: Candidate) -> float:
    test = candidate.test_score or 0.0
    fsp = candidate.fsp_score or 0.0
    # Normalize fsp to 0-100 scale (stub achievements give points up to ~100)
    fsp_norm = min(fsp, 100.0)
    return round(test * 0.7 + fsp_norm * 0.3, 2)


def build_reason(candidate: Candidate) -> str:
    parts = []
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
        Candidate.category_id == category.id,
        Candidate.confirmed_grade.isnot(None),
        Candidate.privacy_public.is_(True),
    )
    if only_with_fsp is True:
        q = q.filter(Candidate.has_fsp_history.is_(True))
    if only_with_fsp is False:
        q = q.filter(Candidate.has_fsp_history.is_(False))

    candidates = q.all()

    if stack_filter:
        needles = [s.strip().lower() for s in stack_filter.split(",") if s.strip()]
        filtered = []
        for c in candidates:
            hay = (c.stack or "").lower()
            if any(n in hay for n in needles):
                filtered.append(c)
        candidates = filtered

    ranked = [(c, rank_score(c), build_reason(c)) for c in candidates]
    ranked.sort(key=lambda x: x[1], reverse=True)
    return category, ranked[:limit]
