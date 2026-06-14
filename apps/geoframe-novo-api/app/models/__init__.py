# Importa os models para registra-los no metadata da Base (Alembic/SQLAlchemy).
from app.models.user import User
from app.models.resource import ResourceConfig
from app.models.group_layer import LayerGroup
from app.models.layer_style import LayerStyleConfig

__all__ = ["User", "ResourceConfig", "LayerGroup", "LayerStyleConfig"]
