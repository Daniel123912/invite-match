import json

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.privacy import apply_consent, require_consent
from app.core.security import require_role
from app.database import get_db
from app.models import Candidate, Category, Invitation, InvitationStatus, TestAttempt, User, UserRole
from app.schemas import (
    CandidateOut,
    CandidateProfileUpdate,
    CategoryResultOut,
    ContactsRevokeRequest,
    InvitationOut,
    QuestionOut,
    SurveyRequest,
    TestAttemptOut,
    TestResultOut,
    TestStartResponse,
    TestSubmitRequest,
)
from app.services import resume_service, test_service

router = APIRouter(prefix="/candidate", tags=["candidate"])
settings = get_settings()


def _resume_upload_dir() -> Path:
    return Path(settings.resume_upload_dir)


def _get_candidate(user: User, db: Session) -> Candidate:
    c = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not c:
        raise HTTPException(404, "Профиль кандидата не найден")
    return c


@router.get("/profile", response_model=CandidateOut)
def get_profile(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    return _get_candidate(user, db)


@router.patch("/profile", response_model=CandidateOut)
def update_profile(
    body: CandidateProfileUpdate,
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    data = body.model_dump(exclude_unset=True)

    # Согласие 152-ФЗ обрабатываем отдельно
    if "consent_152fz" in data:
        apply_consent(c, bool(data.pop("consent_152fz")))

    contact_fields = {"phone", "telegram", "full_name", "city", "about", "resume_text"}
    if contact_fields & data.keys():
        require_consent(c)

    if data.get("privacy_public") is True and not c.consent_152fz:
        raise HTTPException(400, "Нельзя публиковать профиль без согласия 152-ФЗ")

    for field, value in data.items():
        setattr(c, field, value)

    # Stub FSP link
    if body.fsp_id is not None:
        if body.fsp_id:
            from app.models import FspAchievement

            achievements = db.query(FspAchievement).filter(FspAchievement.fsp_id == body.fsp_id).all()
            if achievements:
                c.has_fsp_history = True
                c.fsp_score = sum(a.points for a in achievements)
            else:
                c.has_fsp_history = False
                c.fsp_score = 0.0
        else:
            c.has_fsp_history = False
            c.fsp_score = 0.0

    db.commit()
    db.refresh(c)
    return c


@router.post("/resume", response_model=CandidateOut)
async def upload_resume(
    file: UploadFile = File(...),
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    require_consent(c)

    content_type, ext = resume_service.validate_resume_upload(file, settings.resume_max_bytes)
    data = await resume_service.read_resume_bytes(file, settings.resume_max_bytes)
    upload_dir = _resume_upload_dir()

    resume_service.delete_resume_file(upload_dir, c.resume_storage_key)
    storage_key = resume_service.save_resume_file(upload_dir, data, ext)
    path = resume_service.resolve_resume_path(upload_dir, storage_key)

    extracted = resume_service.extract_resume_text(path, content_type)
    if extracted:
        c.resume_text = extracted

    original = (file.filename or f"resume{ext}").replace("\\", "/").split("/")[-1]
    c.resume_file_name = original[:255]
    c.resume_content_type = content_type
    c.resume_storage_key = storage_key

    db.commit()
    db.refresh(c)
    return c


@router.get("/resume/file")
def download_resume_file(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    if not c.resume_storage_key:
        raise HTTPException(404, "Резюме не загружено")

    path = resume_service.resolve_resume_path(_resume_upload_dir(), c.resume_storage_key)
    media_type = c.resume_content_type or "application/octet-stream"
    filename = c.resume_file_name or path.name
    return FileResponse(
        path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/resume/preview")
def preview_resume(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    if not c.resume_storage_key:
        raise HTTPException(404, "Резюме не загружено")

    path = resume_service.resolve_resume_path(_resume_upload_dir(), c.resume_storage_key)
    content_type = c.resume_content_type or ""

    if content_type == "application/pdf":
        raise HTTPException(400, "Для PDF используйте просмотр файла")

    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return HTMLResponse(resume_service.docx_to_html(path))

    raise HTTPException(400, "Предпросмотр недоступен для этого формата")


@router.delete("/resume", response_model=CandidateOut)
def delete_resume(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    require_consent(c)
    resume_service.delete_resume_file(_resume_upload_dir(), c.resume_storage_key)
    c.resume_file_name = None
    c.resume_content_type = None
    c.resume_storage_key = None
    db.commit()
    db.refresh(c)
    return c


@router.post("/survey", response_model=CandidateOut)
def submit_survey(
    body: SurveyRequest,
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    require_consent(c)
    c.industry = body.industry
    c.specialization = body.specialization
    c.selected_grade = body.selected_grade
    db.commit()
    db.refresh(c)
    return c


@router.post("/test/start", response_model=TestStartResponse)
def start_test(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    require_consent(c)
    attempt = test_service.start_test(db, c)
    questions = test_service.get_attempt_questions(db, attempt)
    category = db.query(Category).filter(Category.id == attempt.category_id).first()

    return TestStartResponse(
        attempt_id=attempt.id,
        variant_group=attempt.variant_group,
        category_title=category.title if category else "",
        questions=[
            QuestionOut(
                id=q.id,
                topic=q.topic,
                text=q.text,
                options=json.loads(q.options_json),
                difficulty=q.difficulty,
            )
            for q in questions
        ],
    )


@router.post("/test/submit", response_model=TestResultOut)
def submit_test(
    body: TestSubmitRequest,
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    require_consent(c)
    attempt = test_service.submit_test(db, c, body.attempt_id, body.answers)
    category = db.query(Category).filter(Category.id == attempt.category_id).first()
    db.refresh(c)

    return TestResultOut(
        attempt_id=attempt.id,
        score=attempt.score or 0,
        passed=bool(attempt.passed),
        confirmed_grade=c.confirmed_grade if attempt.passed else None,
        category_id=c.category_id if attempt.passed else None,
        category_title=category.title if category and attempt.passed else None,
    )


@router.get("/category", response_model=CategoryResultOut)
def get_category(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    """Текущая категория / грейд после теста (для экрана результата)."""
    c = _get_candidate(user, db)
    category = None
    if c.category_id:
        category = db.query(Category).filter(Category.id == c.category_id).first()

    return CategoryResultOut(
        category_id=c.category_id,
        category_title=category.title if category else None,
        specialization=c.specialization,
        confirmed_grade=c.confirmed_grade,
        test_score=c.test_score,
        has_fsp_history=c.has_fsp_history,
        fsp_score=c.fsp_score,
        last_grade_change_at=c.last_grade_change_at,
        cooldown_days=settings.grade_change_cooldown_days,
    )


@router.get("/test/history", response_model=list[TestAttemptOut])
def test_history(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    """История попыток теста (для экрана результата)."""
    c = _get_candidate(user, db)
    attempts = (
        db.query(TestAttempt)
        .filter(TestAttempt.candidate_id == c.id)
        .order_by(TestAttempt.started_at.desc())
        .all()
    )
    cat_ids = {a.category_id for a in attempts}
    titles = {
        cat.id: cat.title
        for cat in db.query(Category).filter(Category.id.in_(cat_ids)).all()
    } if cat_ids else {}

    return [
        TestAttemptOut(
            id=a.id,
            category_id=a.category_id,
            category_title=titles.get(a.category_id),
            variant_group=a.variant_group,
            score=a.score,
            passed=a.passed,
            started_at=a.started_at,
            finished_at=a.finished_at,
        )
        for a in attempts
    ]


@router.patch("/invitations/{invitation_id}/contacts", response_model=InvitationOut)
def revoke_contacts(
    invitation_id: int,
    body: ContactsRevokeRequest,
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    """Отозвать / вернуть доступ работодателя к контактам после accept (152-ФЗ)."""
    c = _get_candidate(user, db)
    inv = (
        db.query(Invitation)
        .filter(Invitation.id == invitation_id, Invitation.candidate_id == c.id)
        .first()
    )
    if not inv:
        raise HTTPException(404, "Приглашение не найдено")
    if inv.status != InvitationStatus.ACCEPTED:
        raise HTTPException(400, "Отзыв контактов доступен только после принятия приглашения")

    inv.contacts_revoked = bool(body.revoke)
    db.commit()
    db.refresh(inv)

    from app.models import Employer

    emp = db.query(Employer).filter(Employer.id == inv.employer_id).first()
    company_name = emp.company.name if emp and emp.company else None
    return InvitationOut(
        id=inv.id,
        employer_id=inv.employer_id,
        candidate_id=inv.candidate_id,
        need_id=inv.need_id,
        message=inv.message,
        salary_from=inv.salary_from,
        salary_to=inv.salary_to,
        status=inv.status,
        reason=inv.reason,
        created_at=inv.created_at,
        company_name=company_name,
        candidate_name=c.full_name,
    )
