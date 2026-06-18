"""initial: schema completo

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-18

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
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {APP_SCHEMA}")

    # Usuários (espelho do Keycloak).
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("keycloak_sub", sa.String(length=255), nullable=True),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("effective_role", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("keycloak_sub", name="uq_users_keycloak_sub"),
        schema=APP_SCHEMA,
    )
    op.create_index("ix_users_keycloak_sub", "users", ["keycloak_sub"], schema=APP_SCHEMA)
    op.create_index("ix_users_email", "users", ["email"], schema=APP_SCHEMA)

    # Configurações de recursos (camadas).
    op.create_table(
        "resource_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resource_id", sa.String(length=255), nullable=False),
        sa.Column("layer_label", sa.String(length=255), nullable=False),
        sa.Column("fields", sa.JSON(), nullable=False),
        sa.Column("security_rules", sa.JSON(), nullable=False),
        sa.Column("bbox_override", sa.JSON(), nullable=True),
        sa.Column("excluded_features", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("thumbnail", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("resource_id", name="uq_resource_configs_resource_id"),
        schema=APP_SCHEMA,
    )
    op.create_index("ix_resource_configs_resource_id", "resource_configs", ["resource_id"], schema=APP_SCHEMA)

    # Perfis de configuração nomeados por recurso.
    op.create_table(
        "resource_config_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resource_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("fields", sa.JSON(), nullable=False),
        sa.Column("security_rules", sa.JSON(), nullable=False),
        sa.Column("min_zoom", sa.Integer(), nullable=True),
        sa.Column("max_zoom", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=APP_SCHEMA,
    )
    op.create_index("ix_resource_config_profiles_resource_id", "resource_config_profiles", ["resource_id"], schema=APP_SCHEMA)

    # Grupos de camadas (estrutura em árvore JSON).
    op.create_table(
        "layer_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("tree", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=APP_SCHEMA,
    )

    # Estilos de camada (JSON de estilo OpenLayers).
    op.create_table(
        "layer_styles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resource_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("style", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=APP_SCHEMA,
    )
    op.create_index("ix_layer_styles_resource_id", "layer_styles", ["resource_id"], schema=APP_SCHEMA)

    # Configuração de buckets MinIO.
    op.create_table(
        "bucket_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bucket_name", sa.String(length=63), nullable=False),
        sa.Column("allowed_extensions", sa.JSON(), nullable=False),
        sa.Column("max_file_size_mb", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=APP_SCHEMA,
    )
    op.create_index("ix_bucket_configs_bucket_name", "bucket_configs", ["bucket_name"], unique=True, schema=APP_SCHEMA)

    # Permissões de acesso aos buckets MinIO.
    op.create_table(
        "bucket_access_grants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bucket_name", sa.String(length=63), nullable=False),
        sa.Column("principal_type", sa.String(length=20), nullable=False),
        sa.Column("principal_value", sa.String(length=255), nullable=False),
        sa.Column("can_upload", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("can_delete", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=APP_SCHEMA,
    )
    op.create_index("ix_bucket_access_grants_bucket_name", "bucket_access_grants", ["bucket_name"], schema=APP_SCHEMA)

    # Logs de auditoria.
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("username", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("resource_type", sa.String(length=100), nullable=True),
        sa.Column("resource_id", sa.String(length=255), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=APP_SCHEMA,
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"], schema=APP_SCHEMA)
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"], schema=APP_SCHEMA)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs", schema=APP_SCHEMA)
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs", schema=APP_SCHEMA)
    op.drop_table("audit_logs", schema=APP_SCHEMA)

    op.drop_index("ix_bucket_access_grants_bucket_name", table_name="bucket_access_grants", schema=APP_SCHEMA)
    op.drop_table("bucket_access_grants", schema=APP_SCHEMA)
    op.drop_index("ix_bucket_configs_bucket_name", table_name="bucket_configs", schema=APP_SCHEMA)
    op.drop_table("bucket_configs", schema=APP_SCHEMA)

    op.drop_index("ix_layer_styles_resource_id", table_name="layer_styles", schema=APP_SCHEMA)
    op.drop_table("layer_styles", schema=APP_SCHEMA)
    op.drop_table("layer_groups", schema=APP_SCHEMA)

    op.drop_index("ix_resource_config_profiles_resource_id", table_name="resource_config_profiles", schema=APP_SCHEMA)
    op.drop_table("resource_config_profiles", schema=APP_SCHEMA)

    op.drop_index("ix_resource_configs_resource_id", table_name="resource_configs", schema=APP_SCHEMA)
    op.drop_table("resource_configs", schema=APP_SCHEMA)

    op.drop_index("ix_users_email", table_name="users", schema=APP_SCHEMA)
    op.drop_index("ix_users_keycloak_sub", table_name="users", schema=APP_SCHEMA)
    op.drop_table("users", schema=APP_SCHEMA)
