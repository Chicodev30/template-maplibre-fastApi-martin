# Middleware de busca de enderecos. O front consulta apenas a API, e a API conversa com
# ArcGIS Procempa, CDL REST e Nominatim.
import math
import re
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(prefix="/geocoding", tags=["geocoding"])

settings = get_settings()

GeocodingProvider = Literal["arcgis-procempa", "cdl-rest", "nominatim"]
ReverseGeocodingProvider = Literal["arcgis-procempa", "nominatim"]


class GeocodingResult(BaseModel):
    provider: GeocodingProvider
    label: str
    longitude: float
    latitude: float
    score: float | None = None
    bbox: list[float] | None = None
    raw: dict[str, Any] | None = None


class ReverseGeocodingResult(BaseModel):
    provider: ReverseGeocodingProvider
    label: str
    address: str | None = None
    neighborhood: str | None = None
    postal_code: str | None = None
    longitude: float
    latitude: float
    raw: dict[str, Any] | None = None


class CdlSuggestion(BaseModel):
    label: str
    value: str
    codigoLogradouro: int | None = None
    raw: dict[str, Any] | None = None


def _parse_float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed


def _cdl_items(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, dict):
        value = data.get("value", [])
    else:
        value = data
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _arcgis_result(candidate: dict[str, Any], provider: GeocodingProvider) -> GeocodingResult | None:
    location = candidate.get("location") or {}
    longitude = _parse_float(location.get("x"))
    latitude = _parse_float(location.get("y"))
    if longitude is None or latitude is None:
        return None

    extent = candidate.get("extent") or {}
    bbox_values = [
        _parse_float(extent.get("xmin")),
        _parse_float(extent.get("ymin")),
        _parse_float(extent.get("xmax")),
        _parse_float(extent.get("ymax")),
    ]
    bbox = [v for v in bbox_values if v is not None] if all(v is not None for v in bbox_values) else None
    attributes = candidate.get("attributes") or {}
    label = (
        attributes.get("LongLabel")
        or attributes.get("Match_addr")
        or candidate.get("address")
        or "Endereco encontrado"
    )

    return GeocodingResult(
        provider=provider,
        label=str(label),
        longitude=longitude,
        latitude=latitude,
        score=_parse_float(candidate.get("score")),
        bbox=bbox,
        raw=candidate,
    )


async def _search_arcgis(query: str, limit: int, provider: GeocodingProvider = "arcgis-procempa") -> list[GeocodingResult]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            settings.arcgis_find_address_base_url,
            params={
                "f": "json",
                "SingleLine": query,
                "outFields": "*",
                "maxLocations": limit,
                "outSR": 4326,
            },
        )
    response.raise_for_status()
    data = response.json()
    results: list[GeocodingResult] = []
    for candidate in data.get("candidates", []):
        result = _arcgis_result(candidate, provider)
        if result:
            results.append(result)
    return results


async def _search_cdl(query: str, number: str, limit: int) -> list[GeocodingResult]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            settings.cdlrest_search_base_url,
            params={"q": query, "numero": number},
        )
    response.raise_for_status()
    data = response.json()

    results: list[GeocodingResult] = []
    for item in _cdl_items(data)[:limit]:
        label = str(item.get("enderecoFormatado") or item.get("enderecoFormatadoCurto") or query)
        coordinate_query = str(item.get("enderecoFormatadoCurto") or label)
        arcgis_matches = await _search_arcgis(coordinate_query, 1, provider="cdl-rest")
        if arcgis_matches:
            match = arcgis_matches[0]
            match.label = label
            match.raw = {"cdl": item, "arcgis": match.raw}
            results.append(match)
    return results


async def _search_nominatim(query: str, limit: int) -> list[GeocodingResult]:
    async with httpx.AsyncClient(
        timeout=15.0,
        headers={"User-Agent": "GeoframeNovo/1.0 (geocoding middleware)"},
    ) as client:
        response = await client.get(
            settings.nominatim_search_base_url,
            params={
                "q": query,
                "format": "json",
                "limit": limit,
                "addressdetails": 1,
                "viewbox": settings.porto_alegre_viewbox,
                # viewbox ranqueia Porto Alegre, mas nao descarta resultado fora dela.
                "bounded": 0,
            },
        )
    response.raise_for_status()
    data = response.json()

    results: list[GeocodingResult] = []
    for item in data:
        longitude = _parse_float(item.get("lon"))
        latitude = _parse_float(item.get("lat"))
        if longitude is None or latitude is None:
            continue
        bbox_raw = item.get("boundingbox") or []
        bbox = None
        if len(bbox_raw) == 4:
            south, north, west, east = (_parse_float(v) for v in bbox_raw)
            if None not in (south, north, west, east):
                bbox = [west, south, east, north]
        results.append(
            GeocodingResult(
                provider="nominatim",
                label=str(item.get("display_name") or query),
                longitude=longitude,
                latitude=latitude,
                score=_parse_float(item.get("importance")),
                bbox=bbox,
                raw=item,
            )
        )
    return results


# Parametros da projecao TM-POA (SIRGAS 2000 / Porto Alegre TM, EPSG:10665),
# usados para converter lon/lat (WGS84) para a SR nativa do locator ArcGIS
# antes de chamar reverseGeocode (o servico nao aceita location em 4326).
_GRS80_A = 6378137.0
_GRS80_F = 1 / 298.257222101
_GRS80_E2 = _GRS80_F * (2 - _GRS80_F)
_GRS80_EP2 = _GRS80_E2 / (1 - _GRS80_E2)
_TMPOA_LON0 = math.radians(-51.0)
_TMPOA_K0 = 0.999995
_TMPOA_FE = 300000.0
_TMPOA_FN = 5000000.0


def _meridional_arc(lat: float) -> float:
    e2, e4, e6 = _GRS80_E2, _GRS80_E2**2, _GRS80_E2**3
    return _GRS80_A * (
        (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * lat
        - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * math.sin(2 * lat)
        + (15 * e4 / 256 + 45 * e6 / 1024) * math.sin(4 * lat)
        - (35 * e6 / 3072) * math.sin(6 * lat)
    )


def _wgs84_to_tmpoa(longitude: float, latitude: float) -> tuple[float, float]:
    lat = math.radians(latitude)
    lon = math.radians(longitude)
    n = _GRS80_A / math.sqrt(1 - _GRS80_E2 * math.sin(lat) ** 2)
    t = math.tan(lat) ** 2
    c = _GRS80_EP2 * math.cos(lat) ** 2
    aa = (lon - _TMPOA_LON0) * math.cos(lat)
    m = _meridional_arc(lat)

    x = _TMPOA_FE + _TMPOA_K0 * n * (
        aa
        + (1 - t + c) * aa**3 / 6
        + (5 - 18 * t + t**2 + 72 * c - 58 * _GRS80_EP2) * aa**5 / 120
    )
    y = _TMPOA_FN + _TMPOA_K0 * (
        m
        + n
        * math.tan(lat)
        * (
            aa**2 / 2
            + (5 - t + 9 * c + 4 * c**2) * aa**4 / 24
            + (61 - 58 * t + t**2 + 600 * c - 330 * _GRS80_EP2) * aa**6 / 720
        )
    )
    return x, y


def _clean_str(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _format_cep(value: Any) -> str | None:
    digits = str(value).strip()
    if not digits.isdigit():
        return None
    digits = digits.zfill(8)
    return f"{digits[:5]}-{digits[5:]}"


def _split_arcgis_address(address: str) -> tuple[str | None, str | None]:
    """Separa "2141 R CRUZEIRO DO SUL" em (logradouro, numero)."""
    match = re.match(r"^(\d+)\s+(.+)$", address.strip())
    if not match:
        return None, None
    return match.group(2), match.group(1)


async def _cdl_lookup(street: str, number: str) -> tuple[str | None, str | None]:
    """Cruza logradouro+numero com o CDL REST para obter bairro/CEP."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                settings.cdlrest_search_base_url,
                params={"q": street, "numero": number},
            )
            response.raise_for_status()
        except (httpx.HTTPStatusError, httpx.RequestError):
            return None, None

    try:
        data = response.json()
    except ValueError:
        return None, None

    items = _cdl_items(data)
    if not items:
        return None, None

    item = next((entry for entry in items if entry.get("situacao") == "ATUAL"), items[0])
    return _clean_str(item.get("nomeBairro")), _format_cep(item.get("cep"))


async def _reverse_arcgis(longitude: float, latitude: float) -> ReverseGeocodingResult:
    tmpoa_x, tmpoa_y = _wgs84_to_tmpoa(longitude, latitude)
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            settings.arcgis_reverse_geocode_base_url,
            params={
                "f": "json",
                "location": f"{tmpoa_x},{tmpoa_y}",
                "outSR": 4326,
            },
        )
    response.raise_for_status()
    data = response.json()
    address = data.get("address") or {}
    location = data.get("location") or {}
    result_longitude = _parse_float(location.get("x")) or longitude
    result_latitude = _parse_float(location.get("y")) or latitude

    address_value = _clean_str(address.get("Address"))
    neighborhood = _clean_str(address.get("Neighborhood")) or _clean_str(address.get("Subregion"))
    postal_code = _clean_str(address.get("Postal"))

    if address_value and (not neighborhood or not postal_code):
        street, number = _split_arcgis_address(address_value)
        if street and number:
            cdl_bairro, cdl_cep = await _cdl_lookup(street, number)
            neighborhood = neighborhood or cdl_bairro
            postal_code = postal_code or cdl_cep

    return ReverseGeocodingResult(
        provider="arcgis-procempa",
        label=_clean_str(address.get("Match_addr")) or address_value or "Local encontrado",
        address=address_value,
        neighborhood=neighborhood,
        postal_code=postal_code,
        longitude=result_longitude,
        latitude=result_latitude,
        raw=data,
    )


async def _reverse_nominatim(longitude: float, latitude: float) -> ReverseGeocodingResult:
    async with httpx.AsyncClient(
        timeout=15.0,
        headers={"User-Agent": "GeoframeNovo/1.0 (geocoding middleware)"},
    ) as client:
        response = await client.get(
            settings.nominatim_reverse_base_url,
            params={
                "lon": longitude,
                "lat": latitude,
                "format": "json",
                "addressdetails": 1,
            },
        )
    response.raise_for_status()
    data = response.json()
    address = data.get("address") or {}
    result_longitude = _parse_float(data.get("lon")) or longitude
    result_latitude = _parse_float(data.get("lat")) or latitude

    street = _clean_str(address.get("road") or address.get("pedestrian") or address.get("footway"))
    house_number = _clean_str(address.get("house_number"))
    formatted_address = ", ".join(part for part in (street, house_number) if part) or None

    neighborhood = _clean_str(address.get("suburb")) or _clean_str(address.get("neighbourhood"))
    postal_code = _clean_str(address.get("postcode"))

    if street and house_number and (not neighborhood or not postal_code):
        cdl_bairro, cdl_cep = await _cdl_lookup(street, house_number)
        neighborhood = neighborhood or cdl_bairro
        postal_code = postal_code or cdl_cep

    return ReverseGeocodingResult(
        provider="nominatim",
        label=str(data.get("display_name") or "Local encontrado"),
        address=formatted_address,
        neighborhood=neighborhood,
        postal_code=postal_code,
        longitude=result_longitude,
        latitude=result_latitude,
        raw=data,
    )


@router.get("/reverse", response_model=ReverseGeocodingResult)
async def reverse(
    provider: ReverseGeocodingProvider,
    lon: float = Query(...),
    lat: float = Query(...),
) -> ReverseGeocodingResult:
    try:
        if provider == "arcgis-procempa":
            return await _reverse_arcgis(lon, lat)
        return await _reverse_nominatim(lon, lat)
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500] if exc.response is not None else "Erro no servico de geocoding."
        raise HTTPException(status_code=502, detail=detail) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Servico de geocoding indisponivel.") from exc


@router.get("/search", response_model=list[GeocodingResult])
async def search(
    provider: GeocodingProvider,
    q: str = Query(default="", min_length=1),
    number: str | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=10),
) -> list[GeocodingResult]:
    query = q.strip()
    try:
        if provider == "arcgis-procempa":
            return await _search_arcgis(query, limit)
        if provider == "nominatim":
            return await _search_nominatim(query, limit)
        if not number or not number.strip():
            raise HTTPException(status_code=422, detail="Numero obrigatorio para CDL REST.")
        return await _search_cdl(query, number.strip(), limit)
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500] if exc.response is not None else "Erro no servico de geocoding."
        raise HTTPException(status_code=502, detail=detail) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Servico de geocoding indisponivel.") from exc


@router.get("/cdl/suggestions", response_model=list[CdlSuggestion])
async def cdl_suggestions(
    q: str = Query(min_length=2),
    limit: int = Query(default=10, ge=1, le=20),
) -> list[CdlSuggestion]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(settings.cdlrest_search_base_url, params={"q": q.strip()})
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:500] if exc.response is not None else "Erro no CDL REST."
            raise HTTPException(status_code=502, detail=detail) from exc
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail="CDL REST indisponivel.") from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Resposta invalida do CDL REST.") from exc

    items = _cdl_items(data)

    suggestions: list[CdlSuggestion] = []
    for item in items[:limit]:
        label = str(item.get("enderecoFormatado") or item.get("nomeLogradouro") or "")
        if not label:
            continue
        suggestions.append(
            CdlSuggestion(
                label=label,
                value=label,
                codigoLogradouro=item.get("codigoLogradouro"),
                raw=item,
            )
        )
    return suggestions
