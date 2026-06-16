# Serviço integração GeoServer GWC/tilejson.
# A API e o unico gateway: o navegador nunca fala direto com o GeoServer.
# Substitui o Martin (teste de performance): mesmo source id "workspace.layer".
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx

from app.config import get_settings

settings = get_settings()


def _auth() -> httpx.BasicAuth:
    return httpx.BasicAuth(settings.geoserver_user, settings.geoserver_password)


def _rest_url(path: str) -> str:
    base = settings.geoserver_base_url.rstrip("/")
    return f"{base}/rest/{path.lstrip('/')}"


def _split_source_id(source_id: str) -> tuple[str, str]:
    workspace, _, layer = source_id.partition(".")
    return workspace, layer


def _rebase_url(url: str) -> str:
    """Reescreve scheme/host de uma URL absoluta do GeoServer para o GEOSERVER_BASE_URL.

    O GeoServer pode devolver hrefs absolutos (ex.: resource.href) baseados no seu proxy
    base URL configurado (ex.: localhost:8083), que nao e alcancavel de dentro do
    container (somente host.docker.internal:8083 e).
    """
    base_parts = urlsplit(settings.geoserver_base_url)
    url_parts = urlsplit(url)
    return urlunsplit((base_parts.scheme, base_parts.netloc, url_parts.path, url_parts.query, url_parts.fragment))


async def get_catalog() -> dict[str, Any]:
    workspace = settings.geoserver_workspace
    async with httpx.AsyncClient(timeout=15.0, auth=_auth()) as client:
        resp = await client.get(_rest_url(f"workspaces/{workspace}/layers.json"))
        resp.raise_for_status()
        data = resp.json()

    layers = data.get("layers") or {}
    layer_entries = layers.get("layer") or []
    if isinstance(layer_entries, dict):
        layer_entries = [layer_entries]

    tiles = {}
    for entry in layer_entries:
        name = entry["name"]
        source_id = f"{workspace}.{name}"
        tiles[source_id] = {
            "content_type": "application/x-protobuf",
            "description": f"{workspace}.{name}",
        }
    return {"tiles": tiles}


async def get_tilejson(source_id: str, public_tile_base: str) -> dict[str, Any]:
    """TileJSON do GeoServer (GWC) com as URLs de tile reescritas para passarem pela API."""
    workspace, layer = _split_source_id(source_id)
    bounds = None
    async with httpx.AsyncClient(timeout=15.0, auth=_auth()) as client:
        resp = await client.get(_rest_url(f"layers/{workspace}:{layer}.json"))
        resp.raise_for_status()
        layer_data = resp.json()

        resource_href = layer_data.get("layer", {}).get("resource", {}).get("href")
        if resource_href:
            try:
                resp = await client.get(_rebase_url(resource_href))
                if resp.is_success:
                    resource = resp.json()
                    feature_type = next(iter(resource.values()))
                    bbox = feature_type.get("latLonBoundingBox")
                    if bbox:
                        bounds = [bbox["minx"], bbox["miny"], bbox["maxx"], bbox["maxy"]]
            except httpx.HTTPError:
                # bounds sao opcionais no tilejson; nao falha a resposta toda por isso.
                pass

    tilejson: dict[str, Any] = {
        "tilejson": "3.0.0",
        "name": source_id,
        "tiles": [f"{public_tile_base}/{source_id}/{{z}}/{{x}}/{{y}}"],
        "minzoom": 0,
        "maxzoom": 22,
    }
    if bounds:
        tilejson["bounds"] = bounds
    return tilejson


import math as _math


def _merc_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """Converte coordenada EPSG:900913 (metros) para WGS84 (lon, lat)."""
    lon = x / 20037508.342789244 * 180.0
    lat = _math.degrees(2.0 * _math.atan(_math.exp(y / 20037508.342789244 * _math.pi)) - _math.pi / 2.0)
    return lon, lat


async def get_attributes(
    source_id: str,
    limit: int = 50,
    offset: int = 0,
    filter_column: str | None = None,
    filter_value: str | None = None,
    sort_column: str | None = None,
    sort_direction: str = "asc",
) -> dict[str, Any]:
    """Atributos via WFS GetFeature (GeoJSON no CRS nativo 900913).

    Solicita no CRS nativo para evitar reprojecao no GeoServer e converte
    o bbox para WGS84 localmente.
    """
    workspace, layer = _split_source_id(source_id)
    base = settings.geoserver_base_url.rstrip("/")
    params: dict[str, str] = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": f"{workspace}:{layer}",
        "outputFormat": "application/json",
        "count": str(limit),
        "startIndex": str(offset),
    }
    if sort_column:
        direction = "D" if sort_direction.lower() == "desc" else "A"
        params["sortBy"] = f"{sort_column} {direction}"
    if filter_column and filter_value:
        params["CQL_FILTER"] = f"{filter_column} ILIKE '%{filter_value}%'"

    async with httpx.AsyncClient(timeout=60.0, auth=_auth()) as client:
        feat_resp = await client.get(f"{base}/ows", params=params)
        feat_resp.raise_for_status()
        feat_data = feat_resp.json()

    total = feat_data.get("numberMatched") or feat_data.get("totalFeatures") or 0
    features = feat_data.get("features") or []
    if not features:
        return {"total": total, "rows": [], "columns": []}

    first_props = features[0].get("properties") or {}
    columns = [k for k in first_props if not k.startswith("@")]

    rows = []
    for feat in features:
        props = feat.get("properties") or {}
        bbox: list[float] | None = None
        geom = feat.get("geometry")
        if geom:
            coords_flat: list[float] = []

            def _collect(c: Any) -> None:
                if isinstance(c[0], (int, float)):
                    coords_flat.extend(c[:2])
                else:
                    for sub in c:
                        _collect(sub)

            _collect(geom.get("coordinates", []))
            if coords_flat:
                xs = coords_flat[0::2]
                ys = coords_flat[1::2]
                min_lon, min_lat = _merc_to_wgs84(min(xs), min(ys))
                max_lon, max_lat = _merc_to_wgs84(max(xs), max(ys))
                bbox = [min_lon, min_lat, max_lon, max_lat]
        row: dict[str, Any] = {k: props.get(k) for k in columns}
        if bbox:
            row["__bbox"] = bbox
        rows.append(row)

    return {"total": int(total), "rows": rows, "columns": columns}


async def get_tile(source_id: str, z: int, x: int, y: int) -> httpx.Response:
    workspace, layer = _split_source_id(source_id)
    # GWC TMS usa origem inferior-esquerda (y invertido em relacao ao XYZ do MapLibre/deck.gl).
    y_tms = (2**z) - 1 - y
    gridset = settings.geoserver_gridset
    base = settings.geoserver_base_url.rstrip("/")
    url = f"{base}/gwc/service/tms/1.0.0/{workspace}:{layer}@{gridset}@pbf/{z}/{x}/{y_tms}.pbf"
    async with httpx.AsyncClient(timeout=30.0, auth=_auth()) as client:
        return await client.get(url)
