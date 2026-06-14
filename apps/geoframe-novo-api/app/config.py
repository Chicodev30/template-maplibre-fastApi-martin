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
    api_cors_origins: str = "http://localhost"

    db_name: str = "geoframe"
    db_user: str = "geoframe_adm"
    db_password: str = ""
    db_host: str = "lpostdes14.procempa.com.br"
    db_port: int = 6000
    # Schema com as tabelas de recursos espaciais (catalogo da API + auto_publish do Martin).
    db_schema_resources: str = "smftest"
    # Schema dedicado para os metadados do app (usuarios, config de recurso,
    # permissoes), isolado do schema de recursos espaciais (db_schema_resources).
    db_schema_app: str = "gfr_app"

    kc_role_visualizador: str = "gfr-visualizador"
    kc_role_admin: str = "gfr-admin"
    kc_role_contribuidor: str = "gfr-contribuidor"

    # Bypass de dev so deve ligar quando AUTH_DEV_BYPASS=true.
    auth_dev_bypass: bool = False
    auth_dev_role: str = "gfr-admin"

    api_key_enabled: bool = True
    api_key_id: str = ""
    api_key_secret: str = Field(default="", repr=False)

    martin_internal_url: str = "http://geoframe-martin:3000"

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
