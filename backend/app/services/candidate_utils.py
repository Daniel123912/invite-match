import json

from app.models import Candidate, Specialization


def candidate_specializations(candidate: Candidate) -> list[Specialization]:
    if candidate.specializations_json:
        try:
            raw = json.loads(candidate.specializations_json)
            return [Specialization(v) for v in raw if v]
        except (json.JSONDecodeError, ValueError):
            pass
    if candidate.specialization:
        return [candidate.specialization]
    return []


def set_specializations(candidate: Candidate, specs: list[Specialization]) -> None:
    unique = list(dict.fromkeys(specs))
    candidate.specializations_json = json.dumps([s.value for s in unique])
    candidate.specialization = unique[0] if unique else None
