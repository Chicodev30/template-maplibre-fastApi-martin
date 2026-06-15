"""storage buckets (config e permissoes de acesso para o Explorador de arquivos)

Revision ID: 0008_storage_buckets
Revises: 0007_resource_config_profiles
Create Date: 2026-06-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.db.base import APP_SCHEMA

revision: str = "0008_storage_buckets"
down_revision: Union[str, None] = "0007_resource_config_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bucket_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bucket_name", sa.String(length=63), nullable=False),
        sa.Column("allowed_extensions", sa.JSON(), nullable=False),
        sa.Column("max_file_size_mb", sa.Integer(), nullable=False),
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
        "ix_bucket_configs_bucket_name",
        "bucket_configs",
        ["bucket_name"],
        unique=True,
        schema=APP_SCHEMA,
    )

    op.create_table(
        "bucket_access_grants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bucket_name", sa.String(length=63), nullable=False),
        sa.Column("principal_type", sa.String(length=20), nullable=False),
        sa.Column("principal_value", sa.String(length=255), nullable=False),
        sa.Column("can_upload", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("can_delete", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        schema=APP_SCHEMA,
    )
    op.create_index(
        "ix_bucket_access_grants_bucket_name",
        "bucket_access_grants",
        ["bucket_name"],
        schema=APP_SCHEMA,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_bucket_access_grants_bucket_name",
        table_name="bucket_access_grants",
        schema=APP_SCHEMA,
    )
    op.drop_table("bucket_access_grants", schema=APP_SCHEMA)

    op.drop_index(
        "ix_bucket_configs_bucket_name",
        table_name="bucket_configs",
        schema=APP_SCHEMA,
    )
    op.drop_table("bucket_configs", schema=APP_SCHEMA)
