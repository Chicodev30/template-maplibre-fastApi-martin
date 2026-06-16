# Rotas/proxy/controlador de tiles GeoServer (GWC).
# Middleware entre o front e o GeoServer: catalogo/tilejson/tiles passam pela API.
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Request, Response

from app.dependencies import get_current_user
from app.models.user import User
from app.services import geoserver_service

router = APIRouter(prefix="/tiles", tags=["tiles"])


def _public_tile_base(request: Request) -> str:
    # Ex.: http://localhost:8000/api/tiles (URL publica vista pelo navegador).
    return f"{str(request.base_url).rstrip('/')}/api/tiles"


@router.get("/catalog")
async def catalog(_user: User = Depends(get_current_user)) -> dict[str, Any]:
    # Requer login (qualquer um dos 3 papeis). Filtro por permissao entra depois.
    return await geoserver_service.get_catalog()


@router.get("/{source_id}")
async def tilejson(
    source_id: str,
    request: Request,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    return await geoserver_service.get_tilejson(source_id, _public_tile_base(request))


@router.get("/{source_id}/{z}/{x}/{y}", name="get_tile")
async def tile(source_id: str, z: int, x: int, y: int) -> Response:
    # Bytes do MVT: aberto (MapLibre busca sem header). Auth no tile fica para depois.
    try:
        upstream = await geoserver_service.get_tile(source_id, z, x, y)
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            media_type=upstream.headers.get("content-type", "application/x-protobuf"),
        )
    except httpx.HTTPError:
        return Response(status_code=502)
