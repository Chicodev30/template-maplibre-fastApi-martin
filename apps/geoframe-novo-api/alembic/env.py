from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, text

from app.config import get_settings
from app.db.base import APP_SCHEMA, Base
import app.models  # noqa: F401  (registra os models no metadata)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
settings = get_settings()


def run_migrations_online() -> None:
    engine = create_engine(settings.database_url, future=True)
    with engine.connect() as connection:
        # Garante o schema dedicado antes de criar a tabela de versao do Alembic.
        connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{APP_SCHEMA}"'))
        connection.commit()

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=APP_SCHEMA,
            include_schemas=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    raise SystemExit("Modo offline nao suportado neste projeto.")
run_migrations_online()
