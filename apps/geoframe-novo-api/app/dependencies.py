# Dependências FastAPI: db session, current_user, permissions.
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import decode_token
from app.db.session import get_session
from app.models.role import AppRole, highest_role, map_kc_roles, rank
from app.models.user import User

settings = get_settings()


@dataclass
class Identity:
    """Identidade autenticada, antes de virar usuario do banco."""

    sub: str
    username: str
    email: str | None
    full_name: str | None
    kc_roles: list[str]


def get_identity(
    request: Request,
) -> Identity:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token ausente")
    try:
        claims = decode_token(auth[len("Bearer ") :])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Token invalido ou expirado") from exc
    client_roles = (
        claims.get("resource_access", {})
        .get(settings.keycloak_client_id, {})
        .get("roles", [])
    )
    realm_roles = claims.get("realm_access", {}).get("roles", [])
    return Identity(
        sub=claims["sub"],
        username=claims.get("preferred_username", claims["sub"]),
        email=claims.get("email"),
        full_name=claims.get("name"),
        kc_roles=list({*realm_roles, *client_roles}),
    )


def get_current_user(
    identity: Identity = Depends(get_identity),
    db: Session = Depends(get_session),
) -> User:
    """Resolve o papel efetivo e faz o auto-cadastro/atualizacao no 1o login.

    Sem nenhum dos 3 papeis padrao -> 403 (acesso negado) e nao registra.
    Com mais de um papel -> o maior prevalece.
    """
    effective = highest_role(map_kc_roles(identity.kc_roles))
    if effective is None:
        raise HTTPException(status_code=403, detail="Usuario sem papel de acesso ao portal")

    user = db.execute(
        select(User).where(User.keycloak_sub == identity.sub)
    ).scalar_one_or_none()
    if user is None:
        user = User(keycloak_sub=identity.sub)
        db.add(user)
    user.username = identity.username
    user.email = identity.email
    user.full_name = identity.full_name
    user.effective_role = effective.value
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def require_role(min_role: AppRole) -> Callable[..., User]:
    """Exige papel efetivo >= min_role (Admin > Contribuidor > Visualizador)."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        if rank(AppRole(user.effective_role)) < rank(min_role):
            raise HTTPException(status_code=403, detail="Permissao insuficiente")
        return user

    return dependency
