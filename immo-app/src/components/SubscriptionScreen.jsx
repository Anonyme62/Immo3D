export default function SubscriptionScreen({
  themeMode = "light",
  user = null,
  loading = false,
  error = "",
  notice = "",
  onStartCheckout,
  onOpenPortal,
  onRefreshStatus,
  onLogout,
}) {
  const subscriptionStatus = user?.subscription_status || "inactive";
  const hasStripeCustomer = !!user?.stripe_customer_id;
  const subscriptionStatusLabel = formatSubscriptionStatus(subscriptionStatus);

  return (
    <div
      style={{
        ...getThemeVariables(themeMode),
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          themeMode === "dark"
            ? "radial-gradient(circle at top, #16213a 0%, #0b1220 55%, #050814 100%)"
            : "radial-gradient(circle at top, #fff8ed 0%, #f4efe3 52%, #ece3d2 100%)",
        fontFamily: "Arial, sans-serif",
        padding: 24,
        color: "var(--text-primary)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--panel-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 28,
          padding: 32,
          boxShadow: "0 24px 80px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 10,
          }}
        >
          Acces securise
        </div>

        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 12,
          }}
        >
          Accede a Immo 3D avec l'abonnement mensuel a 9,99 EUR.
        </div>

        <div
          style={{
            fontSize: 15,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          Ton compte Yanport est bien reconnu, mais l'acces applicatif reste bloque tant que
          l'abonnement n'est pas actif. Le paiement, les renouvellements et la gestion de carte
          passent par Stripe, et le backend refuse toujours les routes metier sans abonnement
          valide.
        </div>

        <div
          style={{
            marginBottom: 20,
            padding: "14px 16px",
            borderRadius: 18,
            background: "var(--panel-muted-bg)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
            Offre active
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>9,99 EUR / mois</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Paiement securise, renouvellement automatique et gestion autonome depuis le portail
            client Stripe.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <InfoCard label="Compte" value={user?.yanport_username || "Inconnu"} />
          <InfoCard label="Statut" value={subscriptionStatusLabel} />
          <InfoCard label="Acces" value={hasStripeCustomer ? "Compte Stripe cree" : "Activation requise"} />
        </div>

        {error ? (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 14,
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 14,
              background: "#dcfce7",
              color: "#166534",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {notice}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          <button onClick={onStartCheckout} style={primaryButtonStyle}>
            {loading ? "Ouverture du paiement..." : "Activer mon abonnement"}
          </button>

          {hasStripeCustomer ? (
            <button onClick={onOpenPortal} style={secondaryButtonStyle}>
              Gerer mon abonnement
            </button>
          ) : null}

          <button onClick={onRefreshStatus} style={secondaryButtonStyle}>
            J'ai deja paye, verifier mon acces
          </button>

          <button onClick={onLogout} style={ghostButtonStyle}>
            Se deconnecter
          </button>
        </div>
      </div>
    </div>
  );
}

function formatSubscriptionStatus(status) {
  const normalizedStatus = (status || "").toLowerCase();

  if (normalizedStatus === "active") return "Actif";
  if (normalizedStatus === "trialing") return "Essai";
  if (normalizedStatus === "past_due") return "Paiement a regulariser";
  if (normalizedStatus === "canceled") return "Resilie";
  if (normalizedStatus === "unpaid") return "Impaye";
  return "Inactif";
}

function InfoCard({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid var(--border-color)",
        background: "var(--panel-muted-bg)",
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{value}</div>
    </div>
  );
}

const primaryButtonStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "none",
  background: "#111111",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid var(--border-color)",
  background: "var(--panel-muted-bg)",
  color: "var(--text-primary)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const ghostButtonStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "none",
  background: "transparent",
  color: "var(--text-secondary)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

function getThemeVariables(themeMode) {
  if (themeMode === "dark") {
    return {
      "--panel-bg": "rgba(17, 24, 39, 0.92)",
      "--panel-muted-bg": "rgba(15, 23, 42, 0.8)",
      "--border-color": "#243042",
      "--text-primary": "#f3f4f6",
      "--text-secondary": "#d1d5db",
      "--text-muted": "#94a3b8",
    };
  }

  return {
    "--panel-bg": "rgba(255, 255, 255, 0.92)",
    "--panel-muted-bg": "rgba(249, 250, 251, 0.95)",
    "--border-color": "#d8d1c5",
    "--text-primary": "#201a16",
    "--text-secondary": "#5a5248",
    "--text-muted": "#8c8377",
  };
}
