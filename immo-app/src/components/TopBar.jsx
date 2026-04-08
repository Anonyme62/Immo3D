export default function TopBar({ onLogout }) {
  return (
    <div
      style={{
        minHeight: 88,
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "0 24px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          Vue 3D photorealiste
        </div>
        <div style={{ fontWeight: 700, marginTop: 6, fontSize: 18 }}>
          Immo 3D cree par Alexis Ramez
        </div>
      </div>

      <button onClick={onLogout} style={topButtonStyle()}>
        Deconnexion
      </button>
    </div>
  );
}

function topButtonStyle() {
  return {
    padding: "10px 16px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  };
}
