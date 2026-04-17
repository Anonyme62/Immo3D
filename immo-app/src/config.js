const runtimeApiBaseUrl = window.__IMMO3D_RUNTIME_CONFIG__?.apiBaseUrl || "";
const runtimeGoogle3DTilesApiKey =
  window.__IMMO3D_RUNTIME_CONFIG__?.google3dApiKey || "";
const runtimeBuildVersion =
  window.__IMMO3D_RUNTIME_CONFIG__?.buildVersion || "";
const runtimeBuildRef = window.__IMMO3D_RUNTIME_CONFIG__?.buildRef || "";

function normalizeBaseUrl(value) {
  return (value || "").replace(/\/+$/, "");
}

function defaultApiBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  if (import.meta.env.PROD) {
    return "";
  }

  // En dev, on passe par le proxy Vite (meme origin) pour stabiliser
  // l'acces depuis mobile sans exposer un deuxieme port reseau.
  return "";
}

export const API_BASE_URL = normalizeBaseUrl(
  runtimeApiBaseUrl || import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl()
);

export const GOOGLE_3D_TILES_API_KEY = (
  runtimeGoogle3DTilesApiKey ||
  import.meta.env.VITE_GOOGLE_3D_TILES_API_KEY ||
  ""
).trim();

export const APP_BUILD_VERSION = (
  runtimeBuildVersion ||
  import.meta.env.VITE_APP_BUILD_VERSION ||
  "dev"
).trim();

export const APP_BUILD_REF = (
  runtimeBuildRef ||
  import.meta.env.VITE_APP_BUILD_REF ||
  "local"
).trim();
