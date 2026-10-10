from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user
from app.database import get_db
from app.models import (
    Candidate,
    ChatMessage,
    ChatReadCursor,
    Employer,
    Invitation,
    InvitationStatus,
    User,
    UserRole,
)
from app.schemas import (
    ChatInboxItem,
    ChatMessageCreate,
    ChatMessageOut,
    ChatUnreadSummary,
)

router = APIRouter(prefix="/chat", tags=["chat"])

_CHAT_ALLOWED = {
    InvitationStatus.SENT,
    InvitationStatus.VIEWED,
    InvitationStatus.ACCEPTED,
}


def _can_access_invitation(db: Session, user: User, invitation_id: int) -> Invitation:
    inv = db.query(Invitation).filter(Invitation.id == invitation_id).first()
    if not inv:
        raise HTTPException(404, "Диалог не найден")
    if inv.status not in _CHAT_ALLOWED:
        raise HTTPException(400, "Чат недоступен для этого статуса приглашения")
    if user.role == UserRole.CANDIDATE:
        cand = db.query(Candidate).filter(Candidate.user_id == user.id).first()
        if not cand or inv.candidate_id != cand.id:
            raise HTTPException(403, "Нет доступа")
    elif user.role == UserRole.EMPLOYER:
        emp = db.query(Employer).filter(Employer.user_id == user.id).first()
        if not emp or inv.employer_id != emp.id:
            raise HTTPException(403, "Нет доступа")
    else:
        raise HTTPException(403, "Нет доступа")
    return inv


def _mark_read(db: Session, user_id: int, invitation_id: int, message_id: int) -> None:
    if message_id <= 0:
        return
    cursor = (
        db.query(ChatReadCursor)
        .filter(
            ChatReadCursor.user_id == user_id,
            ChatReadCursor.invitation_id == invitation_id,
        )
        .first()
    )
    if cursor:
        if message_id > cursor.last_read_message_id:
            cursor.last_read_message_id = message_id
    else:
        db.add(
            ChatReadCursor(
                user_id=user_id,
                invitation_id=invitation_id,
                last_read_message_id=message_id,
            )
        )


def _peer_for_invitation(db: Session, user: User, inv: Invitation) -> tuple[str, UserRole]:
    if user.role == UserRole.CANDIDATE:
        emp = (
            db.query(Employer)
            .options(joinedload(Employer.company))
            .filter(Employer.id == inv.employer_id)
            .first()
        )
        name = (emp.company.name if emp and emp.company else None) or (
            emp.full_name if emp and emp.full_name else "Работодатель"
        )
        return name, UserRole.EMPLOYER
    cand = db.query(Candidate).filter(Candidate.id == inv.candidate_id).first()
    name = (cand.full_name if cand and cand.full_name else None) or "Кандидат"
    return name, UserRole.CANDIDATE


def _accessible_invitations(db: Session, user: User) -> list[Invitation]:
    if user.role == UserRole.CANDIDATE:
        cand = db.query(Candidate).filter(Candidate.user_id == user.id).first()
        if not cand:
            return []
        return (
            db.query(Invitation)
            .filter(
                Invitation.candidate_id == cand.id,
                Invitation.status.in_(list(_CHAT_ALLOWED)),
            )
            .all()
        )
    if user.role == UserRole.EMPLOYER:
        emp = db.query(Employer).filter(Employer.user_id == user.id).first()
        if not emp:
            return []
        return (
            db.query(Invitation)
            .filter(
                Invitation.employer_id == emp.id,
                Invitation.status.in_(list(_CHAT_ALLOWED)),
            )
            .all()
        )
    return []


@router.get("/inbox", response_model=ChatUnreadSummary)
def chat_inbox(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invs = _accessible_invitations(db, user)
    items: list[ChatInboxItem] = []
    total = 0
    for inv in invs:
        rows = (
            db.query(ChatMessage)
            .filter(ChatMessage.invitation_id == inv.id)
            .order_by(ChatMessage.id.asc())
            .all()
        )
        if not rows:
            continue
        cursor = (
            db.query(ChatReadCursor)
            .filter(
                ChatReadCursor.user_id == user.id,
                ChatReadCursor.invitation_id == inv.id,
            )
            .first()
        )
        last_read = cursor.last_read_message_id if cursor else 0
        unread = sum(1 for m in rows if m.id > last_read and m.sender_user_id != user.id)
        last = rows[-1]
        sender = db.query(User).filter(User.id == last.sender_user_id).first()
        peer_label, peer_role = _peer_for_invitation(db, user, inv)
        items.append(
            ChatInboxItem(
                invitation_id=inv.id,
                peer_label=peer_label,
                peer_role=peer_role,
                last_body=last.body[:160],
                last_at=last.created_at,
                last_sender_role=sender.role if sender else None,
                unread_count=unread,
                status=inv.status,
            )
        )
        total += unread

    items.sort(key=lambda x: x.last_at.timestamp() if x.last_at else 0, reverse=True)
    return ChatUnreadSummary(total_unread=total, items=items)


@router.post("/{invitation_id}/read", status_code=204)
def mark_chat_read(
    invitation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _can_access_invitation(db, user, invitation_id)
    last = (
        db.query(ChatMessage)
        .filter(ChatMessage.invitation_id == invitation_id)
        .order_by(ChatMessage.id.desc())
        .first()
    )
    if last:
        _mark_read(db, user.id, invitation_id, last.id)
        db.commit()
    return None


@router.get("/{invitation_id}", response_model=list[ChatMessageOut])
def list_messages(
    invitation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _can_access_invitation(db, user, invitation_id)
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.invitation_id == invitation_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    result = []
    for m in rows:
        sender = db.query(User).filter(User.id == m.sender_user_id).first()
        result.append(
            ChatMessageOut(
                id=m.id,
                invitation_id=m.invitation_id,
                sender_user_id=m.sender_user_id,
                sender_role=sender.role if sender else UserRole.CANDIDATE,
                body=m.body,
                created_at=m.created_at,
            )
        )
    if rows:
        _mark_read(db, user.id, invitation_id, rows[-1].id)
        db.commit()
    return result


@router.post("/{invitation_id}", response_model=ChatMessageOut, status_code=201)
def post_message(
    invitation_id: int,
    body: ChatMessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _can_access_invitation(db, user, invitation_id)
    text = body.body.strip()
    if not text:
        raise HTTPException(400, "Сообщение не может быть пустым")
    msg = ChatMessage(invitation_id=invitation_id, sender_user_id=user.id, body=text)
    db.add(msg)
    db.flush()
    _mark_read(db, user.id, invitation_id, msg.id)
    db.commit()
    db.refresh(msg)
    return ChatMessageOut(
        id=msg.id,
        invitation_id=msg.invitation_id,
        sender_user_id=msg.sender_user_id,
        sender_role=user.role,
        body=msg.body,
        created_at=msg.created_at,
    )
