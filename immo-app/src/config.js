const bundledTokenModules = import.meta.glob("./*token*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});

const bundledCesiumIonToken = Object.values(bundledTokenModules).find(
  (value) => typeof value === "string" && value.trim()
) || "";

const runtimeCesiumIonToken =
  window.__IMMO3D_RUNTIME_CONFIG__?.cesiumIonToken || "";

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
  import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl()
);

export const CESIUM_ION_TOKEN = (
  runtimeCesiumIonToken ||
  import.meta.env.VITE_CESIUM_ION_TOKEN ||
  bundledCesiumIonToken ||
  ""
).trim();
