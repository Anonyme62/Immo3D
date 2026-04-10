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
                style={topActionButtonStyle(undefined, undefined, undefined, false, isMobile)}
              >
                Retirer favori
              </button>
            ) : (
              <button
                onClick={onAddFavorite}
                style={topActionButtonStyle(undefined, undefined, undefined, false, isMobile)}
              >
                Ajouter favori
              </button>
            )}

            {selectedBien.de_cote ? (
              <button
                onClick={onRemoveSetAside}
                style={topActionButtonStyle("#92400e", "#ffffff", "none", false, isMobile)}
              >
                Retirer de cote
              </button>
            ) : (
              <button
                onClick={onAddSetAside}
                style={topActionButtonStyle("#f59e0b", "#111827", "none", false, isMobile)}
              >
                Mettre de cote
              </button>
            )}

            {selectedBien.blackliste ? (
              <button
                onClick={onRemoveBlacklist}
                style={topActionButtonStyle("#065f46", "#ffffff", "none", false, isMobile)}
              >
                Retirer blacklist
              </button>
            ) : (
              <button
                onClick={onAddBlacklist}
                style={topActionButtonStyle("#b91c1c", "#ffffff", "none", false, isMobile)}
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

            <div>
              <strong>Adresse :</strong>{" "}
              {selectedBien.adresse && selectedBien.adresse.trim() !== ""
                ? selectedBien.adresse
                : ""}
              {canPlaceBienMarker ? (
                <button
                  onClick={onStartPlacingBien}
                  style={{
                    marginLeft: 6,
                    padding: "1px 8px",
                    borderRadius: 999,
                    border: "1px solid var(--border-color)",
                    background: "var(--panel-subtle)",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    fontSize: 13,
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  {placementButtonLabel}
                </button>
              ) : null}
              {selectedBien.placed_manually ? (
                <button
                  onClick={onRemovePlacedBienMarker}
                  style={{
                    marginLeft: 6,
                    padding: "1px 8px",
                    borderRadius: 999,
                    border: "1px solid #7f1d1d",
                    background: "#991b1b",
                    color: "white",
                    fontWeight: 600,
                    fontSize: 13,
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  Supprimer le repere
                </button>
              ) : null}
            </div>

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

          {photos.length > 0 ? (
            <div style={{ marginTop: 18 }}>
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

        </div>
      )}
    </div>
  );
}

function topActionButtonStyle(
  background = "var(--panel-subtle)",
  color = "var(--text-primary)",
  border = "1px solid var(--border-color)",
  compact = false,
  isMobile = false
) {
  return {
    width: isMobile ? "100%" : "auto",
    padding: isMobile ? "12px 14px" : compact ? "4px 14px" : "6px 12px",
    borderRadius: 999,
    border,
    background,
    color,
    fontWeight: 700,
    fontSize: isMobile ? 14 : compact ? 13 : 12,
    lineHeight: compact ? 1.05 : 1.1,
    cursor: "pointer",
    whiteSpace: isMobile ? "normal" : "nowrap",
    flexShrink: 0,
    textAlign: "center",
  };
}
