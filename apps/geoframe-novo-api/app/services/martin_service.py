# Serviço integração Martin/tilejson.
# A API e o unico gateway: o navegador nunca fala direto com o Martin.
from typing import Any

import httpx

from app.config import get_settings

settings = get_settings()


def _martin_url(path: str) -> str:
    base = settings.martin_internal_url.rstrip("/")
    return f"{base}/{path.lstrip('/')}"


async def get_catalog() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(_martin_url("/catalog"))
        resp.raise_for_status()
        return resp.json()


async def get_tilejson(source_id: str, public_tile_base: str) -> dict[str, Any]:
    """TileJSON do Martin com as URLs de tile reescritas para passarem pela API."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(_martin_url(f"/{source_id}"))
        resp.raise_for_status()
        tj = resp.json()
    tj["tiles"] = [f"{public_tile_base}/{source_id}/{{z}}/{{x}}/{{y}}"]
    return tj


async def get_tile(source_id: str, z: int, x: int, y: int) -> httpx.Response:
    async with httpx.AsyncClient(timeout=30.0) as client:
        return await client.get(_martin_url(f"/{source_id}/{z}/{x}/{y}"))
