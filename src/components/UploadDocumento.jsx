import { useState, useRef } from "react";
import { uploadDocumento, TIPOS_DOCUMENTO, formatarTamanho } from "../services/cloudinaryService";
import { salvarDocumento } from "../services/firestoreService";

const C = {
  bg: "#0A0E1A",
  surface: "#111827",
  surfaceElevated: "#1A2235",
  border: "#1E2D45",
  accent: "#1D6FE8",
  accentGlow: "rgba(29,111,232,0.18)",
  gold: "#F59E0B",
  text: "#F1F5F9",
  textMuted: "#64748B",
  textSub: "#94A3B8",
  error: "#EF4444",
  success: "#10B981",
};

/**
 * Modal para seleção e upload de documentos.
 *
 * Props:
 * - userId: string
 * - conversaId: string
 * - onDocumentoEnviado: (info) => void  ← chamado com os dados do doc após upload
 * - onFechar: () => void
 */
export default function UploadDocumento({ userId, conversaId, onDocumentoEnviado, onFechar, docsEnviados = [], tipoInicial = null }) {
  const [tipoSelecionado, setTipoSelecionado] = useState(tipoInicial);
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progresso, setProgresso] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | uploading | sucesso | erro
  const [mensagemErro, setMensagemErro] = useState("");
  const inputRef = useRef(null);

  function selecionarArquivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    setStatus("idle");
    setMensagemErro("");

    // Preview apenas para imagens
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }

  async function enviar() {
    if (!arquivo || !tipoSelecionado) return;

    setStatus("uploading");
    setProgresso(0);

    try {
      // Upload para Cloudinary
      const docInfo = await uploadDocumento(
        arquivo,
        userId,
        tipoSelecionado,
        setProgresso
      );

      // Salva URL e metadados no Firestore
      await salvarDocumento(conversaId, userId, docInfo);

      setStatus("sucesso");

      // Notifica o chat para exibir mensagem de confirmação
      onDocumentoEnviado({
        ...docInfo,
        tipoLabel: TIPOS_DOCUMENTO[tipoSelecionado]?.label,
      });

      // Fecha após 1.5s
      setTimeout(onFechar, 1500);
    } catch (e) {
      setStatus("erro");
      setMensagemErro(e.message || "Erro no upload. Tente novamente.");
    }
  }

  function resetar() {
    setArquivo(null);
    setPreview(null);
    setProgresso(0);
    setStatus("idle");
    setMensagemErro("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }} onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 20, width: "100%", maxWidth: 460,
        boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: C.surfaceElevated,
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 2 }}>
              📎 Enviar Documento
            </h3>
            <p style={{ fontSize: 11, color: C.textMuted }}>
              JPG, PNG ou PDF · Máx. 10 MB (imagens) / 20 MB (PDF)
            </p>
          </div>
          <button onClick={onFechar} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 20, color: C.textMuted, lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        <div style={{ padding: "20px" }}>
          {/* Seleção do tipo de documento */}
          {!tipoSelecionado ? (
            <>
              <p style={{ fontSize: 13, color: C.textSub, marginBottom: 14 }}>
                Qual documento você quer enviar?
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.entries(TIPOS_DOCUMENTO).map(([key, info]) => {
                  const jaEnviado = docsEnviados.includes(key);
                  return (
                    <button key={key} onClick={() => !jaEnviado && setTipoSelecionado(key)} style={{
                      background: jaEnviado ? "rgba(16,185,129,0.07)" : C.surfaceElevated,
                      border: `1px solid ${jaEnviado ? "rgba(16,185,129,0.4)" : C.border}`,
                      borderRadius: 12, padding: "14px 12px",
                      cursor: jaEnviado ? "default" : "pointer",
                      display: "flex", flexDirection: "column", alignItems: "flex-start",
                      gap: 4, transition: "all 0.2s", textAlign: "left",
                      opacity: jaEnviado ? 0.7 : 1,
                    }}
                      onMouseEnter={(e) => { if (!jaEnviado) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentGlow; } }}
                      onMouseLeave={(e) => { if (!jaEnviado) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surfaceElevated; } }}
                    >
                      <span style={{ fontSize: 22 }}>{info.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: jaEnviado ? C.success : C.text }}>
                        {info.label} {jaEnviado && "✓"}
                      </span>
                      <span style={{ fontSize: 11, color: jaEnviado ? C.success : C.textMuted }}>
                        {jaEnviado ? "Já enviado" : info.descricao}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Tipo selecionado — upload */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
              }}>
                <button onClick={() => { setTipoSelecionado(null); resetar(); }} style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 14, color: C.textMuted,
                }}>← Voltar</button>
                <span style={{ fontSize: 14, color: C.textSub }}>
                  {TIPOS_DOCUMENTO[tipoSelecionado]?.emoji} {TIPOS_DOCUMENTO[tipoSelecionado]?.label}
                </span>
              </div>

              {/* Área de drop */}
              {!arquivo ? (
                <div
                  onClick={() => inputRef.current?.click()}
                  style={{
                    border: `2px dashed ${C.border}`, borderRadius: 14,
                    padding: "32px 20px", textAlign: "center", cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentGlow; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; }}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = C.accent; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) { selecionarArquivo({ target: { files: [f] } }); }
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
                  <p style={{ color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                    Clique ou arraste o arquivo aqui
                  </p>
                  <p style={{ color: C.textMuted, fontSize: 12 }}>
                    {TIPOS_DOCUMENTO[tipoSelecionado]?.aceita?.replace("image/*", "Imagens").replace(",application/pdf", " e PDF")}
                  </p>
                  <input
                    ref={inputRef} type="file"
                    accept={TIPOS_DOCUMENTO[tipoSelecionado]?.aceita}
                    onChange={selecionarArquivo}
                    style={{ display: "none" }}
                  />
                </div>
              ) : (
                <>
                  {/* Preview do arquivo */}
                  <div style={{
                    background: C.surfaceElevated, border: `1px solid ${C.border}`,
                    borderRadius: 12, padding: 12,
                    display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
                  }}>
                    {preview ? (
                      <img src={preview} alt="" style={{
                        width: 60, height: 60, objectFit: "cover", borderRadius: 8,
                        border: `1px solid ${C.border}`,
                      }} />
                    ) : (
                      <div style={{
                        width: 60, height: 60, borderRadius: 8,
                        background: C.bg, border: `1px solid ${C.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 26,
                      }}>📄</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 600, color: C.text,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{arquivo.name}</p>
                      <p style={{ fontSize: 11, color: C.textMuted }}>{formatarTamanho(arquivo.size)}</p>
                    </div>
                    {status === "idle" && (
                      <button onClick={resetar} style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: C.textMuted, fontSize: 18, lineHeight: 1, padding: 4,
                      }}>×</button>
                    )}
                  </div>

                  {/* Barra de progresso */}
                  {status === "uploading" && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        fontSize: 12, color: C.textSub, marginBottom: 6,
                      }}>
                        <span>Enviando...</span>
                        <span>{progresso}%</span>
                      </div>
                      <div style={{
                        height: 6, background: C.surfaceElevated,
                        borderRadius: 3, overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", width: `${progresso}%`,
                          background: `linear-gradient(90deg, ${C.accent}, ${C.gold})`,
                          borderRadius: 3, transition: "width 0.2s",
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Sucesso */}
                  {status === "sucesso" && (
                    <div style={{
                      background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
                      borderRadius: 10, padding: "12px 14px", marginBottom: 16,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontSize: 20 }}>✅</span>
                      <span style={{ fontSize: 13, color: C.success, fontWeight: 600 }}>
                        Documento enviado com sucesso!
                      </span>
                    </div>
                  )}

                  {/* Erro */}
                  {status === "erro" && (
                    <div style={{
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: 10, padding: "12px 14px", marginBottom: 16,
                      fontSize: 13, color: C.error,
                    }}>
                      ⚠️ {mensagemErro}
                    </div>
                  )}

                  {/* Botão de envio */}
                  {(status === "idle" || status === "erro") && (
                    <button onClick={enviar} style={{
                      width: "100%", padding: "13px 20px",
                      borderRadius: 12, border: "none",
                      background: `linear-gradient(135deg, ${C.accent}, #3B8AF0)`,
                      color: "#fff", fontSize: 14, fontWeight: 600,
                      fontFamily: "inherit", cursor: "pointer",
                      boxShadow: "0 4px 16px rgba(29,111,232,0.4)",
                    }}>
                      {status === "erro" ? "🔄 Tentar novamente" : "📤 Enviar documento"}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
