export default function LoginScreen({
  themeMode = "light",
  loginEmail,
  loginPassword,
  loginError,
  loginLoading,
  rememberMe,
  onEmailChange,
  onPasswordChange,
  onRememberMeChange,
  onSubmit,
}) {
  return (
    <div
      style={{
        ...getThemeVariables(themeMode),
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--app-bg)",
        fontFamily: "Arial, sans-serif",
        padding: 24,
        color: "var(--text-primary)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--panel-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 28,
          padding: 28,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 8,
            color: "var(--text-primary)",
          }}
        >
          Immo 3D
        </div>

        <div
          style={{
            fontSize: 14,
            color: "var(--text-muted)",
            marginBottom: 22,
          }}
        >
          Connecte-toi a Immo 3D avec tes identifiants Yanport.
        </div>

        <input
          value={loginEmail}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="Identifiant Yanport"
          style={inputStyle}
        />

        <input
          type="password"
          value={loginPassword}
          onChange={(event) => onPasswordChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit();
          }}
          placeholder="Mot de passe"
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        {loginError ? (
          <div
            style={{
              marginBottom: 12,
              color: "#b91c1c",
              fontSize: 14,
            }}
          >
            {loginError}
          </div>
        ) : null}

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
            fontSize: 14,
          color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => onRememberMeChange(event.target.checked)}
          />
          Se souvenir de moi
        </label>

        <button onClick={onSubmit} style={primaryButtonStyle}>
          {loginLoading ? "Connexion..." : "Se connecter"}
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  marginBottom: 12,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid var(--border-color)",
  background: "var(--input-bg)",
  color: "var(--text-primary)",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const primaryButtonStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "none",
  background: "#111111",
  color: "white",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

function getThemeVariables(themeMode) {
  if (themeMode === "dark") {
    return {
      "--app-bg": "#0b1220",
      "--panel-bg": "#111827",
      "--border-color": "#243042",
      "--text-primary": "#f3f4f6",
      "--text-secondary": "#d1d5db",
      "--text-muted": "#94a3b8",
      "--input-bg": "#0f172a",
    };
  }

  return {
    "--app-bg": "#f5f5f5",
    "--panel-bg": "#ffffff",
    "--border-color": "#d1d5db",
    "--text-primary": "#111827",
    "--text-secondary": "#374151",
    "--text-muted": "#6b7280",
    "--input-bg": "#ffffff",
  };
}
