from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.constants import KEYCLOAK_CLIENT_ID, KEYCLOAK_ISSUER, KEYCLOAK_JWKS_URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = True
    api_cors_origins: str = "http://localhost:5173"

    db_name: str = "geoframe"
    db_user: str = "geoframe_adm"
    db_password: str = ""
    db_host: str = "lpostdes14.procempa.com.br"
    db_port: int = 6000
    db_schema: str = "smftest"
    # Schema dedicado para os metadados do app (usuarios, config de recurso,
    # permissoes), isolado do schema de dados espaciais (db_schema).
    db_app_schema: str = "gfr_app"

    kc_role_visualizador: str = "gfr-visualizador"
    kc_role_admin: str = "gfr-admin"
    kc_role_contribuidor: str = "gfr-contribuidor"

    # Auth: enquanto o login Keycloak nao esta plugado, um bypass de dev injeta
    # um usuario fake cujo(s) papel(eis) vem do header X-Dev-Role (ou do default).
    auth_dev_bypass: bool = True
    auth_dev_role: str = "gfr-admin"

    api_key_enabled: bool = True
    api_key_id: str = ""
    api_key_secret: str = Field(default="", repr=False)

    martin_base_url: str = "http://martin:3000"
    martin_internal_url: str = "http://martin:3000"
    martin_public_tile_base_url: str = "/tiles"

    keycloak_client_id: str = KEYCLOAK_CLIENT_ID
    keycloak_issuer: str = KEYCLOAK_ISSUER
    keycloak_jwks_url: str = KEYCLOAK_JWKS_URL

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def async_database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
