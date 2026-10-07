"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-10-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Таблицы создаёт Base.metadata.create_all / ensure_columns на старте.
    # Ревизия фиксирует baseline для дальнейших Alembic-миграций.
    pass


def downgrade() -> None:
    pass
