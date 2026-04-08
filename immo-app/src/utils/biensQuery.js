export function buildBiensQuery(zoneRecherche) {
  const params = new URLSearchParams();
  const valeur = (zoneRecherche || "").trim();

  if (/^\d{5}$/.test(valeur)) {
    params.append("zip_code", valeur);
  } else if (valeur !== "") {
    params.append("ville", valeur);
  }

  return params.toString();
}
