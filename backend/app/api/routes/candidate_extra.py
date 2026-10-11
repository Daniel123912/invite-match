"""Доп. эндпоинты кандидата: резюме, песочница, задания, жалобы."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, Response
from sqlalchemy.orm import Session

from app.api.candidate_serializers import candidate_to_out
from app.core.privacy import require_consent
from app.core.security import require_role
from app.database import get_db
from app.models import (
    Candidate,
    Employer,
    EmployerNeed,
    EmployerTask,
    EmployerTaskType,
    Invitation,
    NeedReport,
    TaskAssignment,
    TaskAssignmentStatus,
    User,
    UserRole,
)
from app.schemas import (
    CandidateOut,
    NeedReportRequest,
    PublicNeedOut,
    SandboxRunRequest,
    SandboxRunResponse,
    TaskAssignmentOut,
    TaskSubmitRequest,
)
from app.services import resume_service, sandbox_service
from app.services.minor_consent import parse_birth_date, require_parental_consent_if_minor

router = APIRouter(prefix="/candidate", tags=["candidate"])


def _get_candidate(user: User, db: Session) -> Candidate:
    c = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not c:
        raise HTTPException(404, "Профиль кандидата не найден")
    return c


@router.post("/resume", response_model=CandidateOut)
def upload_resume(
    file: UploadFile = File(...),
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    require_consent(c)
    resume_service.delete_storage(c.resume_storage_key)
    key, name, ctype, text = resume_service.save_resume(file)
    c.resume_storage_key = key
    c.resume_file_name = name
    c.resume_content_type = ctype
    if text:
        c.resume_text = text
    db.commit()
    db.refresh(c)
    return candidate_to_out(c)


@router.delete("/resume", response_model=CandidateOut)
def delete_resume(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    resume_service.delete_storage(c.resume_storage_key)
    c.resume_storage_key = None
    c.resume_file_name = None
    c.resume_content_type = None
    db.commit()
    db.refresh(c)
    return candidate_to_out(c)


@router.get("/resume/file")
def download_resume(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    if not c.resume_storage_key:
        raise HTTPException(404, "Файл не загружен")
    path = resume_service.UPLOAD_DIR / c.resume_storage_key
    if not path.is_file():
        raise HTTPException(404, "Файл не найден")
    return FileResponse(path, media_type=c.resume_content_type or "application/octet-stream")


@router.get("/resume/preview", response_class=HTMLResponse)
def preview_resume_docx(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    if not c.resume_storage_key:
        raise HTTPException(404, "Файл не загружен")
    path = resume_service.UPLOAD_DIR / c.resume_storage_key
    if not path.is_file():
        raise HTTPException(404, "Файл не найден")
    name = (c.resume_file_name or c.resume_storage_key or "").lower()
    if not name.endswith(".docx"):
        raise HTTPException(400, "Превью доступно только для DOCX")
    raw = path.read_bytes()
    return HTMLResponse(resume_service.docx_preview_html(raw))


@router.get("/profile/pdf")
def download_profile_pdf(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    """Сгенерировать PDF-профиль из данных кандидата."""
    c = _get_candidate(user, db)
    require_consent(c)
    pdf_bytes = resume_service.generate_profile_pdf(c)
    filename = f"profile_{c.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/sandbox/run", response_model=SandboxRunResponse)
def sandbox_run(
    body: SandboxRunRequest,
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    _get_candidate(user, db)
    result = sandbox_service.run_python(body.code, body.stdin)
    return SandboxRunResponse(**result)


@router.get("/needs/public", response_model=list[PublicNeedOut])
def public_needs(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    _get_candidate(user, db)
    needs = db.query(EmployerNeed).filter(EmployerNeed.is_suspicious.is_(False)).all()
    out: list[PublicNeedOut] = []
    for n in needs:
        emp = n.employer
        company = emp.company if emp else None
        if not company or len((n.description or "").strip()) < 20:
            continue
        out.append(
            PublicNeedOut(
                id=n.id,
                title=n.title,
                specialization=n.specialization,
                grade=n.grade,
                stack=n.stack,
                description=n.description,
                salary_from=n.salary_from,
                salary_to=n.salary_to,
                salary_gross=n.salary_gross,
                company_name=company.name,
                company_verified=company.verified,
                is_suspicious=n.is_suspicious,
            )
        )
    return out


@router.post("/needs/{need_id}/report", status_code=201)
def report_need(
    need_id: int,
    body: NeedReportRequest,
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    require_consent(c)
    need = db.query(EmployerNeed).filter(EmployerNeed.id == need_id).first()
    if not need:
        raise HTTPException(404, "Потребность не найдена")
    exists = (
        db.query(NeedReport)
        .filter(NeedReport.need_id == need_id, NeedReport.candidate_id == c.id)
        .first()
    )
    if exists:
        raise HTTPException(400, "Вы уже отправляли жалобу")
    db.add(NeedReport(need_id=need_id, candidate_id=c.id, reason=body.reason.strip()))
    need.report_count += 1
    if need.report_count >= 3:
        need.is_suspicious = True
    db.commit()
    return {"ok": True, "report_count": need.report_count}


@router.get("/tasks", response_model=list[TaskAssignmentOut])
def my_tasks(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    rows = (
        db.query(TaskAssignment)
        .filter(TaskAssignment.candidate_id == c.id)
        .order_by(TaskAssignment.id.desc())
        .all()
    )
    return [_assignment_out(a, db) for a in rows]


@router.post("/tasks/{assignment_id}/submit", response_model=TaskAssignmentOut)
def submit_task(
    assignment_id: int,
    body: TaskSubmitRequest,
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
    a = (
        db.query(TaskAssignment)
        .filter(TaskAssignment.id == assignment_id, TaskAssignment.candidate_id == c.id)
        .first()
    )
    if not a:
        raise HTTPException(404, "Задание не найдено")
    task = db.query(EmployerTask).filter(EmployerTask.id == a.task_id).first()
    if not task:
        raise HTTPException(404, "Задание удалено")

    score: float | None = None
    feedback = ""
    if task.task_type == EmployerTaskType.MCQ:
        if body.answer_mcq_index is None:
            raise HTTPException(400, "Укажите вариант ответа")
        a.answer_mcq_index = body.answer_mcq_index
        if task.correct_index is not None:
            score = 100.0 if body.answer_mcq_index == task.correct_index else 0.0
            feedback = "Автопроверка MCQ"
    elif task.task_type == EmployerTaskType.CODE:
        if not body.code:
            raise HTTPException(400, "Нужен код")
        a.code_submitted = body.code
        run = sandbox_service.run_python(body.code)
        expected = (task.expected_stdout or "").strip()
        got = (run["stdout"] or "").strip()
        score = 100.0 if expected and got == expected else (50.0 if run["ok"] else 0.0)
        feedback = f"stdout: {got[:200]}"
    else:
        if not body.answer_text:
            raise HTTPException(400, "Нужен текст ответа")
        a.answer_text = body.answer_text
        feedback = "Открытый ответ — оценит работодатель"

    a.submitted_at = datetime.now(timezone.utc)
    a.status = TaskAssignmentStatus.GRADED if score is not None else TaskAssignmentStatus.SUBMITTED
    a.score = score
    a.feedback = feedback
    db.commit()
    db.refresh(a)
    return _assignment_out(a, db)


def _assignment_out(a: TaskAssignment, db: Session) -> TaskAssignmentOut:
    task = db.query(EmployerTask).filter(EmployerTask.id == a.task_id).first()
    options = None
    if task and task.options_json:
        try:
            options = json.loads(task.options_json)
        except json.JSONDecodeError:
            options = None

    company_name = None
    if a.invitation_id:
        inv = db.query(Invitation).filter(Invitation.id == a.invitation_id).first()
        if inv:
            emp = db.query(Employer).filter(Employer.id == inv.employer_id).first()
            if emp and emp.company:
                company_name = emp.company.name
            elif emp and emp.full_name:
                company_name = emp.full_name
    if not company_name and task:
        emp = db.query(Employer).filter(Employer.id == task.employer_id).first()
        if emp and emp.company:
            company_name = emp.company.name

    cand = db.query(Candidate).filter(Candidate.id == a.candidate_id).first()

    return TaskAssignmentOut(
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


def apply_profile_minor_fields(c: Candidate, data: dict) -> None:
    if "birth_date" in data:
        c.birth_date = data.pop("birth_date")
    if "parental_consent" in data:
        c.parental_consent = bool(data.pop("parental_consent"))
    birth = parse_birth_date(c.birth_date)
    require_parental_consent_if_minor(birth, c.parental_consent)
