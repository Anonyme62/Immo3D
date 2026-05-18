const LABEL_OFFSET_PRESETS = [
  { x: 0, y: -20 },
  { x: -20, y: -8 },
  { x: 20, y: -8 },
  { x: 0, y: 14 },
  { x: -18, y: -20 },
  { x: 18, y: -20 },
  { x: 24, y: 10 },
  { x: -24, y: 10 },
];

export function buildMarkerEntityId(bienId, index) {
  return `bien-marker-${String(bienId)}-${index}`;
}

function getMarkerAgeColor(bien) {
  if (bien.anciennete != null && bien.anciennete < 7) return "green";
  if (bien.anciennete != null && bien.anciennete <= 30) return "orange";
  return "red";
}

function getMarkerPixelSizeForColor(color) {
  if (color === "green") return 14;
  if (color === "orange") return 12;
  return 10;
}

export function getMarkerVisualState(bien, selectedBienId) {
  void selectedBienId;
  const ageColor = getMarkerAgeColor(bien);
  const basePixelSize = getMarkerPixelSizeForColor(ageColor);

  return {
    isSelected: false,
    pixelSize: basePixelSize,
    color: ageColor,
    outlineWidth: 2,
    font: "26px sans-serif",
  };
}

export function getMarkerRenderPriority(bien, selectedBienId) {
  void selectedBienId;
  return bien.anciennete != null && bien.anciennete < 7
    ? 3
    : bien.anciennete != null && bien.anciennete <= 30
      ? 2
      : 1;
}

export function compareMarkerRenderOrder(a, b, selectedBienId) {
  const priorityDelta =
    getMarkerRenderPriority(a, selectedBienId) -
    getMarkerRenderPriority(b, selectedBienId);
  if (priorityDelta !== 0) return priorityDelta;

  const aId = String(a.id ?? "");
  const bId = String(b.id ?? "");
  return aId.localeCompare(bId, "fr");
}

export function buildAddressAnchorAssignments(biens, selectedBienId = null) {
  const addressGroups = new Map();

  biens.forEach((bien) => {
    const addressKey = normalizeAddress(bien.adresse);
    if (!addressKey) return;

    if (!addressGroups.has(addressKey)) {
      addressGroups.set(addressKey, []);
    }
    addressGroups.get(addressKey).push(bien);
  });

  const assignments = new Map();
  addressGroups.forEach((groupBiens) => {
    if (groupBiens.length < 2) return;

    const ordered = [...groupBiens].sort((a, b) =>
      compareMarkerRenderOrder(b, a, selectedBienId)
    );
    const anchorId = ordered[0].id;

    ordered.forEach((bien) => {
      assignments.set(bien.id, anchorId);
    });
  });

  return assignments;
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

export function buildCoordinateStackAssignments(biens, selectedBienId = null) {
  const coordGroups = new Map();
  const addressGroups = new Map();

  biens.forEach((bien) => {
    const coordKey = buildCoordinateKey(bien);
    const addressKey = normalizeAddress(bien.adresse);
    if (!coordKey) return;
    if (!coordGroups.has(coordKey)) coordGroups.set(coordKey, []);
    coordGroups.get(coordKey).push(bien);

    if (addressKey) {
      if (!addressGroups.has(addressKey)) addressGroups.set(addressKey, []);
      addressGroups.get(addressKey).push(bien);
    }
  });

  const finalGroups = new Map();

  biens.forEach((bien) => {
    const coordKey = buildCoordinateKey(bien);
    if (!coordKey) return;

    const addressKey = normalizeAddress(bien.adresse);
    const coordGroup = coordGroups.get(coordKey) ?? [];
    const addressGroup = addressKey ? addressGroups.get(addressKey) ?? [] : [];
    const useAddressGroup = addressGroup.length > coordGroup.length;
    const groupKey = useAddressGroup
      ? `address:${addressKey}`
      : `coord:${coordKey}`;

    if (!finalGroups.has(groupKey)) finalGroups.set(groupKey, []);
    finalGroups.get(groupKey).push(bien);
  });

  const assignments = new Map();

  finalGroups.forEach((groupBiens) => {
    const ordered = [...groupBiens].sort((a, b) =>
      compareMarkerRenderOrder(b, a, selectedBienId)
    );

    ordered.forEach((bien, index) => {
      assignments.set(bien.id, {
        index,
        total: ordered.length,
      });
    });
  });

  return assignments;
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
  const extraDistance = ring * 5;

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
