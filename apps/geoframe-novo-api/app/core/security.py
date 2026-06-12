# Validação JWT e helpers de segurança.
from typing import Any

from jose import jwt

from app.config import get_settings
from app.core.keycloak import get_jwks


def decode_token(token: str) -> dict[str, Any]:
    """Valida a assinatura e os claims de um access token do Keycloak.

    Usado no modo real (auth_dev_bypass=False). A validacao de audience fica
    desligada porque o Keycloak costuma emitir aud="account"; o controle de
    acesso e feito pelos realm roles (gfr-*).
    """
    settings = get_settings()
    return jwt.decode(
        token,
        get_jwks(),
        algorithms=["RS256"],
        issuer=settings.keycloak_issuer,
        options={"verify_aud": False},
    )
