import json
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, Response
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.orm import Session, joinedload

from app.core.security import require_role
from app.database import get_db
from app.models import (
    Candidate,
    Category,
    Company,
    Employer,
    EmployerNeed,
    EmployerTask,
    EmployerTaskType,
    GradeLevel,
    Invitation,
    InvitationStatus,
    NeedReport,
    Specialization,
    TaskAssignment,
    TaskAssignmentStatus,
    User,
    UserRole,
)
from app.schemas import (
    AtsExportOut,
    AtsWebhookIn,
    CandidatePublicOut,
    CategoryOut,
    CompanyOut,
    CompanyUpdate,
    EmployerTaskCreate,
    EmployerTaskOut,
    InvitationCreate,
    InvitationOut,
    MatchResponse,
    NeedCreate,
    NeedOut,
    NeedUpdate,
    TaskAssignmentOut,
)
from app.core.privacy import (
    assert_candidate_invitable,
    can_reveal_contacts,
    contact_masks,
    redact_pii,
)
from app.services import avatar_service, match_service, resume_service

router = APIRouter(prefix="/employer", tags=["employer"])
logger = logging.getLogger("fsp.ats")


def _get_employer(user: User, db: Session) -> Employer:
    e = db.query(Employer).filter(Employer.user_id == user.id).first()
    if not e:
        raise HTTPException(404, "Профиль работодателя не найден")
    return e


def _company_out(company: Company) -> CompanyOut:
    return CompanyOut(
        id=company.id,
        name=company.name,
        description=company.description,
        website=company.website,
        industry=company.industry,
        city=company.city,
        contact_email=company.contact_email,
        contact_phone=company.contact_phone,
        contact_telegram=company.contact_telegram,
        verified=bool(company.verified),
        verification_note=company.verification_note,
        has_avatar=bool(company.avatar_storage_key),
    )


def _require_company(e: Employer, db: Session) -> Company:
    if not e.company_id:
        raise HTTPException(400, "Сначала сохраните профиль компании")
    company = db.query(Company).filter(Company.id == e.company_id).first()
    if not company:
        raise HTTPException(404, "Компания не найдена")
    return company


def _has_contact(*, email: str | None, phone: str | None, telegram: str | None) -> bool:
    return bool((email or "").strip() or (phone or "").strip() or (telegram or "").strip())


def _require_company_contacts(body: CompanyUpdate) -> None:
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(400, "Название компании обязательно")
    if len((body.description or "").strip()) < 20:
        raise HTTPException(400, "Описание компании обязательно (минимум 20 символов)")
    if not _has_contact(
        email=body.contact_email, phone=body.contact_phone, telegram=body.contact_telegram
    ):
        raise HTTPException(
            400,
            "Укажите хотя бы один способ связи: email, телефон или Telegram",
        )


def _latest_invitation(db: Session, employer_id: int, candidate_id: int) -> Invitation | None:
    return (
        db.query(Invitation)
        .filter(Invitation.employer_id == employer_id, Invitation.candidate_id == candidate_id)
        .order_by(Invitation.id.desc())
        .first()
    )


def _employer_can_view_candidate(
    db: Session, employer: Employer, candidate: Candidate
) -> Invitation | None:
    """Публичный профиль или есть приглашение от этого работодателя.

    Возвращает последнее приглашение (если есть) — нужно для раскрытия контактов.
    """
    inv = _latest_invitation(db, employer.id, candidate.id)
    if inv is not None:
        return inv
    if candidate.consent_152fz and candidate.privacy_public and candidate.category_id:
        return None
    raise HTTPException(403, "Кандидат недоступен для просмотра")


def _public_candidate_out(
    c: Candidate,
    *,
    rank_score: float | None = None,
    reason: str | None = None,
    grade_confirmed: bool = False,
    reveal: bool = False,
    include_resume_text: bool = True,
) -> CandidatePublicOut:
    email = c.user.email if getattr(c, "user", None) else None
    masks = contact_masks(
        revealed=reveal,
        phone=c.phone,
        email=email,
        telegram=c.telegram,
    )
    about = c.about if reveal else redact_pii(c.about)
    resume_text = None
    if include_resume_text and c.resume_text:
        resume_text = c.resume_text if reveal else redact_pii(c.resume_text)
    return CandidatePublicOut(
        id=c.id,
        full_name=c.full_name,
        city=c.city,
        about=about,
        stack=c.stack,
        specialization=c.specialization,
        selected_grade=c.selected_grade,
        confirmed_grade=c.confirmed_grade,
        grade_confirmed=grade_confirmed,
        category_id=c.category_id,
        test_score=c.test_score,
        fsp_score=c.fsp_score,
        has_fsp_history=c.has_fsp_history,
        rank_score=rank_score,
        reason=reason,
        has_resume_file=bool(c.resume_storage_key),
        resume_file_name=c.resume_file_name if c.resume_storage_key else None,
        resume_content_type=c.resume_content_type if c.resume_storage_key else None,
        resume_text=resume_text,
        **masks,
    )


@router.get("/company", response_model=CompanyOut | None)
def get_company(
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    if not e.company_id:
        return None
    company = db.query(Company).filter(Company.id == e.company_id).first()
    return _company_out(company) if company else None


@router.put("/company", response_model=CompanyOut)
def upsert_company(
    body: CompanyUpdate,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    _require_company_contacts(body)
    payload = body.model_dump()
    payload["name"] = body.name.strip()
    payload["description"] = body.description.strip()
    company = None
    if e.company_id:
        company = db.query(Company).filter(Company.id == e.company_id).first()
    if company:
        for field, value in payload.items():
            setattr(company, field, value)
    else:
        company = Company(**payload)
        db.add(company)
        db.flush()
        e.company_id = company.id
    db.commit()
    db.refresh(company)
    return _company_out(company)


@router.post("/company/avatar", response_model=CompanyOut)
def upload_company_avatar(
    file: UploadFile = File(...),
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    company = _require_company(e, db)
    avatar_service.delete_storage(company.avatar_storage_key)
    key, ctype = avatar_service.save_avatar(file)
    company.avatar_storage_key = key
    company.avatar_content_type = ctype
    db.commit()
    db.refresh(company)
    return _company_out(company)


@router.delete("/company/avatar", response_model=CompanyOut)
def delete_company_avatar(
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    company = _require_company(e, db)
    avatar_service.delete_storage(company.avatar_storage_key)
    company.avatar_storage_key = None
    company.avatar_content_type = None
    db.commit()
    db.refresh(company)
    return _company_out(company)


@router.get("/company/avatar")
def get_company_avatar(
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    company = _require_company(e, db)
    if not company.avatar_storage_key:
        raise HTTPException(404, "Логотип не загружен")
    path = avatar_service.UPLOAD_DIR / company.avatar_storage_key
    if not path.is_file():
        raise HTTPException(404, "Файл не найден")
    return FileResponse(path, media_type=company.avatar_content_type or "image/jpeg")


@router.post("/needs", response_model=NeedOut, status_code=201)
def create_need(
    body: NeedCreate,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    if body.salary_to < body.salary_from:
        raise HTTPException(400, "salary_to должен быть >= salary_from")
    e = _get_employer(user, db)
    if len((body.description or "").strip()) < 20:
        raise HTTPException(400, "Описание потребности минимум 20 символов (защита от пустых вакансий)")
    need = EmployerNeed(employer_id=e.id, **body.model_dump())
    db.add(need)
    db.commit()
    db.refresh(need)
    return _need_out(need, e)


@router.get("/needs", response_model=list[NeedOut])
def list_needs(
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    needs = (
        db.query(EmployerNeed)
        .filter(EmployerNeed.employer_id == e.id)
        .order_by(EmployerNeed.id.desc())
        .all()
    )
    return [_need_out(n, e) for n in needs]


@router.patch("/needs/{need_id}", response_model=NeedOut)
def update_need(
    need_id: int,
    body: NeedUpdate,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    need = (
        db.query(EmployerNeed)
        .filter(EmployerNeed.id == need_id, EmployerNeed.employer_id == e.id)
        .first()
    )
    if not need:
        raise HTTPException(404, "Вакансия не найдена")
    if body.is_active is not None:
        if body.is_active and need.is_suspicious:
            raise HTTPException(400, "Нельзя включить вакансию, скрытую из-за жалоб")
        need.is_active = body.is_active
    db.commit()
    db.refresh(need)
    return _need_out(need, e)


@router.delete("/needs/{need_id}", status_code=204)
def delete_need(
    need_id: int,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    need = (
        db.query(EmployerNeed)
        .filter(EmployerNeed.id == need_id, EmployerNeed.employer_id == e.id)
        .first()
    )
    if not need:
        raise HTTPException(404, "Вакансия не найдена")
    db.query(NeedReport).filter(NeedReport.need_id == need.id).delete(synchronize_session=False)
    db.query(Invitation).filter(Invitation.need_id == need.id).update(
        {Invitation.need_id: None},
        synchronize_session=False,
    )
    db.delete(need)
    db.commit()
    return None


@router.get("/match", response_model=MatchResponse)
def match(
    specialization: Specialization | None = Query(None),
    grade: GradeLevel | None = Query(None),
    stack: str | None = Query(None),
    fsp_only: bool | None = Query(None),
    need_id: int | None = Query(None),
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    linked_need: EmployerNeed | None = None
    if need_id is not None:
        linked_need = (
            db.query(EmployerNeed)
            .filter(EmployerNeed.id == need_id, EmployerNeed.employer_id == e.id)
            .first()
        )
        if not linked_need:
            raise HTTPException(404, "Потребность не найдена")
        if linked_need.is_suspicious:
            raise HTTPException(400, "Потребность скрыта из-за жалоб — создайте новую")
        if not linked_need.is_active:
            raise HTTPException(400, "Вакансия отключена — включите её в «Мои вакансии»")
        specialization = linked_need.specialization
        grade = linked_need.grade
        if stack is None:
            stack = linked_need.stack

    if specialization is None or grade is None:
        raise HTTPException(400, "Укажите need_id или specialization и grade")

    category, ranked = match_service.match_candidates(
        db, specialization, grade, stack_filter=stack, only_with_fsp=fsp_only
    )
    if not category:
        raise HTTPException(404, "Категория не найдена")

    count = db.query(Candidate).filter(Candidate.category_id == category.id).count()
    candidates_out: list[CandidatePublicOut] = []
    for c, score, reason in ranked:
        inv = _latest_invitation(db, e.id, c.id)
        reveal = bool(inv and can_reveal_contacts(inv, c))
        candidates_out.append(
            _public_candidate_out(
                c,
                rank_score=score,
                reason=reason,
                grade_confirmed=match_service.grade_confirmed_in_category(c, category, grade),
                reveal=reveal,
                include_resume_text=False,
            )
        )
    return MatchResponse(
        category=CategoryOut(
            id=category.id,
            specialization=category.specialization,
            grade=category.grade,
            title=category.title,
            description=category.description,
            candidates_count=count,
        ),
        candidates=candidates_out,
    )


@router.get("/candidates/{candidate_id}", response_model=CandidatePublicOut)
def get_candidate_dossier(
    candidate_id: int,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    """Карточка кандидата для изучения: резюме/стек/тест; контакты — маски до accept."""
    e = _get_employer(user, db)
    c = (
        db.query(Candidate)
        .options(joinedload(Candidate.user))
        .filter(Candidate.id == candidate_id)
        .first()
    )
    if not c:
        raise HTTPException(404, "Кандидат не найден")
    inv = _employer_can_view_candidate(db, e, c)
    reveal = bool(inv and can_reveal_contacts(inv, c))
    reason = match_service.build_reason(c)
    return _public_candidate_out(c, reason=reason, grade_confirmed=bool(c.confirmed_grade), reveal=reveal)


class _EmployerPdfCandidate:
    """Обёртка: скрывает контакты/ПДн в PDF, пока приглашение не принято."""

    __slots__ = ("_c", "_reveal")

    def __init__(self, candidate: Candidate, *, reveal: bool):
        self._c = candidate
        self._reveal = reveal

    def __getattr__(self, name: str):
        return getattr(self._c, name)

    @property
    def phone(self):
        return self._c.phone if self._reveal else None

    @property
    def telegram(self):
        return self._c.telegram if self._reveal else None

    @property
    def about(self):
        return self._c.about if self._reveal else redact_pii(self._c.about)

    @property
    def resume_text(self):
        return self._c.resume_text if self._reveal else redact_pii(self._c.resume_text)


@router.get("/candidates/{candidate_id}/resume/file")
def employer_resume_file(
    candidate_id: int,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        raise HTTPException(404, "Кандидат не найден")
    _employer_can_view_candidate(db, e, c)
    if not c.resume_storage_key:
        raise HTTPException(404, "Файл резюме не загружен")
    path = resume_service.UPLOAD_DIR / c.resume_storage_key
    if not path.is_file():
        raise HTTPException(404, "Файл не найден")
    filename = c.resume_file_name or path.name
    return FileResponse(
        path,
        media_type=c.resume_content_type or "application/octet-stream",
        filename=filename,
        content_disposition_type="attachment",
    )


@router.get("/candidates/{candidate_id}/resume/preview", response_class=HTMLResponse)
def employer_resume_preview(
    candidate_id: int,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        raise HTTPException(404, "Кандидат не найден")
    _employer_can_view_candidate(db, e, c)
    if not c.resume_storage_key:
        raise HTTPException(404, "Файл резюме не загружен")
    path = resume_service.UPLOAD_DIR / c.resume_storage_key
    if not path.is_file():
        raise HTTPException(404, "Файл не найден")
    name = (c.resume_file_name or c.resume_storage_key or "").lower()
    if not name.endswith(".docx"):
        raise HTTPException(400, "Превью доступно только для DOCX")
    raw = path.read_bytes()
    html = resume_service.docx_preview_html(raw)
    inv = _latest_invitation(db, e.id, c.id)
    if not (inv and can_reveal_contacts(inv, c)):
        html = redact_pii(html) or html
    return HTMLResponse(html)


@router.get("/candidates/{candidate_id}/profile/pdf")
def employer_profile_pdf(
    candidate_id: int,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    """Скачать PDF-профиль кандидата (контакты маскируются до accept)."""
    e = _get_employer(user, db)
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        raise HTTPException(404, "Кандидат не найден")
    inv = _employer_can_view_candidate(db, e, c)
    reveal = bool(inv and can_reveal_contacts(inv, c))
    pdf_bytes = resume_service.generate_profile_pdf(_EmployerPdfCandidate(c, reveal=reveal))
    safe_name = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in (c.full_name or "candidate"))
    filename = f"resume_{safe_name[:40]}_{c.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    cats = db.query(Category).all()
    result = []
    for cat in cats:
        count = db.query(Candidate).filter(Candidate.category_id == cat.id).count()
        result.append(
            CategoryOut(
                id=cat.id,
                specialization=cat.specialization,
                grade=cat.grade,
                title=cat.title,
                description=cat.description,
                candidates_count=count,
            )
        )
    return result


@router.post("/invitations", response_model=InvitationOut, status_code=201)
def create_invitation(
    body: InvitationCreate,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    if body.salary_to < body.salary_from:
        raise HTTPException(400, "salary_to должен быть >= salary_from")
    offer = (body.message or "").strip()
    if len(offer) < 20:
        raise HTTPException(400, "Описание предложения обязательно (минимум 20 символов)")
    e = _get_employer(user, db)
    if not e.company_id or not e.company:
        raise HTTPException(400, "Сначала заполните профиль компании")
    company = e.company
    if not (company.name or "").strip():
        raise HTTPException(400, "Название компании обязательно")
    if len((company.description or "").strip()) < 20:
        raise HTTPException(400, "Заполните описание компании (минимум 20 символов)")

    candidate = db.query(Candidate).filter(Candidate.id == body.candidate_id).first()
    if not candidate:
        raise HTTPException(404, "Кандидат не найден")
    assert_candidate_invitable(candidate)

    if body.need_id:
        need = (
            db.query(EmployerNeed)
            .filter(EmployerNeed.id == body.need_id, EmployerNeed.employer_id == e.id)
            .first()
        )
        if not need:
            raise HTTPException(404, "Потребность не найдена")
        if need.is_suspicious:
            raise HTTPException(400, "Потребность скрыта из-за жалоб — создайте новую")
        if not need.is_active:
            raise HTTPException(400, "Вакансия отключена — включите её перед приглашением")

    contact_email = (body.contact_email or company.contact_email or "").strip() or None
    contact_phone = (body.contact_phone or company.contact_phone or "").strip() or None
    contact_telegram = (body.contact_telegram or company.contact_telegram or "").strip() or None
    if not _has_contact(email=contact_email, phone=contact_phone, telegram=contact_telegram):
        raise HTTPException(
            400,
            "Укажите способ связи с работодателем в компании или в приглашении",
        )

    reason = match_service.build_reason(candidate)
    inv = Invitation(
        employer_id=e.id,
        candidate_id=candidate.id,
        need_id=body.need_id,
        message=offer,
        salary_from=body.salary_from,
        salary_to=body.salary_to,
        salary_gross=bool(body.salary_gross),
        contact_email=contact_email,
        contact_phone=contact_phone,
        contact_telegram=contact_telegram,
        reason=reason,
        status=InvitationStatus.SENT,
    )
    db.add(inv)
    db.flush()

    if body.employer_task_id:
        task = (
            db.query(EmployerTask)
            .filter(EmployerTask.id == body.employer_task_id, EmployerTask.employer_id == e.id)
            .first()
        )
        if not task:
            raise HTTPException(404, "Задание работодателя не найдено")
        db.add(
            TaskAssignment(
                task_id=task.id,
                candidate_id=candidate.id,
                invitation_id=inv.id,
                status=TaskAssignmentStatus.PENDING,
            )
        )

    db.commit()
    db.refresh(inv)

    company_name = company.name
    return _invitation_out(inv, company_name=company_name, candidate=candidate, reveal=False)


@router.get("/invitations", response_model=list[InvitationOut])
def list_outgoing(
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    invs = db.query(Invitation).filter(Invitation.employer_id == e.id).all()
    company_name = e.company.name if e.company else None
    result = []
    for inv in invs:
        cand = (
            db.query(Candidate)
            .options(joinedload(Candidate.user))
            .filter(Candidate.id == inv.candidate_id)
            .first()
        )
        reveal = can_reveal_contacts(inv, cand)
        result.append(_invitation_out(inv, company_name=company_name, candidate=cand, reveal=reveal))
    return result


def _invitation_out(
    inv: Invitation,
    *,
    company_name: str | None,
    candidate: Candidate | None,
    reveal: bool,
) -> InvitationOut:
    email = candidate.user.email if candidate and candidate.user else None
    phone = candidate.phone if candidate else None
    telegram = candidate.telegram if candidate else None
    masks = contact_masks(revealed=reveal, phone=phone, email=email, telegram=telegram)

    return InvitationOut(
        id=inv.id,
        employer_id=inv.employer_id,
        candidate_id=inv.candidate_id,
        need_id=inv.need_id,
        message=inv.message,
        salary_from=inv.salary_from,
        salary_to=inv.salary_to,
        salary_gross=bool(getattr(inv, "salary_gross", True)),
        status=inv.status,
        reason=inv.reason,
        created_at=inv.created_at,
        company_name=company_name,
        candidate_name=candidate.full_name if candidate else None,
        candidate_phone=masks["phone"],
        candidate_telegram=masks["telegram"],
        candidate_email=masks["email"],
        contacts_revealed=masks["contacts_revealed"],
        contacts_revoked=bool(inv.contacts_revoked),
        phone_display=masks["phone_display"],
        email_display=masks["email_display"],
        telegram_display=masks["telegram_display"],
        employer_contact_email=inv.contact_email,
        employer_contact_phone=inv.contact_phone,
        employer_contact_telegram=inv.contact_telegram,
    )


def _need_out(need: EmployerNeed, employer: Employer) -> NeedOut:
    company = employer.company
    return NeedOut(
        id=need.id,
        title=need.title,
        specialization=need.specialization,
        grade=need.grade,
        stack=need.stack,
        description=need.description,
        salary_from=need.salary_from,
        salary_to=need.salary_to,
        salary_gross=need.salary_gross,
        report_count=need.report_count,
        is_suspicious=need.is_suspicious,
        is_active=bool(need.is_active),
        company_verified=bool(company and company.verified),
        created_at=need.created_at,
    )


@router.post("/tasks", response_model=EmployerTaskOut, status_code=201)
def create_task(
    body: EmployerTaskCreate,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    options_json = json.dumps(body.options) if body.options else None
    task = EmployerTask(
        employer_id=e.id,
        title=body.title,
        task_type=body.task_type,
        prompt=body.prompt,
        options_json=options_json,
        correct_index=body.correct_index,
        expected_stdout=body.expected_stdout,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_out(task)


@router.get("/tasks", response_model=list[EmployerTaskOut])
def list_tasks(
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    tasks = db.query(EmployerTask).filter(EmployerTask.employer_id == e.id).all()
    return [_task_out(t) for t in tasks]


@router.get("/tasks/assignments", response_model=list[TaskAssignmentOut])
def list_assignments(
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    task_ids = [t.id for t in db.query(EmployerTask).filter(EmployerTask.employer_id == e.id).all()]
    if not task_ids:
        return []
    rows = (
        db.query(TaskAssignment)
        .filter(TaskAssignment.task_id.in_(task_ids))
        .order_by(TaskAssignment.id.desc())
        .all()
    )
    result = []
    for a in rows:
        task = db.query(EmployerTask).filter(EmployerTask.id == a.task_id).first()
        options = None
        if task and task.options_json:
            try:
                options = json.loads(task.options_json)
            except json.JSONDecodeError:
                options = None
        cand = db.query(Candidate).filter(Candidate.id == a.candidate_id).first()
        company_name = e.company.name if e.company else None
        result.append(
            TaskAssignmentOut(
                id=a.id,
                task_id=a.task_id,
                task_title=task.title if task else "",
                task_type=task.task_type if task else EmployerTaskType.OPEN,
                prompt=task.prompt if task else "",
                options=options,
                status=a.status,
                score=a.score,
                feedback=a.feedback,
                invitation_id=a.invitation_id,
                company_name=company_name,
                candidate_name=cand.full_name if cand else None,
                submitted_at=a.submitted_at,
                answer_text=a.answer_text,
                answer_mcq_index=a.answer_mcq_index,
                code_submitted=a.code_submitted,
            )
        )
    return result


def _task_out(task: EmployerTask) -> EmployerTaskOut:
    options = None
    if task.options_json:
        try:
            options = json.loads(task.options_json)
        except json.JSONDecodeError:
            options = None
    return EmployerTaskOut(
        id=task.id,
        title=task.title,
        task_type=task.task_type,
        prompt=task.prompt,
        options=options,
        created_at=task.created_at,
    )


@router.get("/ats/export", response_model=AtsExportOut)
def ats_export(
    invitation_id: int = Query(...),
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    inv = (
        db.query(Invitation)
        .filter(Invitation.id == invitation_id, Invitation.employer_id == e.id)
        .first()
    )
    if not inv:
        raise HTTPException(404, "Приглашение не найдено")
    cand = db.query(Candidate).filter(Candidate.id == inv.candidate_id).first()
    payload = {
        "invitation_status": inv.status.value,
        "candidate": {
            "id": cand.id if cand else None,
            "full_name": cand.full_name if cand else None,
            "category_id": cand.category_id if cand else None,
            "test_score": cand.test_score if cand else None,
        },
        "salary": {"from": inv.salary_from, "to": inv.salary_to},
        "message": inv.message,
    }
    return AtsExportOut(invitation_id=inv.id, candidate_id=inv.candidate_id, payload=payload)


@router.post("/ats/webhook")
def ats_webhook(
    body: AtsWebhookIn,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    _get_employer(user, db)
    # Не логируем тело — риск ПДн; только тип события и число ключей
    keys = list(body.payload.keys()) if isinstance(body.payload, dict) else []
    logger.info(
        "ATS webhook: event=%s payload_keys=%s key_count=%s",
        body.event,
        keys[:20],
        len(keys),
    )
    return {"ok": True, "received": body.event}


@router.post("/company/verify-request")
def request_company_verify(
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    if not e.company_id:
        raise HTTPException(400, "Сначала создайте профиль компании")
    company = db.query(Company).filter(Company.id == e.company_id).first()
    if not company:
        e.company_id = None
        db.commit()
        raise HTTPException(404, "Компания не найдена — создайте профиль заново")
    company.verification_note = "Заявка на проверку отправлена (демо)"
    db.commit()
    return {"ok": True, "verified": company.verified}
