import { API_BASE_URL } from "./config";

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function apiFetch(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    const networkError = new Error(
      "Connexion au backend impossible. Verifie que le backend tourne sur le PC, qu'il ecoute sur le reseau local et que le telephone est sur le meme Wi-Fi."
    );
    networkError.cause = error;
    throw networkError;
  }

  const data = await readJson(response);

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
  return apiFetch("/auth/logout", { method: "POST" });
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

export function createCustomMarker(lat, lon, note, searchZone = "") {
  return apiFetch("/markers", {
    method: "POST",
    body: JSON.stringify({ lat, lon, note, search_zone: searchZone.trim() }),
  });
}

export function updateCustomMarker(markerId, note) {
  return apiFetch(`/markers/${markerId}`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
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
