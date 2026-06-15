"""resource config profiles (perfis de campos/seguranca/zoom por recurso)

Revision ID: 0007_resource_config_profiles
Revises: 0006_layer_styles
Create Date: 2026-06-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.db.base import APP_SCHEMA

revision: str = "0007_resource_config_profiles"
down_revision: Union[str, None] = "0006_layer_styles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "resource_config_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resource_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("fields", sa.JSON(), nullable=False),
        sa.Column("security_rules", sa.JSON(), nullable=False),
        sa.Column("min_zoom", sa.Integer(), nullable=True),
        sa.Column("max_zoom", sa.Integer(), nullable=True),
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
        schema=APP_SCHEMA,
    )
    op.create_index(
        "ix_resource_config_profiles_resource_id",
        "resource_config_profiles",
        ["resource_id"],
        schema=APP_SCHEMA,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_resource_config_profiles_resource_id",
        table_name="resource_config_profiles",
        schema=APP_SCHEMA,
    )
    op.drop_table("resource_config_profiles", schema=APP_SCHEMA)
