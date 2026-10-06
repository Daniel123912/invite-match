from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.security import require_role
from app.database import get_db
from app.models import (
    Candidate,
    Category,
    Company,
    Employer,
    EmployerNeed,
    GradeLevel,
    Invitation,
    InvitationStatus,
    Specialization,
    User,
    UserRole,
)
from app.schemas import (
    CandidatePublicOut,
    CategoryOut,
    CompanyOut,
    CompanyUpdate,
    InvitationCreate,
    InvitationOut,
    MatchResponse,
    NeedCreate,
    NeedOut,
)
from app.services import match_service

router = APIRouter(prefix="/employer", tags=["employer"])


def _get_employer(user: User, db: Session) -> Employer:
    e = db.query(Employer).filter(Employer.user_id == user.id).first()
    if not e:
        raise HTTPException(404, "Профиль работодателя не найден")
    return e


@router.get("/company", response_model=CompanyOut | None)
def get_company(
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    if not e.company_id:
        return None
    return db.query(Company).filter(Company.id == e.company_id).first()


@router.put("/company", response_model=CompanyOut)
def upsert_company(
    body: CompanyUpdate,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    if e.company_id:
        company = db.query(Company).filter(Company.id == e.company_id).first()
        for field, value in body.model_dump().items():
            setattr(company, field, value)
    else:
        company = Company(**body.model_dump())
        db.add(company)
        db.flush()
        e.company_id = company.id
    db.commit()
    db.refresh(company)
    return company


@router.post("/needs", response_model=NeedOut, status_code=201)
def create_need(
    body: NeedCreate,
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    if body.salary_to < body.salary_from:
        raise HTTPException(400, "salary_to должен быть >= salary_from")
    e = _get_employer(user, db)
    need = EmployerNeed(employer_id=e.id, **body.model_dump())
    db.add(need)
    db.commit()
    db.refresh(need)
    return need


@router.get("/needs", response_model=list[NeedOut])
def list_needs(
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    e = _get_employer(user, db)
    return db.query(EmployerNeed).filter(EmployerNeed.employer_id == e.id).all()


@router.get("/match", response_model=MatchResponse)
def match(
    specialization: Specialization = Query(...),
    grade: GradeLevel = Query(...),
    stack: str | None = Query(None),
    fsp_only: bool | None = Query(None),
    user: User = Depends(require_role(UserRole.EMPLOYER)),
    db: Session = Depends(get_db),
):
    _get_employer(user, db)
    category, ranked = match_service.match_candidates(
        db, specialization, grade, stack_filter=stack, only_with_fsp=fsp_only
    )
    if not category:
        raise HTTPException(404, "Категория не найдена")

    count = db.query(Candidate).filter(Candidate.category_id == category.id).count()
    return MatchResponse(
        category=CategoryOut(
            id=category.id,
            specialization=category.specialization,
            grade=category.grade,
            title=category.title,
            description=category.description,
            candidates_count=count,
        ),
        candidates=[
            CandidatePublicOut(
                id=c.id,
                full_name=c.full_name,
                city=c.city,
                about=c.about,
                stack=c.stack,
                specialization=c.specialization,
                confirmed_grade=c.confirmed_grade,
                category_id=c.category_id,
                test_score=c.test_score,
                fsp_score=c.fsp_score,
                has_fsp_history=c.has_fsp_history,
                rank_score=score,
                reason=reason,
            )
            for c, score, reason in ranked
        ],
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
    e = _get_employer(user, db)
    candidate = db.query(Candidate).filter(Candidate.id == body.candidate_id).first()
    if not candidate:
        raise HTTPException(404, "Кандидат не найден")

    reason = match_service.build_reason(candidate)
    inv = Invitation(
        employer_id=e.id,
        candidate_id=candidate.id,
        need_id=body.need_id,
        message=body.message,
        salary_from=body.salary_from,
        salary_to=body.salary_to,
        reason=reason,
        status=InvitationStatus.SENT,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    company_name = e.company.name if e.company else None
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
        reveal = inv.status == InvitationStatus.ACCEPTED
        result.append(_invitation_out(inv, company_name=company_name, candidate=cand, reveal=reveal))
    return result


def _invitation_out(
    inv: Invitation,
    *,
    company_name: str | None,
    candidate: Candidate | None,
    reveal: bool,
) -> InvitationOut:
    email = None
    phone = None
    telegram = None
    if reveal and candidate:
        phone = candidate.phone
        telegram = candidate.telegram
        if candidate.user:
            email = candidate.user.email

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
        candidate_name=candidate.full_name if candidate else None,
        candidate_phone=phone,
        candidate_telegram=telegram,
        candidate_email=email,
    )
