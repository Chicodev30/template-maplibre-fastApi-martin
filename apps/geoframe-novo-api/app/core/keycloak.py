# Integração com Keycloak/SSO-PMPA.
# Busca (com cache) das chaves publicas (JWKS) usadas para validar os tokens.
# Usado apenas no modo real (auth_dev_bypass=False).
from functools import lru_cache
from typing import Any

import httpx

from app.config import get_settings


@lru_cache
def get_jwks() -> dict[str, Any]:
    settings = get_settings()
    resp = httpx.get(settings.keycloak_jwks_url, timeout=10.0)
    resp.raise_for_status()
    return resp.json()
