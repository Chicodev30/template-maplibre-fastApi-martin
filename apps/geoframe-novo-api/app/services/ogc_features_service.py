# Serviço OGC API Features: consulta PostGIS e retorna GeoJSON.
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _parse_resource_id(resource_id: str) -> tuple[str, str]:
    """Extrai (schema, tabela) do resource_id no formato 'schema.tabela'."""
    schema, _, table = resource_id.partition(".")
    if not table:
        raise ValueError(f"resource_id deve estar no formato 'schema.tabela', recebido: '{resource_id}'")
    return schema, table


async def get_features(
    db: AsyncSession,
    resource_id: str,
    limit: int = 1000,
    offset: int = 0,
    bbox: list[float] | None = None,
) -> dict[str, Any]:
    """Retorna FeatureCollection GeoJSON com as features da tabela PostGIS.

    Geometrias são reprojetadas para WGS84 (EPSG:4326) antes de serializar.
    O bbox (se fornecido) deve estar em WGS84 [minLon, minLat, maxLon, maxLat].
    """
    schema, table = _parse_resource_id(resource_id)

    # Detecta a coluna de geometria (primeira com tipo geometry/geography).
    detect_sql = text(
        "SELECT f_geometry_column FROM geometry_columns "
        "WHERE f_table_schema = :schema AND f_table_name = :table "
        "LIMIT 1"
    )
    result = await db.execute(detect_sql, {"schema": schema, "table": table})
    row = result.fetchone()
    geom_col = row[0] if row else "geom"

    bbox_filter = ""
    params: dict[str, Any] = {"schema": schema, "table": table, "limit": limit, "offset": offset}
    if bbox and len(bbox) == 4:
        bbox_filter = (
            f"WHERE ST_Intersects("
            f"  ST_Transform(\"{geom_col}\", 4326),"
            f"  ST_MakeEnvelope(:bbox_minx, :bbox_miny, :bbox_maxx, :bbox_maxy, 4326)"
            f")"
        )
        params.update({"bbox_minx": bbox[0], "bbox_miny": bbox[1], "bbox_maxx": bbox[2], "bbox_maxy": bbox[3]})

    # Conta total sem paginação.
    count_sql = text(
        f'SELECT COUNT(*) FROM "{schema}"."{table}" {bbox_filter}'  # noqa: S608
    )
    count_result = await db.execute(count_sql, params)
    total = count_result.scalar() or 0

    # Busca features como GeoJSON via ST_AsGeoJSON.
    features_sql = text(
        f"""
        SELECT
            ST_AsGeoJSON(ST_Transform("{geom_col}", 4326))::json AS geometry,
            row_to_json(t) AS properties
        FROM (
            SELECT * FROM "{schema}"."{table}" {bbox_filter}
            LIMIT :limit OFFSET :offset
        ) t
        """  # noqa: S608
    )
    feat_result = await db.execute(features_sql, params)
    rows = feat_result.fetchall()

    features = []
    for feat_row in rows:
        geom = feat_row[0]
        props = dict(feat_row[1]) if feat_row[1] else {}
        # Remove a coluna de geometria das properties.
        props.pop(geom_col, None)
        features.append({"type": "Feature", "geometry": geom, "properties": props})

    return {
        "type": "FeatureCollection",
        "numberMatched": int(total),
        "numberReturned": len(features),
        "features": features,
    }


async def get_feature(
    db: AsyncSession,
    resource_id: str,
    feature_id: str | int,
) -> dict[str, Any] | None:
    """Retorna uma feature única pelo id (coluna ogc_fid ou id)."""
    schema, table = _parse_resource_id(resource_id)

    detect_sql = text(
        "SELECT f_geometry_column FROM geometry_columns "
        "WHERE f_table_schema = :schema AND f_table_name = :table "
        "LIMIT 1"
    )
    result = await db.execute(detect_sql, {"schema": schema, "table": table})
    row = result.fetchone()
    geom_col = row[0] if row else "geom"

    # Tenta ogc_fid primeiro, depois id.
    for id_col in ("ogc_fid", "id"):
        sql = text(
            f"""
            SELECT
                ST_AsGeoJSON(ST_Transform("{geom_col}", 4326))::json AS geometry,
                row_to_json(t) AS properties
            FROM (SELECT * FROM "{schema}"."{table}" WHERE "{id_col}" = :fid LIMIT 1) t
            """  # noqa: S608
        )
        try:
            feat_result = await db.execute(sql, {"fid": feature_id})
            feat_row = feat_result.fetchone()
            if feat_row:
                props = dict(feat_row[1]) if feat_row[1] else {}
                props.pop(geom_col, None)
                return {"type": "Feature", "id": feature_id, "geometry": feat_row[0], "properties": props}
        except Exception:  # noqa: BLE001
            continue
    return None
