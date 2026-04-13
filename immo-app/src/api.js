import { API_BASE_URL } from "./config";

const CSRF_STORAGE_KEY = "immo3d_csrf_token";
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 12000);

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function storeCsrfToken(token) {
  if (token) {
    localStorage.setItem(CSRF_STORAGE_KEY, token);
    return;
  }

  localStorage.removeItem(CSRF_STORAGE_KEY);
}

function getStoredCsrfToken() {
  return localStorage.getItem(CSRF_STORAGE_KEY) || "";
}

function syncAuthPayload(payload) {
  if (payload && typeof payload === "object" && "csrf_token" in payload) {
    storeCsrfToken(payload.csrf_token || "");
  }
}

async function apiFetch(path, options = {}) {
  let response;
  const method = (options.method || "GET").toUpperCase();
  const csrfToken = getStoredCsrfToken();
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => {
    abortController.abort();
  }, API_TIMEOUT_MS);

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      signal: abortController.signal,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method)
          ? { "X-CSRF-Token": csrfToken }
          : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    const timeoutError =
      error?.name === "AbortError"
        ? new Error(
            "Le backend met trop de temps a repondre. Verifie le Wi-Fi, puis recharge la page."
          )
        : null;
    const networkError =
      timeoutError ||
      new Error(
        "Connexion au backend impossible. Verifie que le backend tourne sur le PC, qu'il ecoute sur le reseau local et que le telephone est sur le meme Wi-Fi."
      );
    networkError.cause = error;
    throw networkError;
  } finally {
    window.clearTimeout(timeoutId);
  }

  const data = await readJson(response);
  const contentType = response.headers.get("content-type") || "";

  if (response.ok && data === null && contentType.includes("text/html")) {
    throw new Error(
      "Le front n'arrive pas a joindre l'API (proxy dev). Relance le front et reessaie."
    );
  }

  syncAuthPayload(data);

  if (!response.ok) {
    if (Array.isArray(data?.detail)) {
      throw new Error(data.detail[0]?.msg || "Erreur de validation");
    }

    const error = new Error(data?.detail || data?.message || "Erreur API");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

function buildBiensQuery(zoneRecherche) {
  const params = new URLSearchParams();
  const valeur = zoneRecherche.trim();

  if (/^\d{5}$/.test(valeur)) {
    params.append("zip_code", valeur);
  } else if (valeur !== "") {
    params.append("ville", valeur);
  }

  return params.toString();
}

export function getAuthStatus() {
  return apiFetch("/auth/me", { method: "GET" });
}

export function loginYanport(username, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logoutYanport() {
  return apiFetch("/auth/logout", { method: "POST" }).finally(() => {
    storeCsrfToken("");
  });
}

export function getBiens(zoneRecherche) {
  const query = buildBiensQuery(zoneRecherche);
  return apiFetch(`/biens${query ? `?${query}` : ""}`, { method: "GET" });
}

export function saveNote(bienId, note) {
  return apiFetch("/notes", {
    method: "POST",
    body: JSON.stringify({ bien_id: bienId, note }),
  });
}

export function addBlacklist(bienId, surface, prix) {
  return apiFetch("/blacklist", {
    method: "POST",
    body: JSON.stringify({ bien_id: bienId, surface, prix }),
  });
}

export function removeBlacklist(bienId) {
  return apiFetch(`/blacklist/${bienId}`, {
    method: "DELETE",
  });
}

export function addFavorite(bienId) {
  return apiFetch("/biens/favorites", {
    method: "POST",
    body: JSON.stringify({ bien_id: bienId }),
  });
}

export function removeFavorite(bienId) {
  return apiFetch(`/biens/favorites/${bienId}`, {
    method: "DELETE",
  });
}

export function addSetAside(bienId) {
  return apiFetch("/biens/set-aside", {
    method: "POST",
    body: JSON.stringify({ bien_id: bienId }),
  });
}

export function removeSetAside(bienId) {
  return apiFetch(`/biens/set-aside/${bienId}`, {
    method: "DELETE",
  });
}

export function saveBienPlacement(bienId, lat, lon, manualAddress = "") {
  return apiFetch(`/biens/${bienId}/placement`, {
    method: "PUT",
    body: JSON.stringify({ lat, lon, manual_address: manualAddress }),
  });
}

export function deleteBienPlacement(bienId) {
  return apiFetch(`/biens/${bienId}/placement`, {
    method: "DELETE",
  });
}

export function getCustomMarkers(searchZone = "") {
  const params = new URLSearchParams();
  const normalizedZone = searchZone.trim();
  if (normalizedZone) {
    params.append("zone", normalizedZone);
  }

  const query = params.toString();
  return apiFetch(`/markers${query ? `?${query}` : ""}`, { method: "GET" });
}

export function createCustomMarker(
  lat,
  lon,
  note,
  searchZone = "",
  address = "",
  photos = []
) {
  return apiFetch("/markers", {
    method: "POST",
    body: JSON.stringify({
      lat,
      lon,
      note,
      search_zone: searchZone.trim(),
      address,
      photos,
    }),
  });
}

export function updateCustomMarker(markerId, note, address = "", photos = []) {
  return apiFetch(`/markers/${markerId}`, {
    method: "PATCH",
    body: JSON.stringify({ note, address, photos }),
  });
}

export function deleteCustomMarker(markerId) {
  return apiFetch(`/markers/${markerId}`, {
    method: "DELETE",
  });
}

export function getBoundary(query) {
  const params = new URLSearchParams();
  params.append("q", query.trim());
  return apiFetch(`/geocoding/boundary?${params.toString()}`, { method: "GET" });
}

export function createBillingCheckoutSession() {
  return apiFetch("/billing/checkout-session", { method: "POST" });
}

export function syncBillingCheckoutSession(sessionId) {
  return apiFetch("/billing/checkout-session/sync", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function createBillingPortalSession() {
  return apiFetch("/billing/portal-session", { method: "POST" });
}
