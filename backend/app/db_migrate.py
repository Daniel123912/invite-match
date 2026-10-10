"""Лёгкие ALTER для новых колонок без Alembic (хакатон MVP)."""

from sqlalchemy import inspect, text

from app.database import engine


def ensure_columns() -> None:
    dialect = engine.dialect.name
    bool_default = "BOOLEAN DEFAULT 0" if dialect == "sqlite" else "BOOLEAN DEFAULT FALSE"
    int_default = "INTEGER DEFAULT 0"

    alterations: list[tuple[str, str, str]] = [
        ("candidates", "consent_152fz_at", "TIMESTAMP"),
        ("candidates", "resume_file_name", "VARCHAR(255)"),
        ("candidates", "resume_storage_key", "VARCHAR(500)"),
        ("candidates", "resume_content_type", "VARCHAR(120)"),
        ("candidates", "birth_date", "TIMESTAMP"),
        ("candidates", "parental_consent", bool_default),
        ("candidates", "specializations_json", "TEXT"),
        ("employers", "consent_152fz", bool_default),
        ("employers", "consent_152fz_at", "TIMESTAMP"),
        ("invitations", "contacts_revoked", bool_default),
        ("invitations", "contact_email", "VARCHAR(255)"),
        ("invitations", "contact_phone", "VARCHAR(50)"),
        ("invitations", "contact_telegram", "VARCHAR(100)"),
        ("companies", "verified", bool_default),
        ("companies", "verification_note", "VARCHAR(255)"),
        ("companies", "contact_email", "VARCHAR(255)"),
        ("companies", "contact_phone", "VARCHAR(50)"),
        ("companies", "contact_telegram", "VARCHAR(100)"),
        # Существующие аккаунты считаем подтверждёнными; новые — email_verified=False в register
        (
            "users",
            "email_verified",
            "BOOLEAN DEFAULT 1" if dialect == "sqlite" else "BOOLEAN DEFAULT TRUE",
        ),
        ("users", "email_confirm_token", "VARCHAR(64)"),
        ("employer_needs", "salary_gross", bool_default),
        ("employer_needs", "report_count", int_default),
        ("employer_needs", "is_suspicious", bool_default),
        ("test_attempts", "proctor_blur_count", int_default),
        ("test_attempts", "proctor_paste_count", int_default),
        ("test_attempts", "proctor_flagged", bool_default),
        ("test_attempts", "plagiarism_score", "FLOAT"),
    ]

    with engine.begin() as conn:
        insp = inspect(conn)
        tables = set(insp.get_table_names())
        for table, column, coltype in alterations:
            if table not in tables:
                continue
            existing = {c["name"] for c in insp.get_columns(table)}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}"))
                insp = inspect(conn)
                tables = set(insp.get_table_names())
