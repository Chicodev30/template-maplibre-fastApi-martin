"""resource configs

Revision ID: 0002_resource_configs
Revises: 0001_initial
Create Date: 2026-06-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.db.base import APP_SCHEMA

revision: str = "0002_resource_configs"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "resource_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resource_id", sa.String(length=255), nullable=False),
        sa.Column("layer_label", sa.String(length=255), nullable=False),
        sa.Column("fields", sa.JSON(), nullable=False),
        sa.Column("security_rules", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("resource_id", name="uq_resource_configs_resource_id"),
        schema=APP_SCHEMA,
    )
    op.create_index(
        "ix_resource_configs_resource_id",
        "resource_configs",
        ["resource_id"],
        schema=APP_SCHEMA,
    )


def downgrade() -> None:
    op.drop_index("ix_resource_configs_resource_id", "resource_configs", schema=APP_SCHEMA)
    op.drop_table("resource_configs", schema=APP_SCHEMA)
