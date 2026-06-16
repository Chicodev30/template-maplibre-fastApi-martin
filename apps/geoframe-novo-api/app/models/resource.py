# Modelos de configuracao de recurso.
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ResourceConfig(Base):
    __tablename__ = "resource_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    resource_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    layer_label: Mapped[str] = mapped_column(String(255))
    fields: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    security_rules: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    bbox_override: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)
    excluded_features: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    thumbnail: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class ResourceConfigProfile(Base):
    # Perfil de configuracao nomeado e reutilizavel para um recurso: subconjunto
    # de campos/seguranca/zoom alternativo ao default (sem perfil = todos os
    # campos visiveis em tabela/popup, sem restricao, sem limite de zoom).
    __tablename__ = "resource_config_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    resource_id: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255))
    fields: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    security_rules: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    min_zoom: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_zoom: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
