# Router principal incluindo todas as rotas.
from fastapi import APIRouter

from app.api.routes import auth, resources, tiles, users

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(tiles.router)
api_router.include_router(resources.router)
