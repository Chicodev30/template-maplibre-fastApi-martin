# Importacao de arquivos vetoriais (GeoJSON, Shapefile zip, GeoPackage, CSV,
# KML, DXF) como nova tabela PostGIS no schema de recursos, via ogr2ogr.
# O Martin (auto_publish) descobre a tabela nova automaticamente.
import csv
import os
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings

settings = get_settings()

_TABLE_NAME_RE = re.compile(r"[^a-z0-9_]+")

_FORMAT_BY_EXT = {
    ".geojson": "geojson",
    ".json": "geojson",
    ".zip": "shapefile",
    ".gpkg": "gpkg",
    ".csv": "csv",
    ".kml": "kml",
    ".dxf": "dxf",
}

_LAT_NAMES = {"lat", "latitude", "y"}
_LON_NAMES = {"lon", "lng", "longitude", "x"}
_WKT_NAMES = {"wkt", "geom", "geometry", "the_geom"}

_MAX_STDERR = 4000


def sanitize_table_name(name: str) -> str:
    base = Path(name).stem.lower()
    base = _TABLE_NAME_RE.sub("_", base).strip("_")
    if not base or not base[0].isalpha():
        base = f"t_{base}" if base else "camada"
    return base[:58]


def table_exists(db: Session, schema: str, table: str) -> bool:
    return (
        db.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = :schema AND table_name = :table"
            ),
            {"schema": schema, "table": table},
        ).first()
        is not None
    )


def detect_format(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    fmt = _FORMAT_BY_EXT.get(ext)
    if fmt is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Extensao '{ext}' nao suportada. Use GeoJSON, Shapefile (.zip), "
                "GeoPackage, CSV, KML ou DXF."
            ),
        )
    return fmt


def _validate_shapefile_zip(path: Path) -> None:
    with zipfile.ZipFile(path) as zf:
        names = {Path(n).suffix.lower() for n in zf.namelist()}
    missing = {".shp", ".shx", ".dbf"} - names
    if missing:
        raise HTTPException(
            status_code=400,
            detail=(
                "Zip incompleto: faltam os arquivos "
                f"{', '.join(sorted(missing))} do shapefile (.shp/.shx/.dbf)."
            ),
        )


def _detect_csv_geometry_columns(
    path: Path,
    wkt_column: str | None,
    x_column: str | None,
    y_column: str | None,
) -> tuple[str | None, str | None, str | None]:
    if wkt_column or (x_column and y_column):
        return wkt_column, x_column, y_column

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        try:
            header = next(csv.reader(f))
        except StopIteration as exc:
            raise HTTPException(status_code=400, detail="CSV vazio.") from exc

    lower = {h.strip().lower(): h for h in header}
    for name in _WKT_NAMES:
        if name in lower:
            return lower[name], None, None

    lon = next((lower[n] for n in _LON_NAMES if n in lower), None)
    lat = next((lower[n] for n in _LAT_NAMES if n in lower), None)
    if lon and lat:
        return None, lon, lat

    raise HTTPException(
        status_code=400,
        detail=(
            "Nao foi possivel identificar colunas de geometria no CSV. "
            "Informe a coluna WKT ou as colunas de latitude/longitude."
        ),
    )


def _connection_args(schema: str) -> tuple[str, dict[str, str]]:
    conn = (
        f"PG:host={settings.db_host} port={settings.db_port} "
        f"dbname={settings.db_name} user={settings.db_user} "
        f"active_schema={schema}"
    )
    env = {**os.environ, "PGPASSWORD": settings.db_password}
    return conn, env


def _run_ogr2ogr(args: list[str], env: dict[str, str]) -> None:
    result = subprocess.run(
        args,
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
    )
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()[-_MAX_STDERR:]
        raise HTTPException(
            status_code=400,
            detail=f"Falha ao importar arquivo (ogr2ogr): {stderr or 'erro desconhecido'}",
        )


async def ingest_vector_file(
    db: Session,
    file: UploadFile,
    table_name: str | None,
    source_srid: int | None,
    csv_wkt_column: str | None,
    csv_x_column: str | None,
    csv_y_column: str | None,
    csv_srid: int | None,
) -> str:
    schema = settings.db_schema
    fmt = detect_format(file.filename or "")

    final_table = sanitize_table_name(table_name or file.filename or "camada")
    if table_exists(db, schema, final_table):
        raise HTTPException(
            status_code=409,
            detail=f"Ja existe uma tabela '{final_table}' no schema '{schema}'.",
        )

    max_bytes = settings.upload_max_size_mb * 1024 * 1024

    with tempfile.TemporaryDirectory(prefix="geoframe-upload-") as tmpdir:
        suffix = Path(file.filename or "").suffix
        upload_path = Path(tmpdir) / f"upload{suffix}"
        size = 0
        with upload_path.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Arquivo excede o limite de {settings.upload_max_size_mb} MB.",
                    )
                out.write(chunk)

        if fmt == "shapefile":
            _validate_shapefile_zip(upload_path)
            input_path = f"/vsizip/{upload_path}"
        else:
            input_path = str(upload_path)

        extra_oo: list[str] = []
        if fmt == "csv":
            wkt_col, x_col, y_col = _detect_csv_geometry_columns(
                upload_path, csv_wkt_column, csv_x_column, csv_y_column
            )
            if wkt_col:
                extra_oo += ["-oo", f"GEOM_POSSIBLE_NAMES={wkt_col}"]
            else:
                extra_oo += [
                    "-oo", f"X_POSSIBLE_NAMES={x_col}",
                    "-oo", f"Y_POSSIBLE_NAMES={y_col}",
                ]
            extra_oo += ["-oo", "KEEP_GEOM_COLUMNS=NO"]
            srs_args = ["-s_srs", f"EPSG:{csv_srid or 4326}", "-t_srs", "EPSG:4326"]
        elif source_srid:
            srs_args = ["-s_srs", f"EPSG:{source_srid}", "-t_srs", "EPSG:4326"]
        else:
            srs_args = ["-t_srs", "EPSG:4326"]

        conn, env = _connection_args(schema)
        args = [
            "ogr2ogr",
            "-f", "PostgreSQL", conn,
            input_path,
            *extra_oo,
            "-nln", final_table,
            "-lco", "GEOMETRY_NAME=geom",
            "-lco", "FID=id",
            "-lco", f"SCHEMA={schema}",
            "-nlt", "PROMOTE_TO_MULTI",
            *srs_args,
        ]
        _run_ogr2ogr(args, env)

    if not table_exists(db, schema, final_table):
        raise HTTPException(
            status_code=400,
            detail="Importacao concluida, mas a tabela nao foi criada (arquivo sem geometria?).",
        )

    return f"{schema}.{final_table}"
