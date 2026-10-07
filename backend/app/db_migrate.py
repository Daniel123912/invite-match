"""Лёгкие ALTER для новых колонок без Alembic (хакатон MVP)."""

from sqlalchemy import inspect, text

from app.database import engine


def ensure_columns() -> None:
    dialect = engine.dialect.name
    bool_default = "BOOLEAN DEFAULT 0" if dialect == "sqlite" else "BOOLEAN DEFAULT FALSE"

    alterations: list[tuple[str, str, str]] = [
        ("candidates", "consent_152fz_at", "TIMESTAMP"),
        ("employers", "consent_152fz", bool_default),
        ("employers", "consent_152fz_at", "TIMESTAMP"),
        ("invitations", "contacts_revoked", bool_default),
        ("candidates", "resume_file_name", "VARCHAR(255)"),
        ("candidates", "resume_content_type", "VARCHAR(120)"),
        ("candidates", "resume_storage_key", "VARCHAR(80)"),
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
                # refresh column cache for next checks on same connection
                insp = inspect(conn)
                tables = set(insp.get_table_names())
