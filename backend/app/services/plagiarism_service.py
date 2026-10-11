import hashlib
import json

from sqlalchemy.orm import Session

from app.models import TestAttempt


def answers_fingerprint(answers: dict[int, int]) -> str:
    canonical = json.dumps({str(k): v for k, v in sorted(answers.items())}, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


def plagiarism_similarity(db: Session, attempt: TestAttempt, answers: dict[int, int]) -> float:
    """Доля совпадения ответов с другими попытками той же variant_group (0..1)."""
    if not answers:
        return 0.0
    my_ids = set(answers.keys())
    others = (
        db.query(TestAttempt)
        .filter(
            TestAttempt.category_id == attempt.category_id,
            TestAttempt.variant_group == attempt.variant_group,
            TestAttempt.id != attempt.id,
            TestAttempt.finished_at.isnot(None),
            TestAttempt.answers_json.isnot(None),
        )
        .all()
    )
    if not others:
        return 0.0
    best = 0.0
    for o in others:
        try:
            other_ans = {int(k): int(v) for k, v in json.loads(o.answers_json or "{}").items()}
        except (json.JSONDecodeError, ValueError, TypeError):
            continue
        overlap = my_ids & set(other_ans.keys())
        if not overlap:
            continue
        same = sum(1 for qid in overlap if answers.get(qid) == other_ans.get(qid))
        best = max(best, same / len(overlap))
    return round(best, 3)
