# Rotas de resources.
# Metadados das tabelas espaciais do schema configurado, para casar com o
# catalogo MVT do Martin e montar a galeria de recursos no portal admin.
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_session
from app.dependencies import require_role
from app.models.resource import ResourceConfig
from app.models.role import AppRole
from app.models.user import User

router = APIRouter(prefix="/catalog/resources", tags=["resources"])

settings = get_settings()


class ResourceColumn(BaseModel):
    name: str
    data_type: str
    nullable: bool


class ResourceMetadata(BaseModel):
    id: str  # schema.table (mesmo source id do Martin)
    schema_name: str
    table_name: str
    geometry_column: str | None = None
    geometry_type: str | None = None
    srid: int | None = None
    # reltuples e uma estimativa do planner; -1 vira None (tabela nunca analisada).
    feature_count: int | None = None


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
    rows: list[dict[str, Any]]
    columns: list[str]


# Estimativa instantanea de contagem + tipo/SRID da geometria, em uma query.
_LIST_SQL = text(
    """
    SELECT
        gc.f_table_schema   AS schema_name,
        gc.f_table_name     AS table_name,
        gc.f_geometry_column AS geometry_column,
        gc.type             AS geometry_type,
        gc.srid             AS srid,
        NULLIF(c.reltuples, -1)::bigint AS feature_count
    FROM geometry_columns gc
    JOIN pg_namespace n ON n.nspname = gc.f_table_schema
    JOIN pg_class c ON c.relname = gc.f_table_name AND c.relnamespace = n.oid
    WHERE gc.f_table_schema = :schema
    ORDER BY gc.f_table_name
    """
)

_COLUMNS_SQL = text(
    """
    SELECT column_name, data_type, (is_nullable = 'YES') AS nullable
    FROM information_schema.columns
    WHERE table_schema = :schema AND table_name = :table
    ORDER BY ordinal_position
    """
)

_GEOM_COLUMN_SQL = text(
    """
    SELECT f_geometry_column
    FROM geometry_columns
    WHERE f_table_schema = :schema AND f_table_name = :table
    """
)


@router.get("", response_model=list[ResourceMetadata])
def list_resources(db: Session = Depends(get_session)) -> list[ResourceMetadata]:
    rows = db.execute(_LIST_SQL, {"schema": settings.db_schema_resources}).mappings().all()
    return [
        ResourceMetadata(
            id=f"{r['schema_name']}.{r['table_name']}",
            schema_name=r["schema_name"],
            table_name=r["table_name"],
            geometry_column=r["geometry_column"],
            geometry_type=r["geometry_type"],
            srid=r["srid"],
            feature_count=r["feature_count"],
        )
        for r in rows
    ]


@router.get("/overrides", response_model=dict[str, ResourceOverrides])
def list_resource_overrides(db: Session = Depends(get_session)) -> dict[str, ResourceOverrides]:
    # So traz recursos com override de bbox e/ou feicoes excluidas configurados,
    # para a galeria/miniaturas e o mapa aplicarem sem 1 request por recurso.
    rows = db.execute(
        select(ResourceConfig).where(
            or_(
                ResourceConfig.bbox_override.is_not(None),
                func.json_array_length(ResourceConfig.excluded_features) > 0,
            )
        )
    ).scalars().all()
    return {
        config.resource_id: ResourceOverrides(
            bboxOverride=config.bbox_override,
            excludedFeatures=config.excluded_features,
        )
        for config in rows
    }


@router.get("/{table_name}/columns", response_model=list[ResourceColumn])
def list_resource_columns(
    table_name: str, db: Session = Depends(get_session)
) -> list[ResourceColumn]:
    rows = (
        db.execute(_COLUMNS_SQL, {"schema": settings.db_schema_resources, "table": table_name})
        .mappings()
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Tabela nao encontrada no schema configurado")
    return [
        ResourceColumn(name=r["column_name"], data_type=r["data_type"], nullable=r["nullable"])
        for r in rows
    ]


def _ensure_resource_exists(source_id: str, db: Session) -> tuple[str, str]:
    if "." not in source_id:
        raise HTTPException(status_code=404, detail="Recurso nao encontrado")
    schema_name, table_name = source_id.split(".", 1)
    if schema_name != settings.db_schema_resources:
        raise HTTPException(status_code=404, detail="Recurso nao encontrado")
    valid = db.execute(
        text(
            "SELECT 1 FROM geometry_columns "
            "WHERE f_table_schema = :schema AND f_table_name = :table"
        ),
        {"schema": schema_name, "table": table_name},
    ).first()
    if not valid:
        raise HTTPException(status_code=404, detail="Recurso nao encontrado")
    return schema_name, table_name


def _serialize_value(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _build_attribute_filter(
    column_types: dict[str, str],
    filter_column: str | None,
    filter_operator: str,
    filter_value: str | None,
    params: dict[str, Any],
) -> str:
    if not filter_column or filter_column not in column_types:
        return ""

    operator = filter_operator.lower()
    data_type = column_types[filter_column]
    quoted_column = f'"{filter_column}"'

    if operator == "is_null":
        return f"WHERE {quoted_column} IS NULL "
    if operator == "is_not_null":
        return f"WHERE {quoted_column} IS NOT NULL "
    if not filter_value:
        return ""

    text_column = f"CAST({quoted_column} AS TEXT)"
    if operator == "contains":
        params["filter_value"] = f"%{filter_value}%"
        return f"WHERE {text_column} ILIKE :filter_value "
    if operator == "starts_with":
        params["filter_value"] = f"{filter_value}%"
        return f"WHERE {text_column} ILIKE :filter_value "
    if operator == "ends_with":
        params["filter_value"] = f"%{filter_value}"
        return f"WHERE {text_column} ILIKE :filter_value "
    if operator == "equals":
        params["filter_value"] = filter_value
        return f"WHERE {quoted_column} = CAST(:filter_value AS {data_type}) "
    if operator in {"gt", "gte", "lt", "lte"}:
        sql_operator = {"gt": ">", "gte": ">=", "lt": "<", "lte": "<="}[operator]
        params["filter_value"] = filter_value
        return f"WHERE {quoted_column} {sql_operator} CAST(:filter_value AS {data_type}) "

    params["filter_value"] = f"%{filter_value}%"
    return f"WHERE {text_column} ILIKE :filter_value "


def _build_exclusion_conditions(
    column_types: dict[str, str],
    excluded_features: list[dict[str, Any]],
    params: dict[str, Any],
) -> list[str]:
    # Feicoes desconsideradas no catalogo (georreferenciamento errado etc.) -
    # nao alteram a tabela original, so somem das consultas desta API.
    conditions: list[str] = []
    for i, feature in enumerate(excluded_features):
        prop = feature.get("property")
        if prop not in column_types:
            continue
        param_name = f"excl_{i}"
        conditions.append(f'"{prop}" IS DISTINCT FROM CAST(:{param_name} AS {column_types[prop]})')
        params[param_name] = feature.get("value")
    return conditions


@router.get("/{source_id}/config", response_model=ResourceConfigOut)
def get_resource_config(
    source_id: str,
    db: Session = Depends(get_session),
) -> ResourceConfigOut:
    schema_name, table_name = _ensure_resource_exists(source_id, db)
    config = db.execute(
        select(ResourceConfig).where(ResourceConfig.resource_id == source_id)
    ).scalar_one_or_none()
    if config is None:
        geom_column = db.execute(
            _GEOM_COLUMN_SQL,
            {"schema": schema_name, "table": table_name},
        ).scalar_one_or_none()
        return ResourceConfigOut(
            resourceId=source_id,
            layerLabel=f"{table_name}.{geom_column or 'geom'}",
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


@router.put("/{source_id}/config", response_model=ResourceConfigOut)
def save_resource_config(
    source_id: str,
    payload: ResourceConfigIn,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> ResourceConfigOut:
    _ensure_resource_exists(source_id, db)
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


@router.get("/{source_id}/attributes", response_model=ResourceAttributes)
def get_resource_attributes(
    source_id: str,
    limit: int = 50,
    offset: int = 0,
    filter_column: str | None = None,
    filter_operator: str = "contains",
    filter_value: str | None = None,
    sort_column: str | None = None,
    sort_direction: str = "asc",
    db: Session = Depends(get_session),
) -> ResourceAttributes:
    schema_name, table_name = _ensure_resource_exists(source_id, db)
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    geom_column = db.execute(
        _GEOM_COLUMN_SQL,
        {"schema": schema_name, "table": table_name},
    ).scalar_one_or_none()
    column_rows = (
        db.execute(_COLUMNS_SQL, {"schema": schema_name, "table": table_name})
        .mappings()
        .all()
    )
    columns = [r["column_name"] for r in column_rows if r["column_name"] != geom_column]
    column_types = {
        r["column_name"]: r["data_type"]
        for r in column_rows
        if r["column_name"] != geom_column
    }
    if not columns:
        return ResourceAttributes(
            resourceId=source_id,
            limit=limit,
            offset=offset,
            rows=[],
            columns=[],
        )

    params: dict[str, Any] = {"limit": limit, "offset": offset}
    where_clause = _build_attribute_filter(
        column_types,
        filter_column,
        filter_operator,
        filter_value,
        params,
    )

    config = db.execute(
        select(ResourceConfig).where(ResourceConfig.resource_id == source_id)
    ).scalar_one_or_none()
    exclusion_conditions = _build_exclusion_conditions(
        column_types, config.excluded_features if config else [], params
    )
    if exclusion_conditions:
        joined = " AND ".join(exclusion_conditions)
        where_clause = f"{where_clause}AND {joined} " if where_clause else f"WHERE {joined} "

    order_clause = ""
    if sort_column and sort_column in columns:
        direction = "DESC" if sort_direction.lower() == "desc" else "ASC"
        order_clause = f'ORDER BY "{sort_column}" {direction} '

    quoted_columns = ", ".join(f'"{c}"' for c in columns)
    bbox_column = ""
    if geom_column:
        bbox_column = (
            f', CASE WHEN "{geom_column}" IS NULL THEN NULL ELSE ARRAY['
            f'ST_XMin(Box2D(ST_Transform("{geom_column}", 4326))), '
            f'ST_YMin(Box2D(ST_Transform("{geom_column}", 4326))), '
            f'ST_XMax(Box2D(ST_Transform("{geom_column}", 4326))), '
            f'ST_YMax(Box2D(ST_Transform("{geom_column}", 4326)))'
            f'] END AS "__bbox"'
        )
    sql = text(
        f'SELECT {quoted_columns}{bbox_column} FROM "{schema_name}"."{table_name}" '
        f"{where_clause}{order_clause}"
        "LIMIT :limit OFFSET :offset"
    )
    rows = db.execute(sql, params).mappings().all()
    return ResourceAttributes(
        resourceId=source_id,
        limit=limit,
        offset=offset,
        rows=[
            {key: _serialize_value(value) for key, value in row.items()}
            for row in rows
        ],
        columns=columns,
    )


@router.get("/{table_name}/count")
def exact_count(table_name: str, db: Session = Depends(get_session)) -> dict[str, Any]:
    # Contagem exata sob demanda (pode ser lenta em tabelas grandes).
    # Identificadores sao validados contra geometry_columns para evitar injection.
    valid = db.execute(
        text(
            "SELECT 1 FROM geometry_columns "
            "WHERE f_table_schema = :schema AND f_table_name = :table"
        ),
        {"schema": settings.db_schema_resources, "table": table_name},
    ).first()
    if not valid:
        raise HTTPException(status_code=404, detail="Tabela nao encontrada no schema configurado")
    sql = f'SELECT count(*) AS n FROM "{settings.db_schema_resources}"."{table_name}"'
    n = db.execute(text(sql)).scalar_one()
    return {"id": f"{settings.db_schema_resources}.{table_name}", "feature_count": int(n)}
