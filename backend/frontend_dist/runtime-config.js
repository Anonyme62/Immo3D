window.__IMMO3D_RUNTIME_CONFIG__ = window.__IMMO3D_RUNTIME_CONFIG__ || {};

// URL backend pour builds mobiles (ex: "http://192.168.1.13:8000").
// Laisse vide si le front et l'API sont servis sur le meme origin.
const hostname = window.location.hostname || "";
const isLocalHost =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname.endsWith(".local") ||
  /^192\.168\./.test(hostname) ||
  /^10\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

window.__IMMO3D_RUNTIME_CONFIG__.apiBaseUrl =
  window.__IMMO3D_RUNTIME_CONFIG__.apiBaseUrl ||
  (isLocalHost ? "" : "https://app.pigepro.fr");

// Optionnel: surcharge du token Cesium sans rebuild.
window.__IMMO3D_RUNTIME_CONFIG__.cesiumIonToken =
  window.__IMMO3D_RUNTIME_CONFIG__.cesiumIonToken || "";

window.__IMMO3D_RUNTIME_CONFIG__.buildVersion =
  window.__IMMO3D_RUNTIME_CONFIG__.buildVersion || "";

window.__IMMO3D_RUNTIME_CONFIG__.buildRef =
  window.__IMMO3D_RUNTIME_CONFIG__.buildRef || "";
