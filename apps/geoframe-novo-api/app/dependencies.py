# Dependências FastAPI: db session, current_user, permissions.
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, Request
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
    x_dev_role: str | None = Header(default=None),
) -> Identity:
    if settings.auth_dev_bypass:
        # Modo dev: papel(eis) vem do header X-Dev-Role (CSV) ou do default.
        raw = x_dev_role if x_dev_role is not None else settings.auth_dev_role
        kc_roles = [r.strip() for r in raw.split(",") if r.strip()]
        key = "-".join(sorted(kc_roles)) or "norole"
        return Identity(
            sub=f"dev-{key}",
            username=f"dev-{key}",
            email=f"{key}@local.dev",
            full_name=f"Dev ({key})",
            kc_roles=kc_roles,
        )

    # Modo real: access token do Keycloak no header Authorization.
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token ausente")
    claims = decode_token(auth[len("Bearer ") :])
    return Identity(
        sub=claims["sub"],
        username=claims.get("preferred_username", claims["sub"]),
        email=claims.get("email"),
        full_name=claims.get("name"),
        kc_roles=claims.get("realm_access", {}).get("roles", []),
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
