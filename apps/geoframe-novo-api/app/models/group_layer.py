# Modelo GroupLayer: publicacao em arvore consumida pelo LayerTree do app.
# A arvore inteira (folders + camadas, com rotulo/zoom/filtro/estilo) vive no
# JSON `tree`, na mesma filosofia do `fields`/`security_rules` de ResourceConfig.
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LayerGroup(Base):
    __tablename__ = "layer_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    tree: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
