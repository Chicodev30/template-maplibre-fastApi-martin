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
    db_schema: str = "gfr_app"

    # Bypass de dev so deve ligar quando AUTH_DEV_BYPASS=true.
    auth_dev_bypass: bool = False
    auth_dev_role: str = "gfr-admin"

    api_key_enabled: bool = True
    api_key_id: str = ""
    api_key_secret: str = Field(default="", repr=False)

    # GeoServer GWC visto pela API (substitui o Martin para o teste de performance).
    geoserver_base_url: str = "http://host.docker.internal:8083/geoserver"
    geoserver_user: str = "admin"
    geoserver_password: str = Field(default="geoserver", repr=False)
    geoserver_gridset: str = "EPSG:900913"

    arcgis_find_address_base_url: str = (
        "https://mapaspoa-des-2020.procempa.com.br/arcgis/rest/services/"
        "GEOCODE/TMPOA_CAT_COD_NOME_COMP_PRO/GeocodeServer/findAddressCandidates"
    )
    cdlrest_search_base_url: str = "https://cdlrest.procempa.com.br/cdlrest/rest/query/endereco"
    nominatim_search_base_url: str = "https://nominatim.openstreetmap.org/search"
    porto_alegre_viewbox: str = "-51.30,-29.90,-51.01,-30.25"

    nominatim_reverse_base_url: str = "https://nominatim.openstreetmap.org/reverse"

    # Explorador de arquivos: middleware para os buckets MinIO.
    minio_endpoint: str = "mapaspoa-minio.procempa.com.br"
    minio_access_key: str = "mapaspoa"
    minio_secret_key: str = Field(default="", repr=False)
    minio_secure: bool = True

    @property
    def arcgis_reverse_geocode_base_url(self) -> str:
        # Mesmo locator do forward geocoding (findAddressCandidates), que
        # retorna Address/Neighborhood/Postal (o locator CODIGO de
        # TM_POA_CAT_COD_NOME_COMP so retorna o codigo da rua).
        return self.arcgis_find_address_base_url.replace("/findAddressCandidates", "/reverseGeocode")

    # Limite de tamanho para upload de arquivos vetoriais (novo recurso).
    upload_max_size_mb: int = 200

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
