import { useState } from "react";
import {
  formatPrix,
  formatSurface,
  getAnnonceLinks,
  getBienBadge,
  getSelectedBienPhotos,
} from "../utils/bienFormat";
import { uploadPhotoAsset } from "../api";

const MAX_NOTE_PHOTOS = 8;
const MAX_NOTE_PHOTO_DATA_URL_LENGTH = 1_200_000;
const NOTE_PHOTO_MAX_DIMENSION_STEPS = [1920, 1600, 1280, 1024, 800, 640];
const NOTE_PHOTO_QUALITY_STEPS = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46];

export default function SelectedBienPanel({
  selectedBien,
  noteDraft,
  notePhotos = [],
  noteStatus,
  onNoteChange,
  onNotePhotosChange,
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
  const [notePhotoError, setNotePhotoError] = useState("");
  const [pendingNotePhotoPreviews, setPendingNotePhotoPreviews] = useState([]);
  const photos = getSelectedBienPhotos(selectedBien);
  const annonceLinks = getAnnonceLinks(selectedBien);
  const safeNotePhotos = Array.isArray(notePhotos) ? notePhotos : [];
  const selectedBienKey =
    selectedBien?.id ||
    selectedBien?.bien_id ||
    selectedBien?.id_bien ||
    selectedBien?.lien_yanport ||
    selectedBien?.lien_leboncoin ||
    selectedBien?.adresse ||
    "selected-bien";
  const photosBlock = photos.length > 0 ? (
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
  ) : null;

  const canPlaceBienMarker =
    Boolean(selectedBien?.sans_adresse) ||
    Boolean(selectedBien?.placed_manually) ||
    isPlacingBien;
  const canOpenDirections = Boolean(buildDirectionsUrl(selectedBien));
  const directionsTarget = isMobile ? "_self" : "_blank";
  const displayAddress = formatDisplayAddress(selectedBien?.adresse);

  const placementButtonLabel = isPlacingBien
    ? "Annuler placement"
    : selectedBien?.placed_manually
      ? "Replacer le repere"
      : "Placer un repere";

  const handleNotePhotoInputChange = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";
    setNotePhotoError("");

    if (!selectedFiles.length) return;

    const availableSlots = Math.max(
      0,
      MAX_NOTE_PHOTOS - safeNotePhotos.length - pendingNotePhotoPreviews.length
    );
    if (availableSlots <= 0) {
      setNotePhotoError("Maximum 8 photos atteint pour cette note.");
      return;
    }

    const filesToEncode = selectedFiles.slice(0, availableSlots);
    const stagedPreviews = filesToEncode.map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setPendingNotePhotoPreviews((prev) => [...prev, ...stagedPreviews]);

    let nextPersistedPhotos = [...safeNotePhotos];
    let hasFailure = false;

    for (const preview of stagedPreviews) {
      try {
        const storedPhotoReference = await convertFileToStoredReference(preview.file);
        nextPersistedPhotos = [...nextPersistedPhotos, storedPhotoReference].slice(0, MAX_NOTE_PHOTOS);
        onNotePhotosChange?.(nextPersistedPhotos);
      } catch (error) {
        hasFailure = true;
        console.error("Erreur ajout photo note bien :", error);
      } finally {
        setPendingNotePhotoPreviews((prev) => prev.filter((item) => item.id !== preview.id));
        URL.revokeObjectURL(preview.url);
      }
    }

    if (hasFailure) {
      setNotePhotoError("Une ou plusieurs photos n'ont pas pu etre chargees.");
    }
  };

  const removeNotePhoto = (photoIndex) => {
    const nextPhotos = safeNotePhotos.filter((_, index) => index !== photoIndex);
    setNotePhotoError("");
    onNotePhotosChange?.(nextPhotos);
  };

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

          {isMobile ? photosBlock : null}

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
            <div style={bienInfoRowStyle()}>
              <strong style={bienInfoLabelStyle()}>Agence :</strong>
              <span
                title={selectedBien.agence || "Non renseignee"}
                style={bienInfoValueStyle()}
              >
                {selectedBien.agence || "Non renseignee"}
              </span>
            </div>

            <div style={bienInfoRowStyle()}>
              <strong style={bienInfoLabelStyle()}>Adresse :</strong>
              <span title={displayAddress} style={bienInfoValueStyle()}>
                {displayAddress || "Non renseignee"}
              </span>
            </div>

            {canPlaceBienMarker ? (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={onStartPlacingBien}
                  style={panelActionButtonStyle("neutral", isMobile, true)}
                >
                  {placementButtonLabel}
                </button>
              </div>
            ) : null}

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
                    target={directionsTarget}
                    rel={isMobile ? undefined : "noreferrer"}
                    style={directionsButtonStyle(isMobile)}
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

            <div style={bienInfoRowStyle()}>
              <strong style={bienInfoLabelStyle()}>Prix :</strong>
              <span style={bienInfoValueStyle()}>{formatPrix(selectedBien.prix)}</span>
            </div>

            <div style={bienInfoRowStyle()}>
              <strong style={bienInfoLabelStyle()}>Surface :</strong>
              <span style={bienInfoValueStyle()}>{formatSurface(selectedBien.surface)}</span>
            </div>

            <div style={bienInfoRowStyle()}>
              <strong style={bienInfoLabelStyle()}>Anciennete :</strong>
              <span style={bienInfoValueStyle()}>
                {selectedBien.anciennete !== null && selectedBien.anciennete !== undefined
                  ? `${selectedBien.anciennete} jours`
                  : "? jours"}
              </span>
            </div>
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

          <div style={{ marginTop: 12 }}>
            {isMobile ? (
              <div style={mobilePhotoButtonsRowStyle()}>
                <label style={notePhotoUploadButtonStyle()}>
                  Prendre photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleNotePhotoInputChange}
                    style={{ display: "none" }}
                  />
                </label>
                <label style={notePhotoUploadButtonStyle()}>
                  Ajouter photo
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleNotePhotoInputChange}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            ) : (
              <label style={notePhotoUploadButtonStyle()}>
                Ajouter photo
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleNotePhotoInputChange}
                  style={{ display: "none" }}
                />
              </label>
            )}
            {safeNotePhotos.length > 0 || pendingNotePhotoPreviews.length > 0 ? (
              <div style={notePhotoGridStyle(isMobile)}>
                {safeNotePhotos.map((photo, index) => (
                  <div key={`note-photo-${index}`} style={{ position: "relative" }}>
                    <img
                      src={photo}
                      alt={`Photo note ${index + 1}`}
                      style={notePhotoPreviewStyle()}
                    />
                    <button
                      type="button"
                      onClick={() => removeNotePhoto(index)}
                      style={notePhotoRemoveButtonStyle()}
                    >
                      x
                    </button>
                  </div>
                ))}
                {pendingNotePhotoPreviews.map((preview) => (
                  <div
                    key={preview.id}
                    style={{
                      position: "relative",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <img
                      src={preview.url}
                      alt="Photo en cours de traitement"
                      style={{
                        ...notePhotoPreviewStyle(),
                        opacity: 0.6,
                        filter: "blur(0.4px)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: "auto 6px 6px 6px",
                        background: "rgba(17, 24, 39, 0.74)",
                        color: "#f9fafb",
                        borderRadius: 8,
                        padding: "3px 6px",
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      Traitement...
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {notePhotoError ? (
              <div style={{ marginTop: 8, color: "#991b1b", fontSize: 13 }}>
                {notePhotoError}
              </div>
            ) : null}
          </div>

          {!isMobile ? photosBlock : null}

        </div>
      )}
    </div>
  );
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de charger cette photo."));
    image.src = dataUrl;
  });
}

function tryCompressNotePhoto(imageElement) {
  const sourceWidth = Math.max(1, imageElement.naturalWidth || imageElement.width || 1);
  const sourceHeight = Math.max(1, imageElement.naturalHeight || imageElement.height || 1);
  const preferredMimeTypes = ["image/webp", "image/jpeg"];

  for (const maxDimension of NOTE_PHOTO_MAX_DIMENSION_STEPS) {
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) break;
    context.drawImage(imageElement, 0, 0, width, height);

    for (const mimeType of preferredMimeTypes) {
      for (const quality of NOTE_PHOTO_QUALITY_STEPS) {
        const compressedDataUrl = canvas.toDataURL(mimeType, quality);
        if (compressedDataUrl.length <= MAX_NOTE_PHOTO_DATA_URL_LENGTH) {
          return compressedDataUrl;
        }
      }
    }
  }
  return null;
}

async function convertFileToDataUrl(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  if (originalDataUrl.length <= MAX_NOTE_PHOTO_DATA_URL_LENGTH) {
    return originalDataUrl;
  }

  const imageElement = await loadImageElement(originalDataUrl);
  const compressedDataUrl = tryCompressNotePhoto(imageElement);
  if (compressedDataUrl) {
    return compressedDataUrl;
  }

  throw new Error(
    "Photo trop volumineuse. Essaie une photo plus legere ou recadree."
  );
}

async function convertFileToStoredReference(file) {
  const dataUrl = await convertFileToDataUrl(file);
  const uploadFile = dataUrlToUploadFile(dataUrl, file?.name || "note-photo");
  try {
    return await uploadPhotoAsset(uploadFile, "note");
  } catch (error) {
    console.warn("Upload objet indisponible (note), fallback data URL.", error);
    return dataUrl;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Impossible de lire cette photo."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToUploadFile(dataUrl, originalFileName = "photo") {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Format de photo encodee invalide.");
  }

  const mimeType = match[1] || "image/jpeg";
  const base64Body = match[2] || "";
  const binary = window.atob(base64Body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const safeName = buildUploadFileName(originalFileName, mimeType);
  return new File([bytes], safeName, { type: mimeType });
}

function buildUploadFileName(originalFileName, mimeType) {
  const baseName = String(originalFileName || "photo").trim() || "photo";
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const extensionByMime = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/gif": ".gif",
  };
  const normalizedMimeType = String(mimeType || "").toLowerCase();
  const wantedExtension = extensionByMime[normalizedMimeType] || ".jpg";

  if (safeBaseName.toLowerCase().endsWith(wantedExtension)) {
    return safeBaseName;
  }
  return `${safeBaseName}${wantedExtension}`;
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

function notePhotoUploadButtonStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--border-color)",
    background: "var(--panel-subtle)",
    color: "var(--text-primary)",
    fontWeight: 700,
    whiteSpace: "nowrap",
    cursor: "pointer",
    boxSizing: "border-box",
    minWidth: 0,
  };
}

function mobilePhotoButtonsRowStyle() {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  };
}

function notePhotoGridStyle(isMobile) {
  return {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
    gap: 8,
  };
}

function notePhotoPreviewStyle() {
  return {
    width: "100%",
    height: 90,
    borderRadius: 10,
    objectFit: "cover",
    display: "block",
    border: "1px solid var(--border-color)",
  };
}

function notePhotoRemoveButtonStyle() {
  return {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    border: "none",
    borderRadius: "50%",
    background: "rgba(127, 29, 29, 0.92)",
    color: "#fee2e2",
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
  };
}

function bienInfoRowStyle() {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    flexWrap: "nowrap",
  };
}

function bienInfoLabelStyle() {
  return {
    flexShrink: 0,
    whiteSpace: "nowrap",
  };
}

function bienInfoValueStyle() {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function directionsButtonStyle(isMobile = false) {
  return {
    ...panelActionLinkStyle("neutral", isMobile),
    borderRadius: 999,
    padding: isMobile ? "10px 14px" : "9px 14px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(245,247,250,0.9) 100%)",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    boxShadow:
      "0 8px 20px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.72)",
    color: "#1f2937",
    letterSpacing: 0.2,
    backdropFilter: "blur(6px)",
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

  if (isMobileDevice()) {
    if (isAppleMobileDevice()) {
      return `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}&dirflg=d`;
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

function formatDisplayAddress(address) {
  const trimmedAddress = (address || "").trim();
  if (!trimmedAddress) return "";

  return trimmedAddress
    .replace(/\b\d{5}\b/g, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*$/g, "")
    .trim();
}
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  return (
    /iPhone|iPad|iPod|Android/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
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



