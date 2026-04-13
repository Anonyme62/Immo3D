import {
  formatPrix,
  formatSurface,
  getAnnonceLinks,
  getBienBadge,
  getSelectedBienPhotos,
} from "../utils/bienFormat";

export default function SelectedBienPanel({
  selectedBien,
  noteDraft,
  noteStatus,
  onNoteChange,
  onAddFavorite,
  onRemoveFavorite,
  onAddSetAside,
  onRemoveSetAside,
  onAddBlacklist,
  onRemoveBlacklist,
  onStartPlacingBien,
  onRemovePlacedBienMarker,
  isPlacingBien = false,
  isMobile = false,
}) {
  const photos = getSelectedBienPhotos(selectedBien);
  const annonceLinks = getAnnonceLinks(selectedBien);
  const selectedBienKey =
    selectedBien?.id ||
    selectedBien?.bien_id ||
    selectedBien?.id_bien ||
    selectedBien?.lien_yanport ||
    selectedBien?.lien_leboncoin ||
    selectedBien?.adresse ||
    "selected-bien";

  const canPlaceBienMarker =
    Boolean(selectedBien?.sans_adresse) ||
    Boolean(selectedBien?.placed_manually) ||
    isPlacingBien;
  const canOpenDirections = Boolean(buildDirectionsUrl(selectedBien));
  const displayAddress = formatDisplayAddress(selectedBien?.adresse);

  const placementButtonLabel = isPlacingBien
    ? "Annuler placement"
    : selectedBien?.placed_manually
      ? "Replacer le repere"
      : "Placer un repere";

  return (
    <div
      style={{
        width: isMobile ? "100%" : 380,
        height: isMobile ? "auto" : "100%",
        minHeight: 0,
        background: "var(--panel-bg)",
        borderLeft: isMobile ? "none" : "1px solid var(--border-color)",
        padding: isMobile ? 16 : 20,
        overflowY: "auto",
        boxSizing: "border-box",
        paddingBottom: isMobile ? 96 : 20,
      }}
    >
      {!selectedBien ? (
        <div style={{ color: "var(--text-muted)" }}>Selectionne un bien</div>
      ) : (
        <div key={selectedBienKey}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Bien selectionne
              </div>
            </div>

            {isMobile ? null : (
              <div
                style={{
                  ...getBienBadge(selectedBien).style,
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {getBienBadge(selectedBien).label}
              </div>
            )}
          </div>

          {photos.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <div
                key={`photos-${selectedBienKey}`}
                style={{
                  display: "flex",
                  gap: 10,
                  flexDirection: isMobile ? "row" : "column",
                  overflowX: isMobile ? "auto" : "visible",
                  paddingBottom: isMobile ? 4 : 0,
                }}
              >
                {photos.map((photo, index) => (
                  <img
                    key={`${selectedBienKey}-${photo}-${index}`}
                    src={photo}
                    alt={`Photo ${index + 1}`}
                    style={{
                      width: isMobile ? 260 : "100%",
                      minWidth: isMobile ? 260 : "auto",
                      borderRadius: 18,
                      display: "block",
                      border: "1px solid var(--border-color)",
                      marginBottom: isMobile ? 0 : 10,
                      objectFit: "cover",
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: isMobile ? 12 : 10,
              flexWrap: isMobile ? "wrap" : "nowrap",
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "stretch" : "center",
            }}
          >
            {selectedBien.favorite ? (
              <button
                onClick={onRemoveFavorite}
                style={panelActionButtonStyle("danger", isMobile)}
              >
                Retirer favori
              </button>
            ) : (
              <button
                onClick={onAddFavorite}
                style={panelActionButtonStyle("success", isMobile)}
              >
                Ajouter favori
              </button>
            )}

            {selectedBien.de_cote ? (
              <button
                onClick={onRemoveSetAside}
                style={panelActionButtonStyle("neutral", isMobile)}
              >
                Retirer de cote
              </button>
            ) : (
              <button
                onClick={onAddSetAside}
                style={panelActionButtonStyle("warning", isMobile)}
              >
                Mettre de cote
              </button>
            )}

            {selectedBien.blackliste ? (
              <button
                onClick={onRemoveBlacklist}
                style={panelActionButtonStyle("success", isMobile)}
              >
                Retirer blacklist
              </button>
            ) : (
              <button
                onClick={onAddBlacklist}
                style={panelActionButtonStyle("danger", isMobile)}
              >
                Blacklister
              </button>
            )}
          </div>

          <div
            style={{
              marginTop: 18,
              border: "1px solid var(--border-color)",
              borderRadius: 18,
              padding: 16,
              lineHeight: 1.8,
            }}
          >
            <div>
              <strong>Agence :</strong> {selectedBien.agence || "Non renseignee"}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <strong>Adresse :</strong>
              <span>{displayAddress}</span>
              {canPlaceBienMarker ? (
                <button
                  onClick={onStartPlacingBien}
                  style={panelActionButtonStyle("neutral", false, true)}
                >
                  {placementButtonLabel}
                </button>
              ) : null}
            </div>

            {canOpenDirections || selectedBien.placed_manually ? (
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {canOpenDirections ? (
                  <a
                    href={buildDirectionsUrl(selectedBien)}
                    target="_blank"
                    rel="noreferrer"
                    style={panelActionLinkStyle("neutral", isMobile)}
                  >
                    S'y rendre
                  </a>
                ) : null}

                {selectedBien.placed_manually ? (
                  <button
                    onClick={onRemovePlacedBienMarker}
                    style={panelActionButtonStyle("danger", isMobile, true)}
                  >
                    Supprimer le repere
                  </button>
                ) : null}
              </div>
            ) : null}

            <div>
              <strong>Prix :</strong> {formatPrix(selectedBien.prix)}
            </div>

            <div>
              <strong>Surface :</strong> {formatSurface(selectedBien.surface)}
            </div>

            <div>
              <strong>Anciennete :</strong>{" "}
              {selectedBien.anciennete !== null && selectedBien.anciennete !== undefined
                ? `${selectedBien.anciennete} jours`
                : "? jours"}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <textarea
              value={noteDraft}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Ajoute une note sur ce bien..."
              style={{
                width: "100%",
                minHeight: 110,
                borderRadius: 14,
                border: "1px solid var(--border-color)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                padding: 12,
                fontFamily: "Arial, sans-serif",
                fontSize: 14,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />

            {noteStatus ? (
              <div
                style={{
                  marginTop: 8,
                  color: noteStatus.includes("Erreur") ? "#991b1b" : "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                {noteStatus}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 18 }}>
            {annonceLinks.length === 0 ? (
              <div style={{ color: "var(--text-muted)" }}>Aucune annonce disponible</div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "row" : "column",
                  flexWrap: isMobile ? "wrap" : "nowrap",
                  gap: 8,
                }}
              >
                {annonceLinks.map((link) => (
                  <a
                    key={link.key}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--text-primary)",
                      textDecoration: "none",
                      fontWeight: 600,
                      border: isMobile ? "1px solid var(--border-color)" : "none",
                      borderRadius: isMobile ? 999 : 0,
                      padding: isMobile ? "9px 12px" : 0,
                      background: isMobile ? "var(--panel-bg)" : "transparent",
                    }}
                  >
                    Lien {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

function panelActionButtonStyle(tone = "neutral", isMobile = false, compact = false) {
  const tones = {
    neutral: {
      background: "var(--panel-subtle)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-color)",
    },
    success: {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    },
    warning: {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    },
    danger: {
      background: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    },
  };

  const palette = tones[tone] || tones.neutral;

  return {
    width: isMobile ? "100%" : "auto",
    padding: compact
      ? isMobile
        ? "10px 12px"
        : "8px 12px"
      : isMobile
        ? "12px 14px"
        : "10px 14px",
    borderRadius: 14,
    border: palette.border,
    background: palette.background,
    color: palette.color,
    fontWeight: 700,
    fontSize: isMobile ? 14 : compact ? 13 : 13,
    lineHeight: 1.2,
    cursor: "pointer",
    whiteSpace: isMobile ? "normal" : "nowrap",
    flexShrink: 0,
    textAlign: "center",
    boxSizing: "border-box",
  };
}

function panelActionLinkStyle(tone = "neutral", isMobile = false, compact = false) {
  return {
    ...panelActionButtonStyle(tone, isMobile, compact),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
  };
}

function buildDirectionsUrl(selectedBien) {
  if (!selectedBien) return "";

  const latitude = selectedBien.lat;
  const longitude = selectedBien.lon;
  const address = (selectedBien.adresse || "").trim();
  const destination =
    latitude != null && longitude != null
      ? `${latitude},${longitude}`
      : address;

  if (!destination) return "";

  if (isAppleMobileDevice()) {
    return `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}&dirflg=d`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

function formatDisplayAddress(address) {
  const trimmedAddress = (address || "").trim();
  if (!trimmedAddress) return "";

  return trimmedAddress
    .replace(/,\s*(\d{5})\s+([A-Za-zÀ-ÿ' -]+)$/u, ", $2")
    .replace(/\s+(\d{5})\s+([A-Za-zÀ-ÿ' -]+)$/u, " $2")
    .trim();
}

function isAppleMobileDevice() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}
