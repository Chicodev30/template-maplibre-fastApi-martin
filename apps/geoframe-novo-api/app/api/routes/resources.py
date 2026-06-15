# Rotas de resources.
# Metadados das tabelas espaciais do schema configurado, para casar com o
# catalogo MVT do Martin e montar a galeria de recursos no portal admin.
import json
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_session
from app.dependencies import require_role
from app.models.resource import ResourceConfig
from app.models.role import AppRole
from app.models.user import User
from app.services.vector_upload import ingest_vector_file

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
    total: int
    rows: list[dict[str, Any]]
    columns: list[str]


class KeywordSearchResult(BaseModel):
    resourceId: str
    layerLabel: str
    row: dict[str, Any]
    matches: dict[str, Any]
    bbox: list[float] | None = None


class KeywordSearchResponse(BaseModel):
    q: str
    limit: int
    offset: int
    total: int
    results: list[KeywordSearchResult]


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

_RESOURCE_METADATA_SQL = text(
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
    WHERE gc.f_table_schema = :schema AND gc.f_table_name = :table
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


@router.post("/upload", response_model=ResourceMetadata)
async def upload_resource(
    file: UploadFile = File(...),
    table_name: str | None = Form(None),
    source_srid: int | None = Form(None),
    csv_wkt_column: str | None = Form(None),
    csv_x_column: str | None = Form(None),
    csv_y_column: str | None = Form(None),
    csv_srid: int | None = Form(None),
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> ResourceMetadata:
    resource_id = await ingest_vector_file(
        db,
        file,
        table_name,
        source_srid,
        csv_wkt_column,
        csv_x_column,
        csv_y_column,
        csv_srid,
    )
    schema_name, table_name_final = resource_id.split(".", 1)
    row = db.execute(
        _RESOURCE_METADATA_SQL,
        {"schema": schema_name, "table": table_name_final},
    ).mappings().first()
    if row is None:
        raise HTTPException(
            status_code=500,
            detail="Tabela criada, mas metadados nao puderam ser lidos.",
        )
    return ResourceMetadata(
        id=resource_id,
        schema_name=row["schema_name"],
        table_name=row["table_name"],
        geometry_column=row["geometry_column"],
        geometry_type=row["geometry_type"],
        srid=row["srid"],
        feature_count=row["feature_count"],
    )


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


@router.get("/{source_id}/values")
def list_resource_field_values(
    source_id: str,
    column: str,
    q: str | None = None,
    limit: int = 20,
    db: Session = Depends(get_session),
) -> list[str]:
    # Valores distintos de uma coluna, para autocomplete no painel "Buscar".
    schema_name, table_name = _ensure_resource_exists(source_id, db)
    column_rows = (
        db.execute(_COLUMNS_SQL, {"schema": schema_name, "table": table_name}).mappings().all()
    )
    column_names = {r["column_name"] for r in column_rows}
    if column not in column_names:
        raise HTTPException(status_code=404, detail="Campo nao encontrado")

    limit = max(1, min(limit, 50))
    quoted_column = f'"{column}"'
    text_column = f"CAST({quoted_column} AS TEXT)"
    params: dict[str, Any] = {"limit": limit}
    where_clause = f"WHERE {quoted_column} IS NOT NULL "
    if q:
        where_clause += f"AND {text_column} ILIKE :q "
        params["q"] = f"%{q}%"
    sql = text(
        f"SELECT DISTINCT {text_column} AS value FROM \"{schema_name}\".\"{table_name}\" "
        f"{where_clause}ORDER BY value LIMIT :limit"
    )
    return [r for r in db.execute(sql, params).scalars().all() if r is not None]


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


def _build_filter_condition(
    column_types: dict[str, str],
    column: str | None,
    operator: str,
    value: str | None,
    value2: str | None,
    values: list[str] | None,
    params: dict[str, Any],
    param_prefix: str,
) -> str | None:
    # Monta uma condicao SQL (sem WHERE) para um campo/operador/valor, usada
    # tanto pelo filtro simples da tabela de atributos quanto pelo painel de
    # busca avancada (varios filtros combinados com AND).
    if not column or column not in column_types:
        return None

    operator = operator.lower()
    data_type = column_types[column]
    quoted_column = f'"{column}"'
    text_column = f"CAST({quoted_column} AS TEXT)"

    if operator == "is_null":
        return f"{quoted_column} IS NULL"
    if operator == "is_not_null":
        return f"{quoted_column} IS NOT NULL"
    if operator == "contains":
        if not value:
            return None
        params[param_prefix] = f"%{value}%"
        return f"{text_column} ILIKE :{param_prefix}"
    if operator == "starts_with":
        if not value:
            return None
        params[param_prefix] = f"{value}%"
        return f"{text_column} ILIKE :{param_prefix}"
    if operator == "ends_with":
        if not value:
            return None
        params[param_prefix] = f"%{value}"
        return f"{text_column} ILIKE :{param_prefix}"
    if operator == "equals":
        if not value:
            return None
        params[param_prefix] = value
        return f"{quoted_column} = CAST(:{param_prefix} AS {data_type})"
    if operator == "not_equals":
        if not value:
            return None
        params[param_prefix] = value
        return f"{quoted_column} IS DISTINCT FROM CAST(:{param_prefix} AS {data_type})"
    if operator in {"gt", "gte", "lt", "lte"}:
        if not value:
            return None
        sql_operator = {"gt": ">", "gte": ">=", "lt": "<", "lte": "<="}[operator]
        params[param_prefix] = value
        return f"{quoted_column} {sql_operator} CAST(:{param_prefix} AS {data_type})"
    if operator == "between":
        if not value or not value2:
            return None
        params[f"{param_prefix}_a"] = value
        params[f"{param_prefix}_b"] = value2
        return (
            f"{quoted_column} BETWEEN CAST(:{param_prefix}_a AS {data_type}) "
            f"AND CAST(:{param_prefix}_b AS {data_type})"
        )
    if operator == "in_list":
        items = [v for v in (values or []) if v]
        if not items:
            return None
        placeholders = []
        for i, item in enumerate(items):
            key = f"{param_prefix}_{i}"
            params[key] = item
            placeholders.append(f"CAST(:{key} AS {data_type})")
        return f"{quoted_column} IN ({', '.join(placeholders)})"

    if not value:
        return None
    params[param_prefix] = f"%{value}%"
    return f"{text_column} ILIKE :{param_prefix}"


def _build_attribute_filter(
    column_types: dict[str, str],
    filter_column: str | None,
    filter_operator: str,
    filter_value: str | None,
    params: dict[str, Any],
) -> str:
    condition = _build_filter_condition(
        column_types, filter_column, filter_operator, filter_value, None, None, params, "filter_value"
    )
    return f"WHERE {condition} " if condition else ""


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


@router.get("/keyword-search", response_model=KeywordSearchResponse)
def keyword_search(
    q: str,
    resource_ids: str | None = None,
    limit: int = 25,
    offset: int = 0,
    db: Session = Depends(get_session),
) -> KeywordSearchResponse:
    # Busca por palavra-chave: procura o termo (ILIKE) em todas as colunas de
    # texto de cada tabela, independente de campos marcados como "Pesq.".
    # resource_ids (opcional, "schema.table,schema.table2") restringe a busca
    # a essas camadas (toggle "Somente camadas ativas"); sem isso, busca em
    # todas as tabelas do schema configurado.
    term = q.strip()
    if len(term) < 3:
        raise HTTPException(status_code=400, detail="Informe pelo menos 3 caracteres")

    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    if resource_ids:
        table_names = []
        for rid in resource_ids.split(","):
            rid = rid.strip()
            if not rid or "." not in rid:
                continue
            schema_name, table_name = rid.split(".", 1)
            if schema_name == settings.db_schema_resources:
                table_names.append(table_name)
        tables = [(settings.db_schema_resources, t) for t in dict.fromkeys(table_names)]
    else:
        rows = db.execute(_LIST_SQL, {"schema": settings.db_schema_resources}).mappings().all()
        tables = [(r["schema_name"], r["table_name"]) for r in rows]

    layer_labels = {
        config.resource_id: config.layer_label
        for config in db.execute(select(ResourceConfig)).scalars().all()
    }

    total = 0
    results: list[KeywordSearchResult] = []
    remaining_offset = offset

    for schema_name, table_name in tables:
        column_rows = (
            db.execute(_COLUMNS_SQL, {"schema": schema_name, "table": table_name}).mappings().all()
        )
        geom_column = db.execute(
            _GEOM_COLUMN_SQL,
            {"schema": schema_name, "table": table_name},
        ).scalar_one_or_none()
        # Tipos de ponto flutuante (double precision/real) sao excluidos: o
        # CAST AS TEXT pode incluir ruido de precisao (ex.: "667.9199003"
        # -> "...300001"), gerando falsos positivos para buscas numericas
        # como "0001". Inteiros e texto/numeric tem representacao exata.
        text_columns = [
            r["column_name"]
            for r in column_rows
            if r["column_name"] != geom_column and r["data_type"] not in ("double precision", "real")
        ]
        if not text_columns:
            continue

        params: dict[str, Any] = {"q": f"%{term}%"}
        or_clause = " OR ".join(f'CAST("{c}" AS TEXT) ILIKE :q' for c in text_columns)

        table_total = db.execute(
            text(f'SELECT count(*) FROM "{schema_name}"."{table_name}" WHERE {or_clause}'),
            params,
        ).scalar_one()
        if not table_total:
            continue
        total += table_total

        if len(results) >= limit:
            continue
        if remaining_offset >= table_total:
            remaining_offset -= table_total
            continue

        quoted_columns = ", ".join(f'"{c}"' for c in text_columns)
        bbox_expr = ""
        if geom_column:
            bbox_expr = (
                f', CASE WHEN "{geom_column}" IS NULL THEN NULL ELSE ARRAY['
                f'ST_XMin(Box2D(ST_Transform("{geom_column}", 4326))), '
                f'ST_YMin(Box2D(ST_Transform("{geom_column}", 4326))), '
                f'ST_XMax(Box2D(ST_Transform("{geom_column}", 4326))), '
                f'ST_YMax(Box2D(ST_Transform("{geom_column}", 4326)))'
                f'] END AS "__bbox"'
            )

        sql = text(
            f'SELECT {quoted_columns}{bbox_expr} FROM "{schema_name}"."{table_name}" '
            f"WHERE {or_clause} LIMIT :limit OFFSET :offset"
        )
        rows = db.execute(
            sql, {**params, "limit": limit - len(results), "offset": remaining_offset}
        ).mappings().all()
        remaining_offset = 0

        resource_id = f"{schema_name}.{table_name}"
        for row in rows:
            bbox = row.get("__bbox")
            row_data = {
                key: _serialize_value(value) for key, value in row.items() if key != "__bbox"
            }
            matches = {
                key: value
                for key, value in row_data.items()
                if value is not None and term.lower() in str(value).lower()
            }
            results.append(
                KeywordSearchResult(
                    resourceId=resource_id,
                    layerLabel=layer_labels.get(resource_id, table_name),
                    row=row_data,
                    matches=matches,
                    bbox=list(bbox) if bbox is not None else None,
                )
            )

    return KeywordSearchResponse(q=term, limit=limit, offset=offset, total=total, results=results)


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
    filters: str | None = None,
    bbox: str | None = None,
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
            total=0,
            rows=[],
            columns=[],
        )

    params: dict[str, Any] = {"limit": limit, "offset": offset}
    conditions: list[str] = []

    main_condition = _build_filter_condition(
        column_types, filter_column, filter_operator, filter_value, None, None, params, "filter_value"
    )
    if main_condition:
        conditions.append(main_condition)

    if filters:
        try:
            extra_filters = json.loads(filters)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Parametro 'filters' invalido")
        if not isinstance(extra_filters, list):
            raise HTTPException(status_code=400, detail="Parametro 'filters' invalido")
        for i, rule in enumerate(extra_filters):
            if not isinstance(rule, dict):
                continue
            condition = _build_filter_condition(
                column_types,
                rule.get("column"),
                rule.get("operator", ""),
                rule.get("value"),
                rule.get("value2"),
                rule.get("values"),
                params,
                f"extra_{i}",
            )
            if condition:
                conditions.append(condition)

    if bbox and geom_column:
        try:
            min_x, min_y, max_x, max_y = (float(v) for v in bbox.split(","))
        except ValueError:
            raise HTTPException(status_code=400, detail="Parametro 'bbox' invalido")
        params.update({"bbox_minx": min_x, "bbox_miny": min_y, "bbox_maxx": max_x, "bbox_maxy": max_y})
        conditions.append(
            f'ST_Intersects(ST_Transform("{geom_column}", 4326), '
            "ST_MakeEnvelope(:bbox_minx, :bbox_miny, :bbox_maxx, :bbox_maxy, 4326))"
        )

    config = db.execute(
        select(ResourceConfig).where(ResourceConfig.resource_id == source_id)
    ).scalar_one_or_none()
    conditions.extend(
        _build_exclusion_conditions(column_types, config.excluded_features if config else [], params)
    )

    where_clause = f"WHERE {' AND '.join(conditions)} " if conditions else ""

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
    total = db.execute(
        text(f'SELECT count(*) FROM "{schema_name}"."{table_name}" {where_clause}'),
        params,
    ).scalar_one()

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
        total=int(total),
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
