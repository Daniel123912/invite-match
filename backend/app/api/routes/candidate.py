import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_role
from app.database import get_db
from app.models import Candidate, Category, User, UserRole
from app.schemas import (
    CandidateOut,
    CandidateProfileUpdate,
    QuestionOut,
    SurveyRequest,
    TestResultOut,
    TestStartResponse,
    TestSubmitRequest,
)
from app.services import test_service

router = APIRouter(prefix="/candidate", tags=["candidate"])


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
    for field, value in body.model_dump(exclude_unset=True).items():
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


@router.post("/survey", response_model=CandidateOut)
def submit_survey(
    body: SurveyRequest,
    user: User = Depends(require_role(UserRole.CANDIDATE)),
    db: Session = Depends(get_db),
):
    c = _get_candidate(user, db)
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
