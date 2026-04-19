const bundledTokenModules = import.meta.glob("./*token*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});

const bundledCesiumIonToken = Object.values(bundledTokenModules).find(
  (value) => typeof value === "string" && value.trim()
) || "";

const runtimeApiBaseUrl = window.__IMMO3D_RUNTIME_CONFIG__?.apiBaseUrl || "";
const runtimeCesiumIonToken =
  window.__IMMO3D_RUNTIME_CONFIG__?.cesiumIonToken || "";
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

export const API_HEALTH_URL = `${API_BASE_URL || ""}/health`;

export const CESIUM_ION_TOKEN = (
  runtimeCesiumIonToken ||
  import.meta.env.VITE_CESIUM_ION_TOKEN ||
  bundledCesiumIonToken ||
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
