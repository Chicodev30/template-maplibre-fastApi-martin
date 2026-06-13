"""resource config security rules

Revision ID: 0003_resource_security
Revises: 0002_resource_configs
Create Date: 2026-06-12

"""
from typing import Sequence, Union

from alembic import op

from app.db.base import APP_SCHEMA

revision: str = "0003_resource_security"
down_revision: Union[str, None] = "0002_resource_configs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        f'ALTER TABLE "{APP_SCHEMA}"."resource_configs" '
        "ADD COLUMN IF NOT EXISTS security_rules JSON NOT NULL DEFAULT '[]'::json"
    )


def downgrade() -> None:
    op.execute(
        f'ALTER TABLE "{APP_SCHEMA}"."resource_configs" '
        "DROP COLUMN IF EXISTS security_rules"
    )
