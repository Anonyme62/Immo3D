import { useEffect, useState } from "react";

export default function AppMenu({
  onLogout,
  onExportKml,
  onOpenSettings,
  showBoundary = false,
  onToggleBoundary,
  themeMode = "light",
  onToggleTheme,
  styleMode = "default",
  onChangeStyle,
  hapticsEnabled = true,
  onToggleHaptics,
  onMenuOpenChange,
  isMobile = false,
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [styleSelectValue, setStyleSelectValue] = useState(styleMode);

  useEffect(() => {
    setStyleSelectValue(styleMode);
  }, [styleMode]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    onMenuOpenChange?.(isOpen);
  }, [isOpen, onMenuOpenChange]);

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setShowPreferences(false);
        }}
        style={menuButtonStyle(compact)}
        title="Ouvrir le menu"
        aria-label="Ouvrir le menu"
      >
        <HamburgerIcon />
      </button>
      <span
        style={{
          marginLeft: 10,
          fontWeight: 700,
          fontSize: compact ? 15 : 16,
          color: "var(--text-primary)",
          userSelect: "none",
        }}
      >
        Immo3D
      </span>

      {isOpen ? (
        <div onClick={() => setIsOpen(false)} style={overlayStyle()}>
          <aside
            onClick={(event) => event.stopPropagation()}
            style={drawerStyle(isMobile, themeMode)}
          >
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
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                  }}
                >
                  Vue 3D photorealiste
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: isMobile ? 20 : 22,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  Immo 3D
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                style={closeButtonStyle()}
                title="Fermer le menu"
                aria-label="Fermer le menu"
              >
                x
              </button>
            </div>

            <div
              style={{
                marginTop: 26,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                gap: 12,
              }}
            >
              <button
                onClick={() => {
                  setShowPreferences((value) => !value);
                }}
                style={drawerActionButtonStyle()}
              >
                Preferences
              </button>

              {showPreferences ? (
                <div style={stylePickerStyle()}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 1.2,
                      marginBottom: 10,
                    }}
                  >
                    Affichage
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <button
                      onClick={() => onToggleBoundary?.()}
                      style={drawerActionButtonStyle("compact")}
                    >
                      {showBoundary ? "Masquer bordure" : "Afficher bordure"}
                    </button>
                    <button
                      onClick={() => onToggleTheme?.()}
                      style={drawerActionButtonStyle("compact")}
                    >
                      {themeMode === "dark" ? "Mode clair" : "Mode sombre"}
                    </button>
                    {isMobile ? (
                      <button
                        onClick={() => onToggleHaptics?.()}
                        style={drawerActionButtonStyle("compact")}
                      >
                        {hapticsEnabled ? "Retour haptique actif" : "Retour haptique inactif"}
                      </button>
                    ) : null}
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 1.2,
                      marginBottom: 10,
                    }}
                  >
                    Style
                  </div>
                  <select
                    value={styleSelectValue}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setStyleSelectValue(nextValue);
                      onChangeStyle?.(nextValue);
                    }}
                    style={styleSelectStyle()}
                  >
                    {STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                </div>
              ) : null}

              <button
                onClick={() => {
                  setIsOpen(false);
                  onExportKml?.();
                }}
                style={drawerActionButtonStyle()}
              >
                Export KML
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                style={drawerActionButtonStyle()}
              >
                Deconnexion
              </button>

              <div style={{ flex: 1 }} />

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings?.();
                }}
                style={drawerActionButtonStyle()}
                title="Parametres"
                aria-label="Parametres"
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <GearIcon />
                  <span>Parametres</span>
                </span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

const STYLE_OPTIONS = [
  { value: "default", label: "Classique" },
  { value: "editorial", label: "Editorial" },
  { value: "luxury", label: "Luxury Noir" },
  { value: "heritage", label: "Heritage" },
  { value: "glass", label: "Glass" },
];

function HamburgerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 15A1 1 0 0 0 19.6 16.1L19.7 16.2A1.2 1.2 0 0 1 19.7 17.9L17.9 19.7A1.2 1.2 0 0 1 16.2 19.7L16.1 19.6A1 1 0 0 0 15 19.4A1 1 0 0 0 14.4 20.3V20.6A1.2 1.2 0 0 1 13.2 21.8H10.8A1.2 1.2 0 0 1 9.6 20.6V20.4A1 1 0 0 0 9 19.5A1 1 0 0 0 7.9 19.7L7.8 19.8A1.2 1.2 0 0 1 6.1 19.8L4.3 18A1.2 1.2 0 0 1 4.3 16.3L4.4 16.2A1 1 0 0 0 4.6 15.1A1 1 0 0 0 3.7 14.5H3.4A1.2 1.2 0 0 1 2.2 13.3V10.7A1.2 1.2 0 0 1 3.4 9.5H3.6A1 1 0 0 0 4.5 8.9A1 1 0 0 0 4.3 7.8L4.2 7.7A1.2 1.2 0 0 1 4.2 6L6 4.2A1.2 1.2 0 0 1 7.7 4.2L7.8 4.3A1 1 0 0 0 8.9 4.5A1 1 0 0 0 9.5 3.6V3.4A1.2 1.2 0 0 1 10.7 2.2H13.3A1.2 1.2 0 0 1 14.5 3.4V3.6A1 1 0 0 0 15.1 4.5A1 1 0 0 0 16.2 4.3L16.3 4.2A1.2 1.2 0 0 1 18 4.2L19.8 6A1.2 1.2 0 0 1 19.8 7.7L19.7 7.8A1 1 0 0 0 19.5 8.9A1 1 0 0 0 20.4 9.5H20.6A1.2 1.2 0 0 1 21.8 10.7V13.3A1.2 1.2 0 0 1 20.6 14.5H20.3A1 1 0 0 0 19.4 15Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function menuButtonStyle(compact) {
  return {
    width: compact ? 40 : 44,
    height: compact ? 40 : 44,
    borderRadius: 999,
    border: "1px solid var(--border-color)",
    background: "var(--panel-bg)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "var(--text-primary)",
    boxShadow: "0 8px 24px rgba(17, 24, 39, 0.08)",
    padding: 0,
  };
}

function overlayStyle() {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(17, 24, 39, 0.28)",
    zIndex: 140,
  };
}

function drawerStyle(isMobile) {
  const desktopWidth = 340;
  const mobileWidth = "50vw";

  return {
    width: isMobile ? mobileWidth : desktopWidth,
    height: "100%",
    background: "var(--panel-bg)",
    boxShadow: "18px 0 48px rgba(17, 24, 39, 0.18)",
    padding: isMobile ? "20px 18px" : "24px 22px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
  };
}

function closeButtonStyle() {
  return {
    width: 38,
    height: 38,
    borderRadius: 999,
    border: "1px solid var(--border-color)",
    background: "var(--panel-bg)",
    color: "var(--text-primary)",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
  };
}

function drawerActionButtonStyle(variant = "default") {
  const compact = variant === "compact";
  return {
    width: "100%",
    padding: compact ? "10px 12px" : "13px 16px",
    borderRadius: 16,
    border: "1px solid var(--border-color)",
    background: compact ? "var(--panel-muted-bg)" : "var(--panel-bg)",
    color: "var(--text-primary)",
    textAlign: "left",
    fontWeight: 600,
    cursor: "pointer",
  };
}

function stylePickerStyle() {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid var(--border-color)",
    background: "var(--panel-bg)",
    boxSizing: "border-box",
  };
}

function styleSelectStyle() {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border-color)",
    background: "var(--panel-bg)",
    color: "var(--text-primary)",
    fontWeight: 600,
    cursor: "pointer",
    boxSizing: "border-box",
  };
}
