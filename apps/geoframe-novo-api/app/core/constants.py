"""Constantes da aplicacao.

Valores intencionalmente fora do .env porque sao constantes institucionais
compartilhadas entre API e Web. Segredos e parametros de ambiente ficam no .env.
"""

KEYCLOAK_URL = "https://sso-pmpa-hom.procempa.com.br/auth"
KEYCLOAK_REALM = "pmpa"
KEYCLOAK_CLIENT_ID = "gfr"

KEYCLOAK_ISSUER = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}"
KEYCLOAK_JWKS_URL = f"{KEYCLOAK_ISSUER}/protocol/openid-connect/certs"

# Papeis configurados no Keycloak para o GeoFrame.
KC_ROLE_VISUALIZADOR = "gfr-visualizador"
KC_ROLE_ADMIN = "gfr-admin"
KC_ROLE_CONTRIBUIDOR = "gfr-contribuidor"

# Tile service defaults para GeoServer GWC.
TILE_DEFAULT_FORMAT = "application/vnd.mapbox-vector-tile"
TILE_DEFAULT_GRIDSET = "EPSG:900913"
