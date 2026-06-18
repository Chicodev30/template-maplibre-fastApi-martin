# Modelo Role.
# Papeis padrao do app e a hierarquia "o maior prevalece".
from enum import Enum

from app.core.constants import KC_ROLE_ADMIN, KC_ROLE_CONTRIBUIDOR, KC_ROLE_VISUALIZADOR


class AppRole(str, Enum):
    admin = "admin"
    contribuidor = "contribuidor"
    visualizador = "visualizador"


# Hierarquia: Admin > Contribuidor > Visualizador.
_RANK: dict[AppRole, int] = {
    AppRole.visualizador: 1,
    AppRole.contribuidor: 2,
    AppRole.admin: 3,
}

_KC_TO_APP: dict[str, AppRole] = {
    KC_ROLE_ADMIN: AppRole.admin,
    KC_ROLE_CONTRIBUIDOR: AppRole.contribuidor,
    KC_ROLE_VISUALIZADOR: AppRole.visualizador,
}


def rank(role: AppRole) -> int:
    return _RANK[role]


def map_kc_roles(kc_roles: list[str]) -> set[AppRole]:
    """Converte os roles do Keycloak nos papeis do app (ignora os demais)."""
    return {_KC_TO_APP[r] for r in kc_roles if r in _KC_TO_APP}


def highest_role(app_roles: set[AppRole]) -> AppRole | None:
    """Se o usuario tiver mais de um papel padrao, o maior prevalece."""
    if not app_roles:
        return None
    return max(app_roles, key=rank)
