# OGC API Features: endpoint de features GeoJSON direto do PostGIS.
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import ogc_features_service

router = APIRouter(prefix="/ogc", tags=["ogc-features"])


@router.get("/collections/{resource_id:path}/items")
async def get_items(
    resource_id: str,
    limit: Annotated[int, Query(ge=1, le=10000)] = 1000,
    offset: Annotated[int, Query(ge=0)] = 0,
    bbox: Annotated[str | None, Query()] = None,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
) -> dict:
    """Retorna FeatureCollection GeoJSON para a coleção/recurso indicado.

    O resource_id deve seguir o formato 'schema.tabela' correspondente à
    tabela PostGIS de origem.

    Parâmetros OGC API Features:
    - bbox: minLon,minLat,maxLon,maxLat em WGS84 (opcional)
    - limit/offset: paginação
    """
    parsed_bbox: list[float] | None = None
    if bbox:
        try:
            parts = [float(v) for v in bbox.split(",")]
            if len(parts) != 4:
                raise ValueError
            parsed_bbox = parts
        except ValueError:
            raise HTTPException(status_code=400, detail="bbox deve ter 4 valores: minLon,minLat,maxLon,maxLat")

    try:
        return await ogc_features_service.get_features(db, resource_id, limit=limit, offset=offset, bbox=parsed_bbox)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/collections/{resource_id:path}/items/{feature_id}")
async def get_item(
    resource_id: str,
    feature_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
) -> dict:
    """Retorna uma única feature pelo id."""
    try:
        feature = await ogc_features_service.get_feature(db, resource_id, feature_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if feature is None:
        raise HTTPException(status_code=404, detail="Feature não encontrada")
    return feature
