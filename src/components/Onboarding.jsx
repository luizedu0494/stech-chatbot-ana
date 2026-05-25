import { useState } from "react";
import {
  verificarCpfDuplicado,
  verificarPlacaDuplicada,
  salvarOnboarding,
} from "../services/firestoreService";

const C = {
  bg: "#0A0E1A",
  surface: "#111827",
  surfaceElevated: "#1A2235",
  border: "#1E2D45",
  accent: "#1D6FE8",
  accentLight: "#3B8AF0",
  accentGlow: "rgba(29,111,232,0.18)",
  gold: "#F59E0B",
  text: "#F1F5F9",
  textMuted: "#64748B",
  textSub: "#94A3B8",
  error: "#EF4444",
  success: "#10B981",
};

// Formata CPF: 000.000.000-00
function formatarCPF(valor) {
  return valor
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

// Formata Placa: ABC-1234 ou ABC1D23 (Mercosul)
function formatarPlaca(valor) {
  return valor
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 7)
    .replace(/^([A-Z]{3})(\w{1,4})$/, "$1-$2");
}

function validarCPF(cpf) {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11 || /^(\d)\1+$/.test(nums)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(nums[i]) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(nums[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(nums[i]) * (11 - i);
  r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(nums[10]);
}

function validarPlaca(placa) {
  const p = placa.replace(/[^A-Z0-9]/g, "");
  // Formato antigo: ABC1234
  const antigo = /^[A-Z]{3}\d{4}$/.test(p);
  // Mercosul: ABC1D23
  const mercosul = /^[A-Z]{3}\d[A-Z]\d{2}$/.test(p);
  return antigo || mercosul;
}

const COBERTURAS = [
  { id: "basica", label: "Básica", desc: "Colisão, roubo/furto e incêndio" },
  { id: "intermediaria", label: "Intermediária", desc: "+ Danos a terceiros" },
  { id: "completa", label: "Completa", desc: "+ Danos corporais e assistência 24h" },
];

const STEPS = [
  { id: "cpf", label: "Seu CPF", emoji: "🪪" },
  { id: "placa", label: "Placa do Veículo", emoji: "🚗" },
  { id: "veiculo", label: "Dados do Carro", emoji: "📋" },
  { id: "apolice", label: "Sua Apólice", emoji: "📄" },
];

export default function Onboarding({ user, onConcluir }) {
  const [step, setStep] = useState(0);
  const [cpf, setCpf] = useState("");
  const [placa, setPlaca] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [apolice, setApolice] = useState("");
  const [cobertura, setCobertura] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const nome = user.displayName?.split(" ")[0] || "você";

  async function avancar() {
    setErro("");
    setLoading(true);

    try {
      if (step === 0) {
        // Valida formato
        if (!validarCPF(cpf)) {
          setErro("CPF inválido. Verifique os dígitos e tente novamente.");
          return;
        }
        // Verifica duplicata no Firestore
        const dono = await verificarCpfDuplicado(cpf);
        if (dono && dono !== user.uid) {
          setErro("Este CPF já está vinculado a outra conta. Se houve erro, entre em contato com o suporte.");
          return;
        }
        setStep(1);
      } else if (step === 1) {
        if (!validarPlaca(placa)) {
          setErro("Placa inválida. Use o formato ABC-1234 ou Mercosul ABC1D23.");
          return;
        }
        const dono = await verificarPlacaDuplicada(placa);
        if (dono && dono !== user.uid) {
          setErro("Esta placa já está vinculada a outra conta. Se houve erro, entre em contato com o suporte.");
          return;
        }
        setStep(2);
      } else if (step === 2) {
        if (!veiculo.trim() || veiculo.trim().length < 3) {
          setErro("Informe o modelo do veículo (ex: Honda Civic 2022).");
          return;
        }
        setStep(3);
      } else if (step === 3) {
        const numLimpo = apolice.replace(/\D/g, "");
        if (numLimpo.length < 6) {
          setErro("Informe o número da apólice (mínimo 6 dígitos).");
          return;
        }
        if (!cobertura) {
          setErro("Selecione o tipo de cobertura do seu seguro.");
          return;
        }
        // Salva tudo
        await salvarOnboarding(user.uid, { cpf, placa, veiculo, apolice: numLimpo, cobertura });
        onConcluir();
      }
    } catch (e) {
      if (e.message === "CPF_DUPLICADO") {
        setErro("Este CPF já está vinculado a outra conta. Entre em contato com o suporte.");
      } else if (e.message === "PLACA_DUPLICADA") {
        setErro("Esta placa já está vinculada a outra conta. Entre em contato com o suporte.");
      } else {
        setErro("Erro ao salvar. Verifique sua conexão e tente novamente.");
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", padding: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap');
        @keyframes fadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideRight { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        .ob-input { transition: all 0.2s; }
        .ob-input:focus { outline: none; border-color: ${C.accent} !important; box-shadow: 0 0 0 3px ${C.accentGlow} !important; }
        .ob-btn:hover:not(:disabled) { opacity: 0.88; transform: scale(0.98); }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 440,
        animation: "fadeIn 0.4s ease",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 70, height: 70, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.accent}, ${C.gold})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, margin: "0 auto 16px",
            boxShadow: `0 0 30px ${C.accentGlow}`,
          }}>🛡️</div>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 6,
          }}>Olá, {nome}! Bem-vindo à AutoShield</h1>
          <p style={{ color: C.textSub, fontSize: 14 }}>
            Precisamos de alguns dados para personalizar seu atendimento.
          </p>
        </div>

        {/* Stepper */}
        <div style={{
          display: "flex", alignItems: "center", gap: 0,
          marginBottom: 28, padding: "0 8px",
        }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: i < step ? C.success : i === step ? C.accent : C.surfaceElevated,
                  border: `2px solid ${i < step ? C.success : i === step ? C.accent : C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: i < step ? 14 : 16,
                  transition: "all 0.3s",
                }}>
                  {i < step ? "✓" : s.emoji}
                </div>
                <span style={{
                  fontSize: 9, color: i === step ? C.accent : C.textMuted,
                  fontWeight: i === step ? 600 : 400, whiteSpace: "nowrap",
                }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: 2, margin: "0 4px 16px",
                  background: i < step ? C.success : C.border,
                  transition: "background 0.3s",
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 20, padding: "28px 24px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          animation: "slideRight 0.3s ease",
        }}>

          {/* Step 0 — CPF */}
          {step === 0 && (
            <>
              <Label emoji="🪪" text="Seu CPF" />
              <p style={{ color: C.textSub, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                Usado para identificar sua apólice e garantir que só você acesse seus dados de seguro.
              </p>
              <input
                className="ob-input"
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => { setErro(""); setCpf(formatarCPF(e.target.value)); }}
                onKeyDown={(e) => e.key === "Enter" && avancar()}
                maxLength={14}
                style={inputStyle}
              />
            </>
          )}

          {/* Step 1 — Placa */}
          {step === 1 && (
            <>
              <Label emoji="🚗" text="Placa do Veículo" />
              <p style={{ color: C.textSub, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                A placa identifica seu veículo segurado. Aceitamos formato antigo (ABC-1234) e Mercosul (ABC1D23).
              </p>
              <input
                className="ob-input"
                type="text"
                placeholder="ABC-1234"
                value={placa}
                onChange={(e) => { setErro(""); setPlaca(formatarPlaca(e.target.value)); }}
                onKeyDown={(e) => e.key === "Enter" && avancar()}
                maxLength={8}
                style={inputStyle}
              />
            </>
          )}

          {/* Step 2 — Modelo do Carro */}
          {step === 2 && (
            <>
              <Label emoji="📋" text="Modelo do Veículo" />
              <p style={{ color: C.textSub, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                Informe o modelo para que a Ana possa dar informações mais precisas sobre sua cobertura.
              </p>
              <input
                className="ob-input"
                type="text"
                placeholder="Ex: Honda Civic EXL 2022"
                value={veiculo}
                onChange={(e) => { setErro(""); setVeiculo(e.target.value); }}
                onKeyDown={(e) => e.key === "Enter" && avancar()}
                maxLength={60}
                style={inputStyle}
              />

              {/* Resumo dos dados */}
              <div style={{
                marginTop: 16, background: C.surfaceElevated,
                border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px",
              }}>
                <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Confirmação dos dados
                </p>
                <ResumoItem label="CPF" valor={cpf} />
                <ResumoItem label="Placa" valor={placa} />
              </div>
            </>
          )}

          {/* Step 3 — Apólice e Cobertura */}
          {step === 3 && (
            <>
              <Label emoji="📄" text="Sua Apólice" />
              <p style={{ color: C.textSub, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                Essas informações permitem que a Ana consulte seus dados de cobertura e agilize qualquer solicitação.
              </p>

              {/* Número da apólice */}
              <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>
                Número da apólice <span style={{ color: C.accent }}>*</span>
              </p>
              <input
                className="ob-input"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 123456789"
                value={apolice}
                onChange={(e) => { setErro(""); setApolice(e.target.value.replace(/\D/g, "").slice(0, 12)); }}
                onKeyDown={(e) => e.key === "Enter" && avancar()}
                maxLength={12}
                style={{ ...inputStyle, marginBottom: 18 }}
              />

              {/* Tipo de cobertura */}
              <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, fontWeight: 600 }}>
                Tipo de cobertura <span style={{ color: C.accent }}>*</span>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 6 }}>
                {COBERTURAS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setErro(""); setCobertura(c.id); }}
                    style={{
                      background: cobertura === c.id ? `rgba(29,111,232,0.15)` : C.surfaceElevated,
                      border: `1.5px solid ${cobertura === c.id ? C.accent : C.border}`,
                      borderRadius: 10, padding: "11px 14px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                      transition: "all 0.2s", fontFamily: "inherit",
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${cobertura === c.id ? C.accent : C.border}`,
                      background: cobertura === c.id ? C.accent : "transparent",
                      transition: "all 0.2s",
                    }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.label}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{c.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Resumo final */}
              <div style={{
                marginTop: 14, background: C.surfaceElevated,
                border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px",
              }}>
                <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Resumo do cadastro
                </p>
                <ResumoItem label="CPF" valor={cpf} />
                <ResumoItem label="Placa" valor={placa} />
                <ResumoItem label="Veículo" valor={veiculo || "—"} />
              </div>
            </>
          )}

          {/* Erro */}
          {erro && (
            <div style={{
              marginTop: 12, background: "rgba(239,68,68,0.1)",
              border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 8,
              padding: "10px 12px", fontSize: 13, color: C.error,
            }}>
              ⚠️ {erro}
            </div>
          )}

          {/* Botão */}
          <button
            className="ob-btn"
            onClick={avancar}
            disabled={loading}
            style={{
              width: "100%", marginTop: 20,
              padding: "14px 20px", borderRadius: 12, border: "none",
              background: loading ? C.border : `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`,
              color: "#fff", fontSize: 15, fontWeight: 600,
              fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: loading ? "none" : "0 4px 20px rgba(29,111,232,0.4)",
            }}
          >
            {loading ? "Verificando..." : step < 3 ? "Continuar →" : "Concluir Cadastro ✓"}
          </button>

          {/* Segurança */}
          <p style={{ textAlign: "center", fontSize: 11, color: C.textMuted, marginTop: 14, lineHeight: 1.5 }}>
            🔒 Seus dados são criptografados e protegidos pela LGPD.<br />
            Nunca compartilhamos com terceiros sem sua autorização.
          </p>
        </div>
      </div>
    </div>
  );
}

function Label({ emoji, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <h2 style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 18, fontWeight: 700, color: "#F1F5F9",
      }}>{text}</h2>
    </div>
  );
}

function ResumoItem({ label, valor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>{valor}</span>
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "#0A0E1A",
  border: "1px solid #1E2D45", borderRadius: 10,
  padding: "13px 14px", color: "#F1F5F9",
  fontSize: 16, fontFamily: "'DM Sans', sans-serif",
  letterSpacing: "0.05em",
  boxSizing: "border-box",
};
