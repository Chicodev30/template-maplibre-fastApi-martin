"""initial: users

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.db.base import APP_SCHEMA

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("keycloak_sub", sa.String(length=255), nullable=True),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("effective_role", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("keycloak_sub", name="uq_users_keycloak_sub"),
        schema=APP_SCHEMA,
    )
    op.create_index("ix_users_keycloak_sub", "users", ["keycloak_sub"], schema=APP_SCHEMA)
    op.create_index("ix_users_email", "users", ["email"], schema=APP_SCHEMA)


def downgrade() -> None:
    op.drop_index("ix_users_email", "users", schema=APP_SCHEMA)
    op.drop_index("ix_users_keycloak_sub", "users", schema=APP_SCHEMA)
    op.drop_table("users", schema=APP_SCHEMA)
