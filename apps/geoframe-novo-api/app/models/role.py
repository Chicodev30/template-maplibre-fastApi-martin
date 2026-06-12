# Modelo Role.
# Papeis padrao do app e a hierarquia "o maior prevalece".
from enum import Enum

from app.config import get_settings


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


def rank(role: AppRole) -> int:
    return _RANK[role]


def _kc_to_app_map() -> dict[str, AppRole]:
    s = get_settings()
    return {
        s.kc_role_admin: AppRole.admin,
        s.kc_role_contribuidor: AppRole.contribuidor,
        s.kc_role_visualizador: AppRole.visualizador,
    }


def map_kc_roles(kc_roles: list[str]) -> set[AppRole]:
    """Converte os roles do Keycloak nos papeis do app (ignora os demais)."""
    mapping = _kc_to_app_map()
    return {mapping[r] for r in kc_roles if r in mapping}


def highest_role(app_roles: set[AppRole]) -> AppRole | None:
    """Se o usuario tiver mais de um papel padrao, o maior prevalece."""
    if not app_roles:
        return None
    return max(app_roles, key=rank)
