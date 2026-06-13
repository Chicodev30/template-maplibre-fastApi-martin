// Configuracao keycloak-js para SSO-PMPA.
import Keycloak from 'keycloak-js';
import {
  KEYCLOAK_CLIENT_ID,
  KEYCLOAK_REALM,
  KEYCLOAK_URL,
} from '../config/constants';

export const keycloak = new Keycloak({
  url: KEYCLOAK_URL,
  realm: KEYCLOAK_REALM,
  clientId: KEYCLOAK_CLIENT_ID,
});

let initPromise: Promise<boolean> | null = null;

export function initKeycloak() {
  if (!initPromise) {
    initPromise = keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });
  }
  return initPromise;
}

export async function getValidKeycloakToken() {
  if (!keycloak.authenticated) return null;
  await keycloak.updateToken(30);
  return keycloak.token ?? null;
}
