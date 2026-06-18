# Rotas de resources.
# Recursos são camadas GeoServer cadastradas pelo admin (workspace.layer).
import base64
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_async_db, get_session
from app.dependencies import require_role
from app.models.resource import ResourceConfig
from app.models.role import AppRole
from app.models.user import User

router = APIRouter(prefix="/catalog", tags=["resources"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AddResourceIn(BaseModel):
    source_id: str          # workspace.layer
    layer_label: str


class CatalogResourceOut(BaseModel):
    id: str
    layerLabel: str
    thumbnail: str | None = None


class ResourceFieldConfig(BaseModel):
    label: str
    searchable: bool = False
    showInTable: bool = True
    showInPopup: bool = True


class ResourceSecurityRule(BaseModel):
    id: str
    type: str = "hide_fields"
    fieldNames: list[str] = Field(default_factory=list)
    principals: list[str] = Field(default_factory=list)


class ExcludedFeature(BaseModel):
    property: str
    value: str | int


class ResourceConfigIn(BaseModel):
    layerLabel: str
    fields: dict[str, ResourceFieldConfig]
    securityRules: list[ResourceSecurityRule] = Field(default_factory=list)
    bboxOverride: list[float] | None = None
    excludedFeatures: list[ExcludedFeature] = Field(default_factory=list)


class ResourceConfigOut(ResourceConfigIn):
    resourceId: str


class ResourceOverrides(BaseModel):
    bboxOverride: list[float] | None = None
    excludedFeatures: list[ExcludedFeature] = Field(default_factory=list)


class ResourceAttributes(BaseModel):
    resourceId: str
    limit: int
    offset: int
    total: int
    rows: list[dict[str, Any]]
    columns: list[str]


# ---------------------------------------------------------------------------
# Catalog: lista e gestao manual de recursos
# ---------------------------------------------------------------------------

@router.get("/resources", response_model=list[CatalogResourceOut])
def list_resources(db: Session = Depends(get_session)) -> list[CatalogResourceOut]:
    configs = db.execute(select(ResourceConfig)).scalars().all()
    return [
        CatalogResourceOut(id=c.resource_id, layerLabel=c.layer_label, thumbnail=c.thumbnail)
        for c in sorted(configs, key=lambda c: c.layer_label.lower())
    ]


@router.post("/resources", response_model=CatalogResourceOut, status_code=201)
def add_resource(
    payload: AddResourceIn,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> CatalogResourceOut:
    if "." not in payload.source_id:
        raise HTTPException(status_code=400, detail="source_id deve ter formato workspace.layer")
    existing = db.execute(
        select(ResourceConfig).where(ResourceConfig.resource_id == payload.source_id)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Recurso ja existe")
    config = ResourceConfig(
        resource_id=payload.source_id,
        layer_label=payload.layer_label,
        fields={},
        security_rules=[],
        excluded_features=[],
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return CatalogResourceOut(id=config.resource_id, layerLabel=config.layer_label)


@router.delete("/resources/{source_id}", status_code=204)
def delete_resource(
    source_id: str,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> None:
    config = db.execute(
        select(ResourceConfig).where(ResourceConfig.resource_id == source_id)
    ).scalar_one_or_none()
    if config is None:
        raise HTTPException(status_code=404, detail="Recurso nao encontrado")
    db.delete(config)
    db.commit()


@router.get("/resources/overrides", response_model=dict[str, ResourceOverrides])
def list_resource_overrides(db: Session = Depends(get_session)) -> dict[str, ResourceOverrides]:
    from sqlalchemy import func, or_
    rows = db.execute(
        select(ResourceConfig).where(
            or_(
                ResourceConfig.bbox_override.is_not(None),
                func.json_array_length(ResourceConfig.excluded_features) > 0,
            )
        )
    ).scalars().all()
    return {
        c.resource_id: ResourceOverrides(
            bboxOverride=c.bbox_override,
            excludedFeatures=c.excluded_features,
        )
        for c in rows
    }


# ---------------------------------------------------------------------------
# GeoServer discovery: workspaces e layers disponíveis
# ---------------------------------------------------------------------------

@router.get("/geoserver/workspaces", response_model=list[str])
async def list_geoserver_workspaces(
    _user: User = Depends(require_role(AppRole.admin)),
) -> list[str]:
    """Lista workspaces disponíveis no GeoServer."""
    settings = get_settings()
    url = f"{settings.geoserver_base_url}/rest/workspaces.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url,
            auth=(settings.geoserver_user, settings.geoserver_password),
            timeout=10,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Falha ao consultar GeoServer")
    data = resp.json()
    workspaces = data.get("workspaces", {}).get("workspace", [])
    return sorted(w["name"] for w in workspaces)


@router.get("/geoserver/workspaces/{workspace}/layers", response_model=list[str])
async def list_geoserver_layers(
    workspace: str,
    _user: User = Depends(require_role(AppRole.admin)),
) -> list[str]:
    """Lista layers de um workspace do GeoServer."""
    settings = get_settings()
    url = f"{settings.geoserver_base_url}/rest/workspaces/{workspace}/layers.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url,
            auth=(settings.geoserver_user, settings.geoserver_password),
            timeout=10,
        )
    if resp.status_code == 404:
        return []
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Falha ao consultar GeoServer")
    data = resp.json()
    layers = data.get("layers", {}).get("layer", [])
    return sorted(la["name"] for la in layers)


# ---------------------------------------------------------------------------
# Config de recurso
# ---------------------------------------------------------------------------

@router.get("/resources/{source_id}/config", response_model=ResourceConfigOut)
def get_resource_config(
    source_id: str,
    db: Session = Depends(get_session),
) -> ResourceConfigOut:
    config = db.execute(
        select(ResourceConfig).where(ResourceConfig.resource_id == source_id)
    ).scalar_one_or_none()
    if config is None:
        layer_label = source_id.split(".", 1)[1] if "." in source_id else source_id
        return ResourceConfigOut(
            resourceId=source_id,
            layerLabel=layer_label,
            fields={},
            securityRules=[],
            bboxOverride=None,
            excludedFeatures=[],
        )
    return ResourceConfigOut(
        resourceId=config.resource_id,
        layerLabel=config.layer_label,
        fields=config.fields,
        securityRules=config.security_rules,
        bboxOverride=config.bbox_override,
        excludedFeatures=config.excluded_features,
    )


@router.put("/resources/{source_id}/config", response_model=ResourceConfigOut)
def save_resource_config(
    source_id: str,
    payload: ResourceConfigIn,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> ResourceConfigOut:
    config = db.execute(
        select(ResourceConfig).where(ResourceConfig.resource_id == source_id)
    ).scalar_one_or_none()
    if config is None:
        config = ResourceConfig(resource_id=source_id)
        db.add(config)
    config.layer_label = payload.layerLabel
    config.fields = {name: field.model_dump() for name, field in payload.fields.items()}
    config.security_rules = [rule.model_dump() for rule in payload.securityRules]
    config.bbox_override = payload.bboxOverride
    config.excluded_features = [feature.model_dump() for feature in payload.excludedFeatures]
    db.commit()
    db.refresh(config)
    return ResourceConfigOut(
        resourceId=config.resource_id,
        layerLabel=config.layer_label,
        fields=config.fields,
        securityRules=config.security_rules,
        bboxOverride=config.bbox_override,
        excludedFeatures=config.excluded_features,
    )


# ---------------------------------------------------------------------------
# Thumbnail
# ---------------------------------------------------------------------------

@router.post("/resources/{source_id}/thumbnail", status_code=204)
def save_thumbnail(
    source_id: str,
    payload: dict[str, str],
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> None:
    thumbnail = payload.get("thumbnail", "")
    config = db.execute(
        select(ResourceConfig).where(ResourceConfig.resource_id == source_id)
    ).scalar_one_or_none()
    if config is None:
        config = ResourceConfig(
            resource_id=source_id,
            layer_label=source_id.split(".", 1)[-1],
            fields={},
            security_rules=[],
            excluded_features=[],
        )
        db.add(config)
    config.thumbnail = thumbnail
    db.commit()


@router.get("/resources/{source_id}/thumbnail")
def get_thumbnail(source_id: str, db: Session = Depends(get_session)) -> Response:
    config = db.execute(
        select(ResourceConfig).where(ResourceConfig.resource_id == source_id)
    ).scalar_one_or_none()
    if not config or not config.thumbnail:
        raise HTTPException(status_code=404, detail="Sem thumbnail salvo")
    header, b64data = config.thumbnail.split(",", 1)
    img_bytes = base64.b64decode(b64data)
    return Response(content=img_bytes, media_type="image/png")


# ---------------------------------------------------------------------------
# Campos via information_schema (substitui WFS DescribeFeatureType)
# ---------------------------------------------------------------------------

class ResourceField(BaseModel):
    name: str
    data_type: str
    nullable: bool = True


@router.get("/resources/{source_id}/fields", response_model=list[ResourceField])
async def get_resource_fields(
    source_id: str,
    db: AsyncSession = Depends(get_async_db),
) -> list[ResourceField]:
    """Campos da tabela via information_schema (exclui colunas de geometria)."""
    schema, _, table = source_id.partition(".")
    if not table:
        raise HTTPException(status_code=400, detail="source_id deve ser schema.tabela")

    geom_cols_result = await db.execute(text(
        "SELECT f_geometry_column FROM geometry_columns "
        "WHERE f_table_schema = :schema AND f_table_name = :table"
    ), {"schema": schema, "table": table})
    geom_cols = {row[0] for row in geom_cols_result.fetchall()}

    result = await db.execute(text(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns "
        "WHERE table_schema = :schema AND table_name = :table ORDER BY ordinal_position"
    ), {"schema": schema, "table": table})

    return [
        ResourceField(name=row[0], data_type=row[1], nullable=row[2] == "YES")
        for row in result.fetchall()
        if row[0] not in geom_cols
    ]


# ---------------------------------------------------------------------------
# Atributos via PostGIS (substitui WFS)
# ---------------------------------------------------------------------------

@router.get("/resources/{source_id}/attributes", response_model=ResourceAttributes)
async def get_resource_attributes(
    source_id: str,
    limit: int = 50,
    offset: int = 0,
    filter_column: str | None = None,
    filter_value: str | None = None,
    sort_column: str | None = None,
    sort_direction: str = "asc",
    db: AsyncSession = Depends(get_async_db),
) -> ResourceAttributes:
    """Atributos da tabela PostGIS com paginação e filtro opcional."""
    schema, _, table = source_id.partition(".")
    if not table:
        raise HTTPException(status_code=400, detail="source_id deve ser schema.tabela")

    geom_result = await db.execute(text(
        "SELECT f_geometry_column FROM geometry_columns "
        "WHERE f_table_schema = :schema AND f_table_name = :table LIMIT 1"
    ), {"schema": schema, "table": table})
    geom_row = geom_result.fetchone()
    geom_col = geom_row[0] if geom_row else "geom"

    where_clause = ""
    params: dict[str, Any] = {"limit": max(1, min(limit, 200)), "offset": max(0, offset)}
    if filter_column and filter_value:
        where_clause = f'WHERE CAST("{filter_column}" AS TEXT) ILIKE :filter_val'
        params["filter_val"] = f"%{filter_value}%"

    order_clause = ""
    if sort_column:
        direction = "DESC" if sort_direction.lower() == "desc" else "ASC"
        order_clause = f'ORDER BY "{sort_column}" {direction}'

    count_result = await db.execute(
        text(f'SELECT COUNT(*) FROM "{schema}"."{table}" {where_clause}'),  # noqa: S608
        params,
    )
    total = count_result.scalar() or 0

    # Busca propriedades (sem coluna geom) + bbox calculado a partir da geometria.
    rows_result = await db.execute(text(  # noqa: S608
        f"""
        SELECT row_to_json(t) AS props,
               ARRAY[
                 ST_XMin(ST_Transform("{geom_col}", 4326)),
                 ST_YMin(ST_Transform("{geom_col}", 4326)),
                 ST_XMax(ST_Transform("{geom_col}", 4326)),
                 ST_YMax(ST_Transform("{geom_col}", 4326))
               ] AS bbox
        FROM (
            SELECT * FROM "{schema}"."{table}"
            {where_clause} {order_clause}
            LIMIT :limit OFFSET :offset
        ) t
        """
    ), params)

    rows_raw = rows_result.fetchall()
    if not rows_raw:
        return ResourceAttributes(resourceId=source_id, limit=limit, offset=offset, total=int(total), rows=[], columns=[])

    first_props = dict(rows_raw[0][0])
    first_props.pop(geom_col, None)
    columns = [k for k in first_props if not k.startswith("@")]

    rows = []
    for raw_row in rows_raw:
        props = dict(raw_row[0])
        props.pop(geom_col, None)
        row: dict[str, Any] = {k: props.get(k) for k in columns}
        if raw_row[1] and all(v is not None for v in raw_row[1]):
            row["__bbox"] = list(raw_row[1])
        rows.append(row)

    return ResourceAttributes(resourceId=source_id, limit=limit, offset=offset, total=int(total), rows=rows, columns=columns)
