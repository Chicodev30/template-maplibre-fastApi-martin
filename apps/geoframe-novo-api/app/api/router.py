# Router principal incluindo todas as rotas.
from fastapi import APIRouter

from app.api.routes import (
    auth,
    geocoding,
    group_layers,
    layer_styles,
    ogc_features,
    resource_config_profiles,
    resources,
    storage,
    users,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(ogc_features.router)
api_router.include_router(resources.router)
api_router.include_router(group_layers.router)
api_router.include_router(layer_styles.router)
api_router.include_router(resource_config_profiles.router)
api_router.include_router(geocoding.router)
api_router.include_router(storage.router)
