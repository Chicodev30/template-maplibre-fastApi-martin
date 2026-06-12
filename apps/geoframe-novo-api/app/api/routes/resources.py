# Rotas de resources.
# Metadados das tabelas espaciais do schema configurado, para casar com o
# catalogo MVT do Martin e montar a galeria de recursos no portal admin.
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_session

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


@router.get("", response_model=list[ResourceMetadata])
def list_resources(db: Session = Depends(get_session)) -> list[ResourceMetadata]:
    rows = db.execute(_LIST_SQL, {"schema": settings.db_schema}).mappings().all()
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


@router.get("/{table_name}/columns", response_model=list[ResourceColumn])
def list_resource_columns(
    table_name: str, db: Session = Depends(get_session)
) -> list[ResourceColumn]:
    rows = (
        db.execute(_COLUMNS_SQL, {"schema": settings.db_schema, "table": table_name})
        .mappings()
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Tabela nao encontrada no schema configurado")
    return [
        ResourceColumn(name=r["column_name"], data_type=r["data_type"], nullable=r["nullable"])
        for r in rows
    ]


@router.get("/{table_name}/count")
def exact_count(table_name: str, db: Session = Depends(get_session)) -> dict[str, Any]:
    # Contagem exata sob demanda (pode ser lenta em tabelas grandes).
    # Identificadores sao validados contra geometry_columns para evitar injection.
    valid = db.execute(
        text(
            "SELECT 1 FROM geometry_columns "
            "WHERE f_table_schema = :schema AND f_table_name = :table"
        ),
        {"schema": settings.db_schema, "table": table_name},
    ).first()
    if not valid:
        raise HTTPException(status_code=404, detail="Tabela nao encontrada no schema configurado")
    sql = f'SELECT count(*) AS n FROM "{settings.db_schema}"."{table_name}"'
    n = db.execute(text(sql)).scalar_one()
    return {"id": f"{settings.db_schema}.{table_name}", "feature_count": int(n)}
