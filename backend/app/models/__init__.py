from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, PyEnum):
    CANDIDATE = "candidate"
    EMPLOYER = "employer"
    ADMIN = "admin"


class GradeLevel(str, PyEnum):
    JUNIOR = "junior"
    MIDDLE = "middle"
    SENIOR = "senior"


class InvitationStatus(str, PyEnum):
    SENT = "sent"
    VIEWED = "viewed"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class Specialization(str, PyEnum):
    BACKEND = "backend"
    FRONTEND = "frontend"
    FULLSTACK = "fullstack"
    DEVOPS = "devops"
    DATA = "data"
    QA = "qa"
    MOBILE = "mobile"


class Industry(str, PyEnum):
    IT = "it"
    FINTECH = "fintech"
    ECOMMERCE = "ecommerce"
    EDTECH = "edtech"
    HEALTHTECH = "healthtech"
    OTHER = "other"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.CANDIDATE)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    candidate: Mapped[Optional["Candidate"]] = relationship(back_populates="user", uselist=False)
    employer: Mapped[Optional["Employer"]] = relationship(back_populates="user", uselist=False)


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    telegram: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    about: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resume_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resume_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    resume_content_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    resume_storage_key: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    stack: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # comma-separated

    industry: Mapped[Optional[Industry]] = mapped_column(Enum(Industry), nullable=True)
    specialization: Mapped[Optional[Specialization]] = mapped_column(Enum(Specialization), nullable=True)
    selected_grade: Mapped[Optional[GradeLevel]] = mapped_column(Enum(GradeLevel), nullable=True)
    confirmed_grade: Mapped[Optional[GradeLevel]] = mapped_column(Enum(GradeLevel), nullable=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)

    test_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fsp_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fsp_score: Mapped[float] = mapped_column(Float, default=0.0)
    has_fsp_history: Mapped[bool] = mapped_column(Boolean, default=False)

    privacy_public: Mapped[bool] = mapped_column(Boolean, default=True)
    consent_152fz: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_152fz_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_grade_change_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="candidate")
    category: Mapped[Optional["Category"]] = relationship(back_populates="candidates")
    test_attempts: Mapped[list["TestAttempt"]] = relationship(back_populates="candidate")
    invitations: Mapped[list["Invitation"]] = relationship(back_populates="candidate")


class Employer(Base):
    __tablename__ = "employers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    company_id: Mapped[Optional[int]] = mapped_column(ForeignKey("companies.id"), nullable=True)
    # Согласие на обработку ПДн кандидатов в рамках приглашений (152-ФЗ)
    consent_152fz: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_152fz_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="employer")
    company: Mapped[Optional["Company"]] = relationship(back_populates="employers")
    needs: Mapped[list["EmployerNeed"]] = relationship(back_populates="employer")
    invitations: Mapped[list["Invitation"]] = relationship(back_populates="employer")


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    industry: Mapped[Optional[Industry]] = mapped_column(Enum(Industry), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    employers: Mapped[list["Employer"]] = relationship(back_populates="company")


class Category(Base):
    """Specialization × Grade (e.g. Backend × Middle)."""

    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("specialization", "grade", name="uq_spec_grade"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    specialization: Mapped[Specialization] = mapped_column(Enum(Specialization))
    grade: Mapped[GradeLevel] = mapped_column(Enum(GradeLevel))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    candidates: Mapped[list["Candidate"]] = relationship(back_populates="category")
    questions: Mapped[list["TestQuestion"]] = relationship(back_populates="category")


class TestQuestion(Base):
    __tablename__ = "test_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    variant_group: Mapped[str] = mapped_column(String(50))  # anti-leak: different variants
    topic: Mapped[str] = mapped_column(String(100))
    text: Mapped[str] = mapped_column(Text)
    options_json: Mapped[str] = mapped_column(Text)  # JSON list of options
    correct_index: Mapped[int] = mapped_column(Integer)
    difficulty: Mapped[int] = mapped_column(Integer, default=1)  # 1-3

    category: Mapped["Category"] = relationship(back_populates="questions")


class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    variant_group: Mapped[str] = mapped_column(String(50))
    question_ids_json: Mapped[str] = mapped_column(Text)
    answers_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    passed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    candidate: Mapped["Candidate"] = relationship(back_populates="test_attempts")


class EmployerNeed(Base):
    """Who we're looking for."""

    __tablename__ = "employer_needs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id"))
    title: Mapped[str] = mapped_column(String(255))
    specialization: Mapped[Specialization] = mapped_column(Enum(Specialization))
    grade: Mapped[GradeLevel] = mapped_column(Enum(GradeLevel))
    stack: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    salary_from: Mapped[int] = mapped_column(Integer)
    salary_to: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    employer: Mapped["Employer"] = relationship(back_populates="needs")


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id"))
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    need_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employer_needs.id"), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    salary_from: Mapped[int] = mapped_column(Integer)
    salary_to: Mapped[int] = mapped_column(Integer)
    status: Mapped[InvitationStatus] = mapped_column(
        Enum(InvitationStatus), default=InvitationStatus.SENT
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # why in shortlist
    # Кандидат отозвал доступ к контактам после accept (плюс к 152-ФЗ)
    contacts_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    employer: Mapped["Employer"] = relationship(back_populates="invitations")
    candidate: Mapped["Candidate"] = relationship(back_populates="invitations")


class FspAchievement(Base):
    """Stub for FSP achievements integration."""

    __tablename__ = "fsp_achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fsp_id: Mapped[str] = mapped_column(String(100), index=True)
    title: Mapped[str] = mapped_column(String(255))
    points: Mapped[float] = mapped_column(Float, default=0.0)
    achieved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
