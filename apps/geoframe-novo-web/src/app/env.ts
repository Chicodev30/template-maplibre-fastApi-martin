export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api",
  appTitle: import.meta.env.VITE_APP_TITLE ?? "GeoFrame",
  appSubtitle:
    import.meta.env.VITE_APP_SUBTITLE ?? "Framework para análise e visualização de dados geoespaciais",
};
