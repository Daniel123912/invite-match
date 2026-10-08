from datetime import date

from app.models import Candidate
from app.schemas import CandidateOut
from app.services.candidate_utils import candidate_specializations


def candidate_to_out(c: Candidate) -> CandidateOut:
    bd: date | None = None
    if c.birth_date:
        bd = c.birth_date.date() if hasattr(c.birth_date, "date") else c.birth_date
    return CandidateOut(
        id=c.id,
        full_name=c.full_name,
        phone=c.phone,
        telegram=c.telegram,
        city=c.city,
        about=c.about,
        resume_text=c.resume_text,
        stack=c.stack,
        industry=c.industry,
        specialization=c.specialization,
        selected_grade=c.selected_grade,
        confirmed_grade=c.confirmed_grade,
        category_id=c.category_id,
        test_score=c.test_score,
        fsp_id=c.fsp_id,
        fsp_score=c.fsp_score,
        has_fsp_history=c.has_fsp_history,
        privacy_public=c.privacy_public,
        consent_152fz=c.consent_152fz,
        consent_152fz_at=c.consent_152fz_at,
        resume_file_name=c.resume_file_name,
        resume_content_type=c.resume_content_type,
        birth_date=bd,
        parental_consent=c.parental_consent,
        specializations=candidate_specializations(c),
    )
