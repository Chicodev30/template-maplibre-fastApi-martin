"""layer styles (presets de estilo por recurso)

Revision ID: 0006_layer_styles
Revises: 0005_resource_overrides
Create Date: 2026-06-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.db.base import APP_SCHEMA

revision: str = "0006_layer_styles"
down_revision: Union[str, None] = "0005_resource_overrides"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "layer_styles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resource_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("style", sa.JSON(), nullable=False),
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
        "ix_layer_styles_resource_id",
        "layer_styles",
        ["resource_id"],
        schema=APP_SCHEMA,
    )


def downgrade() -> None:
    op.drop_index("ix_layer_styles_resource_id", table_name="layer_styles", schema=APP_SCHEMA)
    op.drop_table("layer_styles", schema=APP_SCHEMA)
