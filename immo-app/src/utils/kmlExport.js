function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildBienDescription(bien) {
  const lines = [
    `Agence: ${bien.agence || "Non renseignee"}`,
    `Adresse: ${bien.adresse || "Non renseignee"}`,
    `Prix: ${bien.prix ?? "N/A"} EUR`,
    `Surface: ${bien.surface ?? "N/A"} m2`,
    `Anciennete: ${bien.anciennete ?? "N/A"} jours`,
    `Statut: ${bien.statut || (bien.blackliste ? "blackliste" : "actif")}`,
  ];

  if (bien.note) {
    lines.push(`Note: ${bien.note}`);
  }

  return escapeXml(lines.join("\n"));
}

function buildMarkerDescription(marker) {
  return escapeXml(marker.note || "Repere perso");
}

function slugify(value) {
  return String(value || "export")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "export";
}

export function buildKmlDocument({ zoneRecherche, biens = [], customMarkers = [] }) {
  const bienPlacemarks = biens
    .filter((bien) => bien.lat != null && bien.lon != null)
    .map((bien) => {
      const title =
        bien.adresse && bien.adresse.trim() !== ""
          ? `${bien.prix ?? "N/A"} EUR - ${bien.adresse}`
          : `${bien.prix ?? "N/A"} EUR`;

      return `
    <Placemark>
      <name>${escapeXml(title)}</name>
      <styleUrl>#bienMarker</styleUrl>
      <description>${buildBienDescription(bien)}</description>
      <Point>
        <coordinates>${bien.lon},${bien.lat},0</coordinates>
      </Point>
    </Placemark>`;
    })
    .join("");

  const customMarkerPlacemarks = customMarkers
    .filter((marker) => marker.lat != null && marker.lon != null)
    .map((marker, index) => {
      const title = marker.note?.trim() || `Repere perso ${index + 1}`;

      return `
    <Placemark>
      <name>${escapeXml(title)}</name>
      <styleUrl>#customMarker</styleUrl>
      <description>${buildMarkerDescription(marker)}</description>
      <Point>
        <coordinates>${marker.lon},${marker.lat},0</coordinates>
      </Point>
    </Placemark>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(zoneRecherche || "Immo 3D")}</name>
    <Style id="bienMarker">
      <IconStyle>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
    <Style id="customMarker">
      <IconStyle>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/wht-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>${bienPlacemarks}${customMarkerPlacemarks}
  </Document>
</kml>`;
}

export function downloadKmlExport({ zoneRecherche, biens = [], customMarkers = [] }) {
  const content = buildKmlDocument({ zoneRecherche, biens, customMarkers });
  const blob = new Blob([content], {
    type: "application/vnd.google-earth.kml+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `immo3d-${slugify(zoneRecherche || "export")}.kml`;

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
