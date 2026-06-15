# Rotas de group-layers (publicacoes em arvore).
# Um group-layer e a arvore que o LayerTree do app vai renderizar: folders
# (grupos internos) e camadas (referencia a um recurso do catalogo) com
# rotulo, escala de zoom, filtro e estilo proprios. A arvore inteira e
# persistida como JSON no modelo LayerGroup (schema gfr_app).
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.dependencies import require_role
from app.models.group_layer import LayerGroup
from app.models.role import AppRole
from app.models.user import User

router = APIRouter(prefix="/catalog/group-layers", tags=["group-layers"])


# --- Estilo / filtro de uma camada -----------------------------------------
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


class FilterRule(BaseModel):
    id: str
    field: str
    operator: str = "equals"
    value: str = ""


# --- No da arvore -----------------------------------------------------------
# Modelo unico permissivo (folder e layer no mesmo shape, discriminados por
# `kind`) para simplificar a recursao em Pydantic.
class TreeNode(BaseModel):
    id: str
    kind: str  # "folder" | "layer"
    label: str
    visible: bool = True
    # folder
    expanded: bool = True
    children: list["TreeNode"] = Field(default_factory=list)
    # layer
    resourceId: str | None = None
    minZoom: int | None = None
    maxZoom: int | None = None
    configProfileId: int | None = None
    filterRules: list[FilterRule] = Field(default_factory=list)
    sqlFilter: str | None = None
    style: LayerStyle | None = None


TreeNode.model_rebuild()


class LayerGroupIn(BaseModel):
    name: str
    description: str | None = None
    visible: bool = True
    tree: list[TreeNode] = Field(default_factory=list)


class LayerGroupSummary(BaseModel):
    id: int
    name: str
    description: str | None = None
    visible: bool
    layerCount: int
    updatedAt: datetime


class LayerGroupDetail(LayerGroupSummary):
    tree: list[TreeNode]


def _count_layers(nodes: list[dict]) -> int:
    total = 0
    for node in nodes:
        if node.get("kind") == "layer":
            total += 1
        children = node.get("children") or []
        if children:
            total += _count_layers(children)
    return total


def _summary(group: LayerGroup) -> LayerGroupSummary:
    return LayerGroupSummary(
        id=group.id,
        name=group.name,
        description=group.description,
        visible=group.visible,
        layerCount=_count_layers(group.tree or []),
        updatedAt=group.updated_at,
    )


def _detail(group: LayerGroup) -> LayerGroupDetail:
    return LayerGroupDetail(
        id=group.id,
        name=group.name,
        description=group.description,
        visible=group.visible,
        layerCount=_count_layers(group.tree or []),
        updatedAt=group.updated_at,
        tree=[TreeNode.model_validate(node) for node in (group.tree or [])],
    )


def _get_or_404(group_id: int, db: Session) -> LayerGroup:
    group = db.get(LayerGroup, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Grupo de camadas nao encontrado")
    return group


def _apply(group: LayerGroup, payload: LayerGroupIn) -> None:
    group.name = payload.name
    group.description = payload.description
    group.visible = payload.visible
    group.tree = [node.model_dump() for node in payload.tree]


@router.get("", response_model=list[LayerGroupSummary])
def list_groups(db: Session = Depends(get_session)) -> list[LayerGroupSummary]:
    groups = db.execute(select(LayerGroup).order_by(LayerGroup.name)).scalars().all()
    return [_summary(group) for group in groups]


@router.post("", response_model=LayerGroupDetail, status_code=201)
def create_group(
    payload: LayerGroupIn,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> LayerGroupDetail:
    group = LayerGroup()
    _apply(group, payload)
    db.add(group)
    db.commit()
    db.refresh(group)
    return _detail(group)


@router.get("/{group_id}", response_model=LayerGroupDetail)
def get_group(group_id: int, db: Session = Depends(get_session)) -> LayerGroupDetail:
    return _detail(_get_or_404(group_id, db))


@router.put("/{group_id}", response_model=LayerGroupDetail)
def update_group(
    group_id: int,
    payload: LayerGroupIn,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> LayerGroupDetail:
    group = _get_or_404(group_id, db)
    _apply(group, payload)
    db.commit()
    db.refresh(group)
    return _detail(group)


@router.delete("/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> None:
    group = _get_or_404(group_id, db)
    db.delete(group)
    db.commit()
