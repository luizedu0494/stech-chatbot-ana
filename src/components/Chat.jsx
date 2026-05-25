import React, { useState, useRef, useEffect } from "react";
import {
  salvarUsuario,
  criarConversa,
  atualizarConversa,
  salvarPergunta,
  salvarResposta,
  buscarHistorico,
  buscarFaqsRelevantes,
  registrarFaq,
  detectarTopico,
  buscarUltimaConversa,
  buscarMensagensConversa,
  buscarDocumentosConversa,
} from "../services/firestoreService";
import { chamarGroqRAG } from "../services/groqService";
import UploadDocumento from "./UploadDocumento";

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
  success: "#10B981",
};

// ─── Triagem inicial ──────────────────────────────────────────────────────────
// Mostrada como "menu" logo após a saudação, antes do usuário digitar qualquer coisa
const TRIAGEM = [
  {
    id: "assistencia",
    emoji: "🚨",
    label: "Acionar assistência",
    sub: "Guincho, Chaveiro, Pneu",
    texto: "Preciso acionar assistência 24h (guincho, chaveiro ou troca de pneu).",
  },
  {
    id: "sinistro",
    emoji: "🚗",
    label: "Comunicar sinistro",
    sub: "Acidente ou roubo",
    texto: "Quero comunicar um sinistro (acidente ou roubo do veículo).",
  },
  {
    id: "apolice",
    emoji: "📄",
    label: "Consultar apólice",
    sub: "Cobertura e documentos",
    texto: "Quero consultar minha apólice, coberturas e documentos.",
  },
];

// ─── FAQs rápidas (mostradas após a triagem) ──────────────────────────────────
const QUICK_FAQS = [
  { label: "💰 Coberturas", text: "Quais coberturas estão incluídas no meu seguro?" },
  { label: "📅 Renovação", text: "Como renovar meu seguro de automóvel?" },
  { label: "🎁 Bônus", text: "Como funciona o bônus por não acionar o seguro?" },
  { label: "🔧 Franquia", text: "Qual o valor da minha franquia?" },
];

function agora() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "10px 0" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%", background: C.accent,
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

function Bubble({ msg, onAbrirUpload }) {
  const isUser = msg.role === "user";
  const isDoc = msg.tipo === "documento";
  const isDocsFaltando = msg.tipo === "docs_faltando";

  if (isDocsFaltando) {
    return (
      <div style={{ display: "flex", marginBottom: 12, animation: "fadeSlideIn 0.3s ease" }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.accent}, ${C.gold})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, marginRight: 8, flexShrink: 0,
          boxShadow: `0 0 12px ${C.accentGlow}`,
        }}>🛡️</div>
        <div style={{
          maxWidth: "82%", padding: "12px 16px",
          borderRadius: "18px 18px 18px 4px",
          background: C.surfaceElevated, color: C.text, fontSize: 14,
          border: `1px solid ${C.border}`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}>
          <p style={{ marginBottom: 10, lineHeight: 1.5 }}>{msg.content}</p>

          {msg.faltando.length > 0 && (
            <>
              <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Pendentes
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {msg.faltando.map(([tipo, info]) => (
                  <button key={tipo} onClick={() => onAbrirUpload && onAbrirUpload(tipo)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: 10, padding: "8px 12px", cursor: "pointer",
                      transition: "all 0.2s", fontFamily: "inherit", width: "100%", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.6)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
                  >
                    <span style={{ fontSize: 20 }}>{info.emoji}</span>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{info.label}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "rgb(239,68,68)" }}>Enviar →</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {msg.enviados.length > 0 && (
            <>
              <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Já enviados ✓
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {msg.enviados.map(([tipo, info]) => {
                  const docData = msg.docsUrlMap?.[tipo];
                  const isPdf = docData?.formato === "pdf";
                  const [expanded, setExpanded] = React.useState(false);
                  return (
                    <div key={tipo}>
                      <button onClick={() => setExpanded((v) => !v)} style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)",
                        borderRadius: expanded ? "10px 10px 0 0" : 10, padding: "8px 12px",
                        cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s",
                      }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(16,185,129,0.15)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(16,185,129,0.08)"}
                      >
                        <span style={{ fontSize: 20 }}>{info.emoji}</span>
                        <span style={{ fontSize: 13, color: "rgb(16,185,129)", fontWeight: 500 }}>{info.label} ✓</span>
                        <span style={{ marginLeft: "auto", fontSize: 12, color: C.textMuted }}>{expanded ? "▲" : "▼"}</span>
                      </button>

                      {expanded && (
                        <div style={{
                          background: "rgba(0,0,0,0.2)", border: "1px solid rgba(16,185,129,0.3)",
                          borderTop: "none", borderRadius: "0 0 10px 10px", padding: 10,
                          display: "flex", flexDirection: "column", gap: 8,
                        }}>
                          {/* Preview */}
                          {docData?.url && !isPdf && (
                            <img src={docData.url} alt={info.label}
                              style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8 }} />
                          )}
                          {docData?.url && isPdf && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                              <span style={{ fontSize: 28 }}>📄</span>
                              <span style={{ fontSize: 12, color: C.textMuted }}>Arquivo PDF</span>
                            </div>
                          )}
                          {/* Actions */}
                          <div style={{ display: "flex", gap: 8 }}>
                            {docData?.url && (
                              <a href={docData.url} target="_blank" rel="noopener noreferrer"
                                style={{
                                  flex: 1, textAlign: "center", padding: "7px 0", borderRadius: 8,
                                  background: "rgba(29,111,232,0.15)", border: "1px solid rgba(29,111,232,0.4)",
                                  color: C.accentLight, fontSize: 12, textDecoration: "none", fontWeight: 500,
                                }}>
                                Ver arquivo ↗
                              </a>
                            )}
                            <button onClick={() => onAbrirUpload && onAbrirUpload(tipo)} style={{
                              flex: 1, padding: "7px 0", borderRadius: 8, cursor: "pointer",
                              background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)",
                              color: "rgb(245,158,11)", fontSize: 12, fontFamily: "inherit", fontWeight: 500,
                            }}>
                              🔄 Reenviar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div style={{ fontSize: 10, marginTop: 10, textAlign: "right", color: C.textMuted }}>{msg.time}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12, animation: "fadeSlideIn 0.3s ease",
    }}>
      {!isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.accent}, ${C.gold})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, marginRight: 8, flexShrink: 0,
          boxShadow: `0 0 12px ${C.accentGlow}`,
        }}>🛡️</div>
      )}
      <div style={{
        maxWidth: "72%", padding: isDoc ? "10px 12px" : "12px 16px",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isUser ? `linear-gradient(135deg, ${C.accent}, ${C.accentLight})` : C.surfaceElevated,
        color: C.text, fontSize: 14, lineHeight: 1.6,
        border: isUser ? "none" : `1px solid ${C.border}`,
        boxShadow: isUser ? "0 4px 15px rgba(29,111,232,0.3)" : "0 2px 8px rgba(0,0,0,0.3)",
        whiteSpace: "pre-wrap",
      }}>
        {/* Miniatura de documento */}
        {isDoc && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "8px 10px",
          }}>
            <span style={{ fontSize: 22 }}>{msg.docEmoji || "📎"}</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                {msg.docTipo}
              </p>
              <a href={msg.docUrl} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 11, color: C.accentLight, textDecoration: "none",
              }}>
                Ver documento ↗
              </a>
            </div>
          </div>
        )}
        {msg.content && <span>{msg.content}</span>}
        <div style={{
          fontSize: 10, marginTop: 4, textAlign: "right",
          color: isUser ? "rgba(255,255,255,0.6)" : C.textMuted,
        }}>{msg.time}</div>
      </div>
      {isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: C.surfaceElevated, border: `2px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, marginLeft: 8, flexShrink: 0,
        }}>👤</div>
      )}
    </div>
  );
}

export default function Chat({ user, perfil, onLogout }) {
  const nome = user.displayName?.split(" ")[0] || "você";
  const placa = perfil?.placa || null;

  const apoliceInfo = perfil?.apolice ? `Apólice: **${perfil.apolice}**` : null;
  const coberturaMap = { basica: "Básica", intermediaria: "Intermediária", completa: "Completa" };
  const coberturaInfo = perfil?.cobertura ? `Cobertura: **${coberturaMap[perfil.cobertura] || perfil.cobertura}**` : null;

  const linhaVeiculo = [placa && `🚗 Placa **${placa}**`, perfil?.veiculo && perfil.veiculo].filter(Boolean).join(" · ");
  const linhaApolice = [apoliceInfo, coberturaInfo].filter(Boolean).join(" · ");

  const blocoIdentificacao = linhaVeiculo || linhaApolice
    ? `\n\n📋 **Seus dados identificados:**\n${[linhaVeiculo, linhaApolice].filter(Boolean).join("\n")}`
    : "";

  const blocoOpcoes = `\n\n**O que posso fazer por você:**\n🚨 **Acionar assistência 24h** — tenha em mãos sua localização atual\n🚗 **Comunicar sinistro** — tenha em mãos o número da apólice, data/hora e descrição do ocorrido\n📄 **Consultar apólice** — resumo de cobertura, dados do seguro e documentos\n\nEscolha uma opção no menu abaixo ou me diga como posso ajudar! 👇`;

  const saudacaoInicial = `Olá, ${nome}! 👋 Sou a Ana, assistente virtual da AutoShield.${blocoIdentificacao}${blocoOpcoes}`;

  const [messages, setMessages] = useState([{
    role: "assistant",
    content: saudacaoInicial,
    time: agora(),
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversaId, setConversaId] = useState(null);
  const [triagemFeita, setTriagemFeita] = useState(false); // controla se o menu de triagem já foi usado
  const [uploadAberto, setUploadAberto] = useState(false);
  const [docsEnviados, setDocsEnviados] = useState([]); // tipos de doc já enviados (para marcar modal)
  const [docsUrlMap, setDocsUrlMap] = useState({}); // { tipo: url } para preview
  const [uploadTipoInicial, setUploadTipoInicial] = useState(null);

  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const isMenuActionRef = useRef(false);

  useEffect(() => {
    async function init() {
      const perfil = await salvarUsuario(user);

      // Chave de cache por usuário no sessionStorage
      const cacheKey = `autoshield_conversa_${user.uid}`;
      const cachedId = sessionStorage.getItem(cacheKey);

      // Tenta pelo cache do browser primeiro, depois pelo Firestore
      let conversaIdFinal = cachedId || null;

      if (!conversaIdFinal) {
        const ultima = await buscarUltimaConversa(user.uid);
        conversaIdFinal = ultima?.id || null;
      }

      if (conversaIdFinal) {
        const [mensagens, tiposDoc] = await Promise.all([
          buscarMensagensConversa(conversaIdFinal, 40),
          buscarDocumentosConversa(conversaIdFinal),
        ]);

        if (mensagens.length > 0) {
          const agr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          setConversaId(conversaIdFinal);
          sessionStorage.setItem(cacheKey, conversaIdFinal);
          setMessages([
            ...mensagens,
            {
              role: "assistant",
              content: `Bem-vindo de volta, ${nome}! 👋 Retomei nossa conversa anterior. Posso continuar te ajudando ou prefere começar um novo assunto?`,
              time: agr,
              separador: true,
            },
          ]);
          if (tiposDoc.length > 0) {
            setDocsEnviados(tiposDoc.map((d) => d.tipo));
            const urlMap = {};
            tiposDoc.forEach((d) => { if (d.url) urlMap[d.tipo] = { url: d.url, formato: d.formato }; });
            setDocsUrlMap(urlMap);
          }
          setTriagemFeita(true);
          setCarregandoHistorico(false);
          return;
        }
      }

      // Sem histórico — primeira vez ou conversa vazia
      const id = await criarConversa(user.uid);
      setConversaId(id);
      sessionStorage.setItem(cacheKey, id);
      setCarregandoHistorico(false);
    }
    init();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const enviar = async (texto, isMenuAction = false) => {
    const content = texto || input.trim();
    if (!content || loading || !conversaId) return;
    setInput("");
    if (!triagemFeita) setTriagemFeita(true);
    isMenuActionRef.current = isMenuAction;

    const userMsg = { role: "user", content, time: agora() };
    setMessages((prev) => [...prev, userMsg]);

    // Classifica intenção relacionada a documentos via IA (evita regex frágil)
    if (docsEnviados.length > 0) {
      const TODOS_DOCS_INT = {
        foto_veiculo: { label: "Foto do Veículo", emoji: "🚗" },
        crlv:         { label: "CRLV",            emoji: "📋" },
        cnh:          { label: "CNH",             emoji: "🪪" },
        bo:           { label: "Boletim de Ocorrência", emoji: "🚔" },
        laudo:        { label: "Laudo / Orçamento", emoji: "🔧" },
      };
      const tipoNomes = { foto_veiculo: "foto do veículo", crlv: "CRLV", cnh: "CNH", bo: "boletim de ocorrência", laudo: "laudo/orçamento" };
      const docsEnviadosDesc = docsEnviados.map(t => tipoNomes[t] || t).join(", ");
      try {
        const classRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 60,
            system: `Classifique a mensagem em UMA opção. Responda SOMENTE com JSON puro: {"intencao":"...","tipo":"..."} sem markdown.

Opções de intencao:
- "visualizar": usuário quer VER/exibir/receber um arquivo que JÁ enviou anteriormente. Exemplos: "pode mandar a foto que mandei?", "me mostra a CNH", "quero ver o documento", "manda a foto do carro que enviei"
- "reenviar": usuário quer SUBSTITUIR por um arquivo NOVO/DIFERENTE. Exemplos: "quero reenviar", "trocar a foto", "substituir o documento", "enviar uma nova foto"
- "outro": qualquer outra coisa

IMPORTANTE: Se a mensagem mencionar "que mandei", "que enviei", "que já enviei" ou similar, é SEMPRE "visualizar", não "reenviar".

Para tipo: foto_veiculo, crlv, cnh, bo, laudo, ou null se não especificado.
Arquivos já enviados: \${docsEnviadosDesc}`,
            messages: [{ role: "user", content }],
          }),
        });
        const classData = await classRes.json();
        const classText = classData.content?.[0]?.text || "{}";
        const parsed = JSON.parse(classText.replace(/```json|```/g, "").trim());
        const intencao = parsed.intencao;
        const tipo = parsed.tipo;

        if (intencao === "visualizar") {
          const docsParaMostrar = tipo && docsEnviados.includes(tipo)
            ? [[tipo, TODOS_DOCS_INT[tipo]]]
            : Object.entries(TODOS_DOCS_INT).filter(([k]) => docsEnviados.includes(k));
          setMessages((prev) => [...prev, {
            role: "assistant", tipo: "docs_faltando", faltando: [],
            enviados: docsParaMostrar, docsUrlMap: { ...docsUrlMap },
            content: `Aqui está${docsParaMostrar.length > 1 ? "m" : ""} o${docsParaMostrar.length > 1 ? "s" : ""} arquivo${docsParaMostrar.length > 1 ? "s" : ""} que você enviou:`,
            time: agora(),
          }]);
          setLoading(false);
          return;
        }

        if (intencao === "reenviar") {
          const tipoFinal = tipo && TODOS_DOCS_INT[tipo] ? tipo : null;
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: "Abrindo o envio para você! 📎",
            time: agora(),
          }]);
          setUploadTipoInicial(tipoFinal);
          setUploadAberto(true);
          setLoading(false);
          return;
        }
      } catch {
        // falhou — segue para a IA normalmente
      }
    }


    // Detecta pedido sobre documentos faltando / o que precisa enviar
    const TODOS_DOCS = {
      foto_veiculo: { label: "Foto do Veículo", emoji: "🚗" },
      crlv:         { label: "CRLV",            emoji: "📋" },
      cnh:          { label: "CNH",             emoji: "🪪" },
      bo:           { label: "Boletim de Ocorrência", emoji: "🚔" },
      laudo:        { label: "Laudo / Orçamento", emoji: "🔧" },
    };
    const perguntandoDocs = /falt|preciso enviar|o que (eu )?(preciso|devo|tenho que)|quais doc|documento(s)? (necessário|obrigatório|precisam)|enviar doc|mandar doc/i.test(content);
    if (perguntandoDocs) {
      const faltando = Object.entries(TODOS_DOCS).filter(([k]) => !docsEnviados.includes(k));
      const enviados = Object.entries(TODOS_DOCS).filter(([k]) => docsEnviados.includes(k));
      setMessages((prev) => [...prev, {
        role: "assistant",
        tipo: "docs_faltando",
        faltando,
        enviados,
        docsUrlMap: { ...docsUrlMap },
        content: faltando.length === 0
          ? "✅ Você já enviou todos os documentos disponíveis nesta conversa!"
          : `Aqui está o status dos documentos desta conversa:`,
        time: agora(),
      }]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const topico = detectarTopico(content);
      const [historico, faqs] = await Promise.all([
        buscarHistorico(conversaId, 10),
        buscarFaqsRelevantes(topico, 5),
      ]);

      // Quando vem de botão de menu, passa contexto explícito para a IA agir direto
      const mensagemParaIA = isMenuAction
        ? `[AÇÃO DE MENU SELECIONADA — responda seguindo o fluxo correspondente imediatamente, sem rodeios]\n${content}`
        : content;

      const resposta = await chamarGroqRAG(mensagemParaIA, historico, faqs, { ...perfil, docsEnviados });
      const botMsg = { role: "assistant", content: resposta, time: agora() };
      setMessages((prev) => [...prev, botMsg]);

      // Verifica se a IA pediu algum documento e oferece o upload
      const pedindoDoc = /foto|documento|crlv|cnh|boletim|b\.o\.|envie|anexe/i.test(resposta);
      if (pedindoDoc) {
        setTimeout(() => setUploadAberto(true), 800);
      }

      const perguntaId = await salvarPergunta(conversaId, user.uid, content, topico);
      await Promise.all([
        salvarResposta(conversaId, resposta, topico, perguntaId),
        atualizarConversa(conversaId, topico, user.uid),
        registrarFaq(content, resposta, topico),
      ]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "⚠️ Tive um problema ao me conectar. Por favor, tente novamente.",
        time: agora(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  function aoDocumentoEnviado(docInfo) {
    // Registra o tipo como enviado para marcar no modal
    if (docInfo.tipo) {
      setDocsEnviados((prev) => [...new Set([...prev, docInfo.tipo])]);
      if (docInfo.url) setDocsUrlMap((prev) => ({ ...prev, [docInfo.tipo]: { url: docInfo.url, formato: docInfo.formato || "" } }));
    }

    // Mensagem do usuário mostrando o doc
    setMessages((prev) => [...prev,
      {
        role: "user",
        tipo: "documento",
        content: "",
        docUrl: docInfo.url,
        docTipo: docInfo.tipoLabel,
        docEmoji: "📎",
        time: agora(),
      },
      {
        role: "assistant",
        content: `✅ Documento recebido! \n\nO **${docInfo.tipoLabel}** foi anexado à sua conversa. Para prosseguir com qualquer solicitação que dependa de análise, entre em contato com a Central AutoShield: **0800 123 4567**. Posso te ajudar com mais alguma coisa?`,
        time: agora(),
      }
    ]);
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", padding: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .triagem-btn:hover { background: ${C.accentGlow} !important; border-color: ${C.accent} !important; }
        .faq-btn:hover { background: ${C.accentGlow} !important; border-color: ${C.accent} !important; color: ${C.accentLight} !important; transform:translateY(-1px); }
        .send-btn:hover:not(:disabled) { opacity:0.85; transform:scale(0.97); }
        .upload-btn:hover { background: ${C.accentGlow} !important; border-color: ${C.accent} !important; }
        textarea:focus { outline:none; border-color:${C.accent} !important; box-shadow:0 0 0 3px ${C.accentGlow} !important; }
        .logout-btn:hover { opacity:0.7; }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 720,
        height: "90vh", maxHeight: 800,
        display: "flex", flexDirection: "column",
        background: C.surface, borderRadius: 20,
        border: `1px solid ${C.border}`, overflow: "hidden",
        boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
      }}>

        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${C.surfaceElevated} 0%, #0F1929 100%)`,
          borderBottom: `1px solid ${C.border}`,
          padding: "14px 20px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ position: "relative" }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.accent}, ${C.gold})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, boxShadow: `0 0 20px ${C.accentGlow}`,
            }}>🛡️</div>
            <div style={{
              position: "absolute", bottom: 2, right: 2,
              width: 11, height: 11, borderRadius: "50%",
              background: C.success, border: `2px solid ${C.surface}`,
              animation: "pulse 2s infinite",
            }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, color: C.text }}>
              Ana — AutoShield
            </div>
            <div style={{ fontSize: 11, color: C.success, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.success, display: "inline-block" }} />
              Online · IA com RAG ativo
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user.photoURL && (
              <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${C.border}` }} />
            )}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: C.textSub }}>{nome}</div>
              {placa && <div style={{ fontSize: 10, color: C.textMuted }}>🚗 {placa}</div>}
              <button className="logout-btn" onClick={onLogout} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 10, color: C.textMuted, fontFamily: "inherit", transition: "opacity 0.2s",
              }}>Sair</button>
            </div>
          </div>
        </div>

        {/* Triagem (aparece só antes do primeiro envio) ou FAQs rápidas */}
        {!triagemFeita ? (
          <div style={{
            padding: "10px 14px", borderBottom: `1px solid ${C.border}`,
            background: "rgba(0,0,0,0.25)",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
          }}>
            {TRIAGEM.map((op) => (
              <button key={op.id} className="triagem-btn" onClick={() => enviar(op.texto, true)} style={{
                background: C.surfaceElevated, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "9px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                transition: "all 0.2s", fontFamily: "inherit", textAlign: "left",
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{op.emoji}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{op.label}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{op.sub}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            padding: "8px 14px", borderBottom: `1px solid ${C.border}`,
            background: "rgba(0,0,0,0.25)",
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5,
          }}>
            {QUICK_FAQS.map((f) => (
              <button key={f.label} className="faq-btn" onClick={() => enviar(f.text, true)} style={{
                background: C.surfaceElevated, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "6px 8px", color: C.textSub,
                fontSize: 11, fontWeight: 500, cursor: "pointer",
                transition: "all 0.2s", whiteSpace: "nowrap",
                fontFamily: "inherit", textAlign: "center",
                overflow: "hidden", textOverflow: "ellipsis",
              }}>{f.label}</button>
            ))}
          </div>
        )}

        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}>
          {carregandoHistorico ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
              <div style={{ fontSize: 28 }}>🛡️</div>
              <p style={{ color: C.textMuted, fontSize: 13 }}>Carregando histórico...</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i}>
                {m.separador && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 16px" }}>
                    <div style={{ flex: 1, height: 1, background: C.border }} />
                    <span style={{ fontSize: 10, color: C.textMuted, whiteSpace: "nowrap" }}>conversa retomada</span>
                    <div style={{ flex: 1, height: 1, background: C.border }} />
                  </div>
                )}
                <Bubble msg={m} onAbrirUpload={(tipo) => { setUploadTipoInicial(tipo || null); setUploadAberto(true); }} />
              </div>
            ))
          )}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, animation: "fadeSlideIn 0.3s ease" }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.accent}, ${C.gold})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
              }}>🛡️</div>
              <div style={{
                background: C.surfaceElevated, border: `1px solid ${C.border}`,
                borderRadius: "18px 18px 18px 4px", padding: "10px 16px",
              }}>
                <TypingIndicator />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input + botão de upload */}
        <div style={{
          padding: "12px 16px", borderTop: `1px solid ${C.border}`,
          background: C.surfaceElevated, display: "flex", gap: 8, alignItems: "flex-end",
        }}>
          {/* Botão de upload de documento */}
          <button
            className="upload-btn"
            onClick={() => setUploadAberto(true)}
            title="Enviar documento"
            style={{
              width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.border}`,
              background: C.bg, cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, transition: "all 0.2s",
            }}
          >📎</button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder="Digite sua mensagem... (Enter para enviar)"
            rows={1}
            style={{
              flex: 1, background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: "12px 14px", color: C.text,
              fontSize: 14, fontFamily: "inherit", resize: "none",
              lineHeight: 1.5, transition: "all 0.2s", maxHeight: 100, overflowY: "auto",
            }}
          />
          <button
            className="send-btn"
            onClick={() => enviar()}
            disabled={!input.trim() || loading}
            style={{
              width: 46, height: 46, borderRadius: 12, border: "none",
              background: !input.trim() || loading ? C.border : `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`,
              cursor: !input.trim() || loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, transition: "all 0.2s", flexShrink: 0,
              boxShadow: !input.trim() || loading ? "none" : "0 4px 12px rgba(29,111,232,0.4)",
            }}
          >➤</button>
        </div>

        {/* Footer */}
        <div style={{
          padding: "5px 16px 8px", background: C.surfaceElevated,
          textAlign: "center", fontSize: 10, color: C.textMuted,
        }}>
          AutoShield Seguros · SUSEP 12345 · Central de Atendimento: 0800 123 4567
        </div>
      </div>

      {/* Modal de upload */}
      {uploadAberto && conversaId && (
        <UploadDocumento
          userId={user.uid}
          conversaId={conversaId}
          docsEnviados={docsEnviados}
          tipoInicial={uploadTipoInicial}
          onDocumentoEnviado={(info) => {
            setUploadAberto(false);
            setUploadTipoInicial(null);
            aoDocumentoEnviado(info);
          }}
          onFechar={() => {
            setUploadTipoInicial(null);
            setUploadAberto(false);
            // Avisa no chat que o modal foi fechado sem envio
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: "Tudo bem! Nenhum documento foi enviado. Se precisar anexar algo depois, é só clicar no 📎 quando quiser. 😊",
              time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            }]);
          }}
        />
      )}
    </div>
  );
}
