# Importa os models para registra-los no metadata da Base (Alembic/SQLAlchemy).
from app.models.user import User
from app.models.resource import ResourceConfig

__all__ = ["User", "ResourceConfig"]
