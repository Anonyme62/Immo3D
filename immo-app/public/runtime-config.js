window.__IMMO3D_RUNTIME_CONFIG__ = window.__IMMO3D_RUNTIME_CONFIG__ || {};

// URL backend pour builds mobiles / embarques (ex: "http://192.168.1.13:8000").
// En prod web, on prefere desormais le meme origin que le frontend public.
const hostname = window.location.hostname || "";
const protocol = window.location.protocol || "";
const isLocalHost =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname.endsWith(".local") ||
  /^192\.168\./.test(hostname) ||
  /^10\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
const isHttpLike = protocol === "http:" || protocol === "https:";
const canonicalWebOrigin = "https://www.pigepro.fr";

window.__IMMO3D_RUNTIME_CONFIG__.apiBaseUrl =
  window.__IMMO3D_RUNTIME_CONFIG__.apiBaseUrl ||
  (isLocalHost ? "" : isHttpLike ? "" : canonicalWebOrigin);

// Optionnel: surcharge du token Cesium sans rebuild.
window.__IMMO3D_RUNTIME_CONFIG__.cesiumIonToken =
  window.__IMMO3D_RUNTIME_CONFIG__.cesiumIonToken || "";

window.__IMMO3D_RUNTIME_CONFIG__.buildVersion =
  window.__IMMO3D_RUNTIME_CONFIG__.buildVersion || "";

window.__IMMO3D_RUNTIME_CONFIG__.buildRef =
  window.__IMMO3D_RUNTIME_CONFIG__.buildRef || "";
