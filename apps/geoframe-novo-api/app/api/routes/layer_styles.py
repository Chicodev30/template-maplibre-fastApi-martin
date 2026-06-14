# Rotas de estilos salvos (presets por recurso).
# Cada estilo e um preset de LayerStyle associado a um recurso do catalogo
# (resource_id no formato "schema.table"), reutilizavel em qualquer grupo de
# camadas que use esse recurso.
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.dependencies import require_role
from app.models.layer_style import LayerStyleConfig
from app.models.role import AppRole
from app.models.user import User

router = APIRouter(prefix="/catalog/styles", tags=["layer-styles"])


class LabelStyle(BaseModel):
    enabled: bool = False
    field: str | None = None
    color: str = "#222222"
    size: int = 12
    haloColor: str = "#ffffff"
    position: str = "top"
    fontFamily: str = "Noto Sans Regular"


class LayerStyle(BaseModel):
    color: str = "#3388ff"
    opacity: float = 0.8
    outlineColor: str | None = None
    outlineWidth: float = 1.0
    label: LabelStyle = Field(default_factory=LabelStyle)


class LayerStyleIn(BaseModel):
    resourceId: str
    name: str
    style: LayerStyle


class LayerStyleSummary(BaseModel):
    id: int
    resourceId: str
    name: str
    updatedAt: datetime


class LayerStyleDetail(LayerStyleSummary):
    style: LayerStyle


def _summary(config: LayerStyleConfig) -> LayerStyleSummary:
    return LayerStyleSummary(
        id=config.id,
        resourceId=config.resource_id,
        name=config.name,
        updatedAt=config.updated_at,
    )


def _detail(config: LayerStyleConfig) -> LayerStyleDetail:
    return LayerStyleDetail(
        id=config.id,
        resourceId=config.resource_id,
        name=config.name,
        updatedAt=config.updated_at,
        style=LayerStyle.model_validate(config.style),
    )


def _get_or_404(style_id: int, db: Session) -> LayerStyleConfig:
    config = db.get(LayerStyleConfig, style_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Estilo nao encontrado")
    return config


@router.get("", response_model=list[LayerStyleSummary])
def list_styles(
    resource_id: str | None = Query(default=None),
    db: Session = Depends(get_session),
) -> list[LayerStyleSummary]:
    stmt = select(LayerStyleConfig).order_by(LayerStyleConfig.name)
    if resource_id:
        stmt = stmt.where(LayerStyleConfig.resource_id == resource_id)
    configs = db.execute(stmt).scalars().all()
    return [_summary(config) for config in configs]


@router.post("", response_model=LayerStyleDetail, status_code=201)
def create_style(
    payload: LayerStyleIn,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> LayerStyleDetail:
    config = LayerStyleConfig(
        resource_id=payload.resourceId,
        name=payload.name,
        style=payload.style.model_dump(),
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return _detail(config)


@router.get("/{style_id}", response_model=LayerStyleDetail)
def get_style(style_id: int, db: Session = Depends(get_session)) -> LayerStyleDetail:
    return _detail(_get_or_404(style_id, db))


@router.put("/{style_id}", response_model=LayerStyleDetail)
def update_style(
    style_id: int,
    payload: LayerStyleIn,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> LayerStyleDetail:
    config = _get_or_404(style_id, db)
    config.resource_id = payload.resourceId
    config.name = payload.name
    config.style = payload.style.model_dump()
    db.commit()
    db.refresh(config)
    return _detail(config)


@router.delete("/{style_id}", status_code=204)
def delete_style(
    style_id: int,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> None:
    config = _get_or_404(style_id, db)
    db.delete(config)
    db.commit()
