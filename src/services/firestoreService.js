import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  where,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// ══════════════════════════════════════════════════════════════════════════════
// ESTRUTURA DO FIRESTORE
//
// /usuarios/{userId}
//     nome, email, foto, ultimo_acesso, total_conversas, total_perguntas
//     cpf (string, indexado), placa (string, indexado)   ← NOVOS
//     onboarding_completo (boolean)                       ← NOVO
//
// /cpf_index/{cpf}          ← Índice para evitar duplicatas
//     userId, criado_em
//
// /placa_index/{placa}      ← Índice para evitar duplicatas
//     userId, criado_em
//
// /conversas/{conversaId}
//     userId, inicio, ultimo_acesso, total_mensagens, topico_principal
//
//     /perguntas/{perguntaId}
//         conteudo, timestamp, topico, conversa_id, user_id
//
//     /respostas/{respostaId}
//         conteudo, timestamp, topico, pergunta_id, conversa_id
//
//     /documentos/{docId}                                  ← NOVO
//         tipo, nome, url, publicId, tamanho, timestamp, conversa_id, user_id
//
// /faq_aprendido/{docId}
//     pergunta, resposta, topico
//     vezes_perguntada, avaliacao_media, ultima_atualizacao
//
// /topicos/{topicoId}
//     nome, total_perguntas, ultima_pergunta, ultima_atualizacao
// ══════════════════════════════════════════════════════════════════════════════


// ─── Detectar tópico ──────────────────────────────────────────────────────────
export function detectarTopico(texto) {
  const t = texto.toLowerCase();
  if (t.includes("sinistro") || t.includes("acidente") || t.includes("batida") || t.includes("colisão") || t.includes("roubo") || t.includes("furto")) return "sinistro";
  if (t.includes("apólice") || t.includes("apolice") || t.includes("segunda via") || t.includes("documento") || t.includes("contrato")) return "apolice";
  if (t.includes("cobertura") || t.includes("cobre") || t.includes("inclui") || t.includes("coberto")) return "cobertura";
  if (t.includes("assistência") || t.includes("assistencia") || t.includes("guincho") || t.includes("pane") || t.includes("reboque") || t.includes("chaveiro")) return "assistencia";
  if (t.includes("renova") || t.includes("vencimento") || t.includes("vencer")) return "renovacao";
  if (t.includes("pagamento") || t.includes("boleto") || t.includes("cartão") || t.includes("parcela") || t.includes("pagar")) return "pagamento";
  if (t.includes("cancelar") || t.includes("cancelamento")) return "cancelamento";
  if (t.includes("valor") || t.includes("preço") || t.includes("quanto") || t.includes("cotação")) return "cotacao";
  return "geral";
}


// ══════════════════════════════════════════════════════════════════════════════
// USUÁRIOS
// ══════════════════════════════════════════════════════════════════════════════

export async function salvarUsuario(user) {
  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, { ultimo_acesso: serverTimestamp() });
    return snap.data();
  } else {
    const dados = {
      nome: user.displayName || "Usuário",
      email: user.email || "",
      foto: user.photoURL || "",
      criado_em: serverTimestamp(),
      ultimo_acesso: serverTimestamp(),
      total_conversas: 0,
      total_perguntas: 0,
      onboarding_completo: false,
      cpf: null,
      placa: null,
    };
    await setDoc(ref, dados);
    return dados;
  }
}

export async function buscarPerfil(userId) {
  const snap = await getDoc(doc(db, "usuarios", userId));
  return snap.exists() ? snap.data() : null;
}


// ──────────────────────────────────────────────────────────────────────────────
// ONBOARDING — Salvar CPF e Placa com verificação de duplicatas
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Verifica se CPF já está em uso por outro usuário
 * @returns {string|null} userId do dono ou null
 */
export async function verificarCpfDuplicado(cpf) {
  const cpfLimpo = cpf.replace(/\D/g, "");
  const snap = await getDoc(doc(db, "cpf_index", cpfLimpo));
  if (snap.exists()) {
    return snap.data().userId; // já existe
  }
  return null;
}

/**
 * Verifica se Placa já está em uso por outro usuário
 * @returns {string|null} userId do dono ou null
 */
export async function verificarPlacaDuplicada(placa) {
  const placaNorm = placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const snap = await getDoc(doc(db, "placa_index", placaNorm));
  if (snap.exists()) {
    return snap.data().userId;
  }
  return null;
}

/**
 * Salva CPF e Placa no perfil do usuário (após verificação de duplicatas)
 */
export async function salvarOnboarding(userId, { cpf, placa, veiculo }) {
  const cpfLimpo = cpf.replace(/\D/g, "");
  const placaNorm = placa.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Verifica duplicatas antes de salvar
  const cpfDono = await verificarCpfDuplicado(cpfLimpo);
  if (cpfDono && cpfDono !== userId) {
    throw new Error("CPF_DUPLICADO");
  }

  const placaDono = await verificarPlacaDuplicada(placaNorm);
  if (placaDono && placaDono !== userId) {
    throw new Error("PLACA_DUPLICADA");
  }

  // Salva índices de unicidade
  await Promise.all([
    setDoc(doc(db, "cpf_index", cpfLimpo), { userId, criado_em: serverTimestamp() }),
    setDoc(doc(db, "placa_index", placaNorm), { userId, criado_em: serverTimestamp() }),
  ]);

  // Atualiza perfil do usuário
  await updateDoc(doc(db, "usuarios", userId), {
    cpf: cpfLimpo,
    placa: placaNorm,
    veiculo: veiculo || "",
    onboarding_completo: true,
    atualizado_em: serverTimestamp(),
  });
}


// ══════════════════════════════════════════════════════════════════════════════
// CONVERSAS
// ══════════════════════════════════════════════════════════════════════════════

export async function criarConversa(userId, topicoPrincipal = "geral") {
  const ref = await addDoc(collection(db, "conversas"), {
    userId,
    inicio: serverTimestamp(),
    ultimo_acesso: serverTimestamp(),
    total_mensagens: 0,
    topico_principal: topicoPrincipal,
  });

  // Salva o id da conversa ativa no perfil do usuário
  await updateDoc(doc(db, "usuarios", userId), {
    total_conversas: increment(1),
    conversa_ativa: ref.id,
  }).catch(() => {});

  return ref.id;
}

export async function atualizarConversa(conversaId, topico, userId) {
  await updateDoc(doc(db, "conversas", conversaId), {
    ultimo_acesso: serverTimestamp(),
    total_mensagens: increment(2),
    topico_principal: topico,
  });
  // Mantém conversa_ativa atualizado no perfil do usuário
  if (userId) {
    await updateDoc(doc(db, "usuarios", userId), {
      conversa_ativa: conversaId,
    }).catch(() => {});
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// PERGUNTAS
// ══════════════════════════════════════════════════════════════════════════════

export async function salvarPergunta(conversaId, userId, conteudo, topico) {
  const ref = await addDoc(
    collection(db, "conversas", conversaId, "perguntas"),
    {
      conteudo,
      topico,
      conversa_id: conversaId,
      user_id: userId,
      timestamp: serverTimestamp(),
    }
  );

  await updateDoc(doc(db, "usuarios", userId), {
    total_perguntas: increment(1),
  }).catch(() => {});

  return ref.id;
}


// ══════════════════════════════════════════════════════════════════════════════
// RESPOSTAS
// ══════════════════════════════════════════════════════════════════════════════

export async function salvarResposta(conversaId, conteudo, topico, perguntaId) {
  await addDoc(
    collection(db, "conversas", conversaId, "respostas"),
    {
      conteudo,
      topico,
      pergunta_id: perguntaId,
      conversa_id: conversaId,
      timestamp: serverTimestamp(),
    }
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENTOS ENVIADOS (Cloudinary → URL salva no Firestore)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Salva os metadados de um documento enviado via Cloudinary
 */
export async function salvarDocumento(conversaId, userId, docInfo) {
  const ref = await addDoc(
    collection(db, "conversas", conversaId, "documentos"),
    {
      tipo: docInfo.tipo,
      nome: docInfo.nome,
      url: docInfo.url,           // URL do Cloudinary
      publicId: docInfo.publicId, // Para gerenciar no Cloudinary depois
      tamanho: docInfo.tamanho,
      formato: docInfo.formato,
      conversa_id: conversaId,
      user_id: userId,
      timestamp: serverTimestamp(),
    }
  );

  // Também registra no perfil do usuário para histórico
  await updateDoc(doc(db, "usuarios", userId), {
    documentos_enviados: arrayUnion(docInfo.url),
  }).catch(() => {});

  return ref.id;
}


// ══════════════════════════════════════════════════════════════════════════════
// HISTÓRICO PARA O RAG (intercala perguntas + respostas)
// ══════════════════════════════════════════════════════════════════════════════

export async function buscarHistorico(conversaId, limiteQtd = 10) {
  try {
    const [snapP, snapR] = await Promise.all([
      getDocs(query(
        collection(db, "conversas", conversaId, "perguntas"),
        orderBy("timestamp", "desc"),
        limit(limiteQtd)
      )),
      getDocs(query(
        collection(db, "conversas", conversaId, "respostas"),
        orderBy("timestamp", "desc"),
        limit(limiteQtd)
      )),
    ]);

    const perguntas = snapP.docs.map((d) => ({
      role: "user",
      content: d.data().conteudo,
      ts: d.data().timestamp?.seconds || 0,
    }));

    const respostas = snapR.docs.map((d) => ({
      role: "assistant",
      content: d.data().conteudo,
      ts: d.data().timestamp?.seconds || 0,
    }));

    return [...perguntas, ...respostas]
      .sort((a, b) => a.ts - b.ts)
      .map(({ role, content }) => ({ role, content }));
  } catch {
    return [];
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// FAQ APRENDIDO
// ══════════════════════════════════════════════════════════════════════════════

export async function registrarFaq(pergunta, resposta, topico) {
  const chave = pergunta.toLowerCase().trim().slice(0, 80).replace(/[^a-z0-9]/g, "_");
  const ref = doc(db, "faq_aprendido", chave);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, {
      vezes_perguntada: increment(1),
      resposta,
      ultima_atualizacao: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      pergunta,
      resposta,
      topico,
      vezes_perguntada: 1,
      avaliacao_media: 5,
      criado_em: serverTimestamp(),
      ultima_atualizacao: serverTimestamp(),
    });
  }

  await atualizarTopico(topico, pergunta);
}

export async function buscarFaqsRelevantes(topico, limiteQtd = 5) {
  try {
    const qTopico = query(
      collection(db, "faq_aprendido"),
      where("topico", "==", topico),
      orderBy("vezes_perguntada", "desc"),
      limit(limiteQtd)
    );
    const snapTopico = await getDocs(qTopico);

    if (snapTopico.docs.length >= 2) {
      return snapTopico.docs.map((d) => d.data());
    }

    const qGeral = query(
      collection(db, "faq_aprendido"),
      orderBy("vezes_perguntada", "desc"),
      limit(limiteQtd)
    );
    const snapGeral = await getDocs(qGeral);
    return snapGeral.docs.map((d) => d.data());
  } catch {
    return [];
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// TÓPICOS
// ══════════════════════════════════════════════════════════════════════════════

async function atualizarTopico(topico, ultimaPergunta) {
  const ref = doc(db, "topicos", topico);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, {
      total_perguntas: increment(1),
      ultima_pergunta: ultimaPergunta,
      ultima_atualizacao: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      nome: topico,
      total_perguntas: 1,
      ultima_pergunta: ultimaPergunta,
      criado_em: serverTimestamp(),
      ultima_atualizacao: serverTimestamp(),
    });
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// RETOMAR CONVERSA EXISTENTE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Busca a conversa mais recente do usuário (pelo último acesso).
 * Retorna o id da conversa ou null se não houver.
 */
export async function buscarUltimaConversa(userId) {
  try {
    const userSnap = await getDoc(doc(db, "usuarios", userId));
    if (!userSnap.exists()) return null;
    const conversaId = userSnap.data().conversa_ativa;
    if (!conversaId) return null;
    const convSnap = await getDoc(doc(db, "conversas", conversaId));
    if (!convSnap.exists()) return null;
    return { id: conversaId, ...convSnap.data() };
  } catch {
    return null;
  }
}

/**
 * Busca todas as mensagens (perguntas + respostas) de uma conversa para
 * renderizar na tela — retorna array com { role, content, time }.
 */
export async function buscarMensagensConversa(conversaId, limiteQtd = 30) {
  try {
    const [snapP, snapR] = await Promise.all([
      getDocs(query(
        collection(db, "conversas", conversaId, "perguntas"),
        orderBy("timestamp", "asc"),
        limit(limiteQtd)
      )),
      getDocs(query(
        collection(db, "conversas", conversaId, "respostas"),
        orderBy("timestamp", "asc"),
        limit(limiteQtd)
      )),
    ]);

    const toTime = (ts) => {
      if (!ts) return "";
      const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    };

    const perguntas = snapP.docs.map((d) => ({
      role: "user",
      content: d.data().conteudo,
      time: toTime(d.data().timestamp),
      ts: d.data().timestamp?.seconds || 0,
    }));

    const respostas = snapR.docs.map((d) => ({
      role: "assistant",
      content: d.data().conteudo,
      time: toTime(d.data().timestamp),
      ts: d.data().timestamp?.seconds || 0,
    }));

    return [...perguntas, ...respostas].sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

/**
 * Busca documentos enviados numa conversa para restaurar docsEnviados[].
 */
export async function buscarDocumentosConversa(conversaId) {
  try {
    const snap = await getDocs(query(
      collection(db, "conversas", conversaId, "documentos"),
      orderBy("timestamp", "asc")
    ));
    const labelsMap = {
      foto_veiculo: "Foto do Veículo",
      crlv: "CRLV",
      cnh: "CNH",
      bo: "Boletim de Ocorrência",
      laudo: "Laudo / Orçamento",
    };
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        tipo: data.tipo,
        tipoLabel: labelsMap[data.tipo] || data.tipo,
        url: data.url,
        nome: data.nome,
        formato: data.formato,
        timestamp: data.timestamp,
      };
    });
  } catch {
    return [];
  }
}
