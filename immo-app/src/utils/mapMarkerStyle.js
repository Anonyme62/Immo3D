const LABEL_OFFSET_PRESETS = [
  { x: -42, y: -4 },
  { x: 0, y: -30 },
  { x: 42, y: -4 },
  { x: 0, y: 24 },
  { x: -34, y: -28 },
  { x: 34, y: -28 },
  { x: 34, y: 20 },
  { x: -34, y: 20 },
];

export function buildMarkerEntityId(bienId, index) {
  return `bien-marker-${String(bienId)}-${index}`;
}

export function getMarkerVisualState(bien, selectedBienId) {
  const isSelected = selectedBienId === bien.id;

  if (isSelected) {
    return {
      isSelected: true,
      pixelSize: 16,
      color: "dodgerblue",
      outlineWidth: 3,
      font: "700 18px sans-serif",
    };
  }

  if (bien.anciennete != null && bien.anciennete < 7) {
    return {
      isSelected: false,
      pixelSize: 12,
      color: "green",
      outlineWidth: 2,
      font: "16px sans-serif",
    };
  }

  if (bien.anciennete != null && bien.anciennete <= 30) {
    return {
      isSelected: false,
      pixelSize: 12,
      color: "orange",
      outlineWidth: 2,
      font: "16px sans-serif",
    };
  }

  return {
    isSelected: false,
    pixelSize: 12,
    color: "red",
    outlineWidth: 2,
    font: "16px sans-serif",
  };
}

export function getMarkerRenderPriority(bien, selectedBienId) {
  if (selectedBienId === bien.id) return 99;
  if (bien.anciennete != null && bien.anciennete < 7) return 3;
  if (bien.anciennete != null && bien.anciennete <= 30) return 2;
  return 1;
}

function normalizeAddress(address) {
  if (!address || typeof address !== "string") return null;

  const normalizedAddress = address.trim().toLowerCase();
  if (!normalizedAddress || normalizedAddress === "adresse non renseignee") {
    return null;
  }

  return normalizedAddress;
}

function buildCoordinateKey(bien) {
  if (bien.lat == null || bien.lon == null) return null;
  return `${Number(bien.lat).toFixed(6)}|${Number(bien.lon).toFixed(6)}`;
}

export function buildLabelGroupAssignments(biens) {
  const coordGroups = new Map();
  const addressGroups = new Map();

  biens.forEach((bien) => {
    const coordKey = buildCoordinateKey(bien);
    const addressKey = normalizeAddress(bien.adresse);

    if (coordKey) {
      if (!coordGroups.has(coordKey)) coordGroups.set(coordKey, []);
      coordGroups.get(coordKey).push(bien.id);
    }

    if (addressKey) {
      if (!addressGroups.has(addressKey)) addressGroups.set(addressKey, []);
      addressGroups.get(addressKey).push(bien.id);
    }
  });

  const finalGroups = new Map();

  biens.forEach((bien) => {
    const coordKey = buildCoordinateKey(bien);
    const addressKey = normalizeAddress(bien.adresse);
    const coordGroup = coordKey ? coordGroups.get(coordKey) ?? [] : [];
    const addressGroup = addressKey ? addressGroups.get(addressKey) ?? [] : [];

    let groupKey = `single:${bien.id}`;

    if (addressGroup.length > 1 || coordGroup.length > 1) {
      groupKey =
        addressGroup.length >= coordGroup.length
          ? `address:${addressKey}`
          : `coord:${coordKey}`;
    }

    if (!finalGroups.has(groupKey)) {
      finalGroups.set(groupKey, []);
    }

    finalGroups.get(groupKey).push(bien.id);
  });

  const assignments = new Map();

  finalGroups.forEach((bienIds) => {
    bienIds.forEach((bienId, index) => {
      assignments.set(bienId, {
        index,
        total: bienIds.length,
      });
    });
  });

  return assignments;
}

export function getMarkerLabelOffset(groupIndex) {
  const preset = LABEL_OFFSET_PRESETS[groupIndex % LABEL_OFFSET_PRESETS.length];
  const ring = Math.floor(groupIndex / LABEL_OFFSET_PRESETS.length);
  const extraDistance = ring * 16;

  return {
    x:
      preset.x === 0
        ? 0
        : preset.x + Math.sign(preset.x) * extraDistance,
    y:
      preset.y === 0
        ? 0
        : preset.y + Math.sign(preset.y) * extraDistance,
  };
}
