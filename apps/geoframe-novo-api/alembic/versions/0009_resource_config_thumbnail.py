"""add thumbnail column to resource_configs

Revision ID: 0009_resource_config_thumbnail
Revises: 0008_storage_buckets
Create Date: 2026-06-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.db.base import APP_SCHEMA

revision: str = "0009_resource_config_thumbnail"
down_revision: Union[str, None] = "0008_storage_buckets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "resource_configs",
        sa.Column("thumbnail", sa.String(), nullable=True),
        schema=APP_SCHEMA,
    )


def downgrade() -> None:
    op.drop_column("resource_configs", "thumbnail", schema=APP_SCHEMA)
