from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.database import get_db
from app.models import Candidate, Employer, Invitation, InvitationStatus, User, UserRole
from app.schemas import InvitationOut, InvitationStatusUpdate

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.get("/incoming", response_model=list[InvitationOut])
def incoming(
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not c:
        raise HTTPException(404, "Кандидат не найден")

    invs = db.query(Invitation).filter(Invitation.candidate_id == c.id).all()
    result = []
    for inv in invs:
        emp = db.query(Employer).filter(Employer.id == inv.employer_id).first()
        company_name = emp.company.name if emp and emp.company else None
        if inv.status == InvitationStatus.SENT:
            inv.status = InvitationStatus.VIEWED
            db.commit()
        result.append(
            InvitationOut(
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
                contacts_revoked=bool(inv.contacts_revoked),
            )
        )
    return result


@router.patch("/{invitation_id}", response_model=InvitationOut)
def update_status(
    invitation_id: int,
    body: InvitationStatusUpdate,
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    if body.status not in (InvitationStatus.ACCEPTED, InvitationStatus.DECLINED):
        raise HTTPException(400, "Можно только accept или decline")

    c = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not c:
        raise HTTPException(404, "Кандидат не найден")

    inv = (
        db.query(Invitation)
        .filter(Invitation.id == invitation_id, Invitation.candidate_id == c.id)
        .first()
    )
    if not inv:
        raise HTTPException(404, "Приглашение не найдено")

    inv.status = body.status
    db.commit()
    db.refresh(inv)

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
        contacts_revoked=bool(inv.contacts_revoked),
    )
