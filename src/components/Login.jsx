const C = {
  bg: "#0A0E1A",
  surface: "#111827",
  border: "#1E2D45",
  accent: "#1D6FE8",
  accentLight: "#3B8AF0",
  accentGlow: "rgba(29,111,232,0.18)",
  gold: "#F59E0B",
  text: "#F1F5F9",
  textMuted: "#64748B",
  textSub: "#94A3B8",
};

export default function Login({ onLogin, loading }) {
  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", padding: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap');
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .login-btn:hover { opacity: 0.88; transform: scale(0.98); }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 420, textAlign: "center",
        animation: "fadeIn 0.5s ease",
      }}>
        {/* Logo */}
        <div style={{
          width: 90, height: 90, borderRadius: "50%", margin: "0 auto 24px",
          background: `linear-gradient(135deg, ${C.accent}, ${C.gold})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, boxShadow: `0 0 40px ${C.accentGlow}`,
          animation: "float 3s ease-in-out infinite",
        }}>🛡️</div>

        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 28, fontWeight: 700, color: C.text,
          marginBottom: 8,
        }}>AutoShield</h1>

        <p style={{ color: C.textSub, fontSize: 15, marginBottom: 8 }}>
          Assistente Virtual de Seguros
        </p>

        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 40 }}>
          Tire suas dúvidas sobre sinistros, apólices,<br />coberturas e muito mais com IA.
        </p>

        {/* Card */}
        <div style={{
          background: "#111827",
          border: `1px solid ${C.border}`,
          borderRadius: 20, padding: "32px 28px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}>
          <p style={{ color: C.textSub, fontSize: 14, marginBottom: 24 }}>
            Faça login para acessar o atendimento personalizado
          </p>

          <button
            className="login-btn"
            onClick={onLogin}
            disabled={loading}
            style={{
              width: "100%", padding: "14px 20px",
              borderRadius: 12, border: "none",
              background: loading ? C.border : `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`,
              color: "#fff", fontSize: 15, fontWeight: 600,
              fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              transition: "all 0.2s",
              boxShadow: loading ? "none" : `0 4px 20px rgba(29,111,232,0.4)`,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="rgba(255,255,255,0.8)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="rgba(255,255,255,0.6)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="rgba(255,255,255,0.9)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? "Entrando..." : "Entrar com Google"}
          </button>

          <p style={{ color: C.textMuted, fontSize: 11, marginTop: 20, lineHeight: 1.5 }}>
            Seus dados de conversa são salvos com segurança<br />para melhorar o atendimento via IA.
          </p>
        </div>

        <p style={{ color: C.textMuted, fontSize: 11, marginTop: 20 }}>
          AutoShield Seguros · SUSEP 12345
        </p>
      </div>
    </div>
  );
}
