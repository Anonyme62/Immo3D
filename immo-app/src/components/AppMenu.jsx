import { useEffect, useState } from "react";

export default function AppMenu({
  onLogout,
  onExportKml,
  themeMode = "light",
  onToggleTheme,
  isMobile = false,
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={menuButtonStyle(compact)}
        title="Ouvrir le menu"
        aria-label="Ouvrir le menu"
      >
        <HamburgerIcon />
      </button>

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
                gap: 12,
              }}
            >
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
                  onToggleTheme?.();
                }}
                style={drawerActionButtonStyle()}
              >
                {themeMode === "dark" ? "Mode clair" : "Mode sombre"}
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
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

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
  return {
    width: isMobile ? "min(86vw, 320px)" : 320,
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

function drawerActionButtonStyle() {
  return {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 16,
    border: "1px solid var(--border-color)",
    background: "var(--panel-bg)",
    color: "var(--text-primary)",
    textAlign: "left",
    fontWeight: 600,
    cursor: "pointer",
  };
}
