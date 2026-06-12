export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api",
  tileBaseUrl: import.meta.env.VITE_TILE_BASE_URL ?? "http://localhost:3000",
  appTitle: import.meta.env.VITE_APP_TITLE ?? "GeoFrame",
  // Enquanto o login Keycloak nao esta plugado, usa o bypass de dev (header
  // X-Dev-Role). Defina VITE_AUTH_DEV_BYPASS=false para exigir token real.
  authDevBypass: import.meta.env.VITE_AUTH_DEV_BYPASS !== "false",
};
