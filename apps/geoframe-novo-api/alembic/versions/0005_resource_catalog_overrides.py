"""resource catalog overrides (bbox override + excluded features)

Revision ID: 0005_resource_overrides
Revises: 0004_layer_groups
Create Date: 2026-06-13

"""
from typing import Sequence, Union

from alembic import op

from app.db.base import APP_SCHEMA

revision: str = "0005_resource_overrides"
down_revision: Union[str, None] = "0004_layer_groups"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        f'ALTER TABLE "{APP_SCHEMA}"."resource_configs" '
        "ADD COLUMN IF NOT EXISTS bbox_override JSON NULL"
    )
    op.execute(
        f'ALTER TABLE "{APP_SCHEMA}"."resource_configs" '
        "ADD COLUMN IF NOT EXISTS excluded_features JSON NOT NULL DEFAULT '[]'::json"
    )


def downgrade() -> None:
    op.execute(
        f'ALTER TABLE "{APP_SCHEMA}"."resource_configs" '
        "DROP COLUMN IF EXISTS excluded_features"
    )
    op.execute(
        f'ALTER TABLE "{APP_SCHEMA}"."resource_configs" '
        "DROP COLUMN IF EXISTS bbox_override"
    )
