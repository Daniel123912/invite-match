from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

from app.models import (
    EmployerTaskType,
    GradeLevel,
    Industry,
    InvitationStatus,
    Specialization,
    TaskAssignmentStatus,
    UserRole,
)


# ── Auth ──────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    role: UserRole
    full_name: str = ""
    # Обязательное согласие на обработку ПДн (152-ФЗ)
    consent_152fz: bool = False
    birth_date: Optional[date] = None
    parental_consent: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: int


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


# ── Candidate ─────────────────────────────────────────

class CandidateProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None
    city: Optional[str] = None
    about: Optional[str] = None
    resume_text: Optional[str] = None
    stack: Optional[str] = None
    fsp_id: Optional[str] = None
    privacy_public: Optional[bool] = None
    consent_152fz: Optional[bool] = None
    birth_date: Optional[date] = None
    parental_consent: Optional[bool] = None


class SurveyRequest(BaseModel):
    industry: Industry
    specialization: Specialization
    selected_grade: GradeLevel
    specializations: Optional[list[Specialization]] = None


class CandidateOut(BaseModel):
    id: int
    full_name: str
    phone: Optional[str] = None
    telegram: Optional[str] = None
    city: Optional[str] = None
    about: Optional[str] = None
    resume_text: Optional[str] = None
    stack: Optional[str] = None
    industry: Optional[Industry] = None
    specialization: Optional[Specialization] = None
    selected_grade: Optional[GradeLevel] = None
    confirmed_grade: Optional[GradeLevel] = None
    category_id: Optional[int] = None
    test_score: Optional[float] = None
    fsp_id: Optional[str] = None
    fsp_score: float = 0.0
    has_fsp_history: bool = False
    privacy_public: bool = True
    consent_152fz: bool = False
    consent_152fz_at: Optional[datetime] = None
    resume_file_name: Optional[str] = None
    resume_content_type: Optional[str] = None
    birth_date: Optional[date] = None
    parental_consent: bool = False
    specializations: list[Specialization] = []

    model_config = {"from_attributes": True}


class CandidatePublicOut(BaseModel):
    """Contacts hidden until invitation accepted."""

    id: int
    full_name: str
    city: Optional[str] = None
    about: Optional[str] = None
    stack: Optional[str] = None
    specialization: Optional[Specialization] = None
    selected_grade: Optional[GradeLevel] = None
    confirmed_grade: Optional[GradeLevel] = None
    grade_confirmed: bool = False
    category_id: Optional[int] = None
    test_score: Optional[float] = None
    fsp_score: float = 0.0
    has_fsp_history: bool = False
    rank_score: Optional[float] = None
    reason: Optional[str] = None


# ── Test ──────────────────────────────────────────────

class QuestionOut(BaseModel):
    id: int
    topic: str
    text: str
    options: list[str]
    difficulty: int


class TestStartResponse(BaseModel):
    attempt_id: int
    variant_group: str
    questions: list[QuestionOut]
    category_title: str
    integrity_hint: str = ""


class TestSubmitRequest(BaseModel):
    attempt_id: int
    answers: dict[int, int]  # question_id -> option index


class ProctorEventRequest(BaseModel):
    event: Literal["blur", "paste", "visibility"]


class TestResultOut(BaseModel):
    attempt_id: int
    score: float
    passed: bool
    confirmed_grade: Optional[GradeLevel] = None
    category_id: Optional[int] = None
    category_title: Optional[str] = None
    proctor_flagged: bool = False
    plagiarism_score: Optional[float] = None


class CategoryResultOut(BaseModel):
    """Текущая категория кандидата после успешного теста."""

    category_id: Optional[int] = None
    category_title: Optional[str] = None
    specialization: Optional[Specialization] = None
    selected_grade: Optional[GradeLevel] = None
    confirmed_grade: Optional[GradeLevel] = None
    grade_confirmed: bool = False
    test_score: Optional[float] = None
    has_fsp_history: bool = False
    fsp_score: float = 0.0
    last_grade_change_at: Optional[datetime] = None
    cooldown_days: int = 90


class TestAttemptOut(BaseModel):
    id: int
    category_id: int
    category_title: Optional[str] = None
    variant_group: str
    score: Optional[float] = None
    passed: Optional[bool] = None
    started_at: datetime
    finished_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Employer / Company ────────────────────────────────

class CompanyUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[Industry] = None
    city: Optional[str] = None


class CompanyOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[Industry] = None
    city: Optional[str] = None
    verified: bool = False
    verification_note: Optional[str] = None

    model_config = {"from_attributes": True}


class NeedCreate(BaseModel):
    title: str
    specialization: Specialization
    grade: GradeLevel
    stack: Optional[str] = None
    description: Optional[str] = None
    salary_from: int = Field(gt=0)
    salary_to: int = Field(gt=0)
    salary_gross: bool = True


class NeedOut(BaseModel):
    id: int
    title: str
    specialization: Specialization
    grade: GradeLevel
    stack: Optional[str] = None
    description: Optional[str] = None
    salary_from: int
    salary_to: int
    salary_gross: bool = True
    report_count: int = 0
    is_suspicious: bool = False
    company_verified: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class NeedReportRequest(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)


class PublicNeedOut(BaseModel):
    id: int
    title: str
    specialization: Specialization
    grade: GradeLevel
    stack: Optional[str] = None
    description: Optional[str] = None
    salary_from: int
    salary_to: int
    salary_gross: bool
    company_name: str
    company_verified: bool
    is_suspicious: bool


# ── Match / Invitations ───────────────────────────────

class InvitationCreate(BaseModel):
    candidate_id: int
    need_id: Optional[int] = None
    employer_task_id: Optional[int] = None
    message: str
    salary_from: int = Field(gt=0)
    salary_to: int = Field(gt=0)


class InvitationOut(BaseModel):
    id: int
    employer_id: int
    candidate_id: int
    need_id: Optional[int] = None
    message: str
    salary_from: int
    salary_to: int
    status: InvitationStatus
    reason: Optional[str] = None
    created_at: datetime
    company_name: Optional[str] = None
    candidate_name: Optional[str] = None
    # Contacts only if accepted
    candidate_phone: Optional[str] = None
    candidate_telegram: Optional[str] = None
    candidate_email: Optional[str] = None
    contacts_revoked: bool = False

    model_config = {"from_attributes": True}


class InvitationStatusUpdate(BaseModel):
    status: InvitationStatus


class ContactsRevokeRequest(BaseModel):
    """Отозвать доступ работодателя к контактам после accept."""

    revoke: bool = True


class CategoryOut(BaseModel):
    id: int
    specialization: Specialization
    grade: GradeLevel
    title: str
    description: Optional[str] = None
    candidates_count: int = 0

    model_config = {"from_attributes": True}


class MatchResponse(BaseModel):
    category: CategoryOut
    candidates: list[CandidatePublicOut]


class SandboxRunRequest(BaseModel):
    code: str
    stdin: str = ""


class SandboxRunResponse(BaseModel):
    ok: bool
    stdout: str
    stderr: str
    exit_code: int


class EmployerTaskCreate(BaseModel):
    title: str
    task_type: EmployerTaskType
    prompt: str
    options: Optional[list[str]] = None
    correct_index: Optional[int] = None
    expected_stdout: Optional[str] = None


class EmployerTaskOut(BaseModel):
    id: int
    title: str
    task_type: EmployerTaskType
    prompt: str
    options: Optional[list[str]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskAssignmentOut(BaseModel):
    id: int
    task_id: int
    task_title: str
    task_type: EmployerTaskType
    prompt: str
    options: Optional[list[str]] = None
    status: TaskAssignmentStatus
    score: Optional[float] = None
    feedback: Optional[str] = None
    invitation_id: Optional[int] = None
    company_name: Optional[str] = None
    candidate_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    answer_text: Optional[str] = None
    answer_mcq_index: Optional[int] = None
    code_submitted: Optional[str] = None


class TaskSubmitRequest(BaseModel):
    answer_mcq_index: Optional[int] = None
    answer_text: Optional[str] = None
    code: Optional[str] = None


class ChatMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ChatMessageOut(BaseModel):
    id: int
    invitation_id: int
    sender_user_id: int
    sender_role: UserRole
    body: str
    created_at: datetime


class ChatInboxItem(BaseModel):
    invitation_id: int
    peer_label: str
    peer_role: UserRole
    last_body: Optional[str] = None
    last_at: Optional[datetime] = None
    last_sender_role: Optional[UserRole] = None
    unread_count: int = 0
    status: InvitationStatus


class ChatUnreadSummary(BaseModel):
    total_unread: int
    items: list[ChatInboxItem]


class AtsExportOut(BaseModel):
    format: str = "fsp-ats-stub-v1"
    invitation_id: int
    candidate_id: int
    payload: dict


class AtsWebhookIn(BaseModel):
    event: str
    invitation_id: Optional[int] = None
    payload: dict = Field(default_factory=dict)
