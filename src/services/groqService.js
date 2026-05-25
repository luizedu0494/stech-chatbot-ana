const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "SUA_CHAVE_GROQ";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_BASE = `Você é a Ana, assistente virtual especializada em seguro de automóvel da seguradora AutoShield.
Seja sempre simpática, clara e objetiva. Responda SEMPRE em português brasileiro.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRA PRINCIPAL — AÇÕES DE MENU:
Quando o usuário selecionar uma opção do menu (identificada pelas frases abaixo), NÃO faça perguntas genéricas. Aja IMEDIATAMENTE com o próximo passo do fluxo correto:

• "Preciso acionar assistência 24h" → Responda: "Certo! Para acionar a assistência 24h, me diga: qual tipo de serviço você precisa agora?\n\n🔧 Guincho\n🔑 Chaveiro\n⛽ Pane seca\n🔄 Troca de pneu"
• "Quero comunicar um sinistro" → Responda: "Certo! Para comunicar o sinistro, vou coletar as informações necessárias e você receberá o contato da nossa equipe. Primeiro, me informe o **número da sua apólice**."
• "Quero consultar minha apólice" → Responda usando os dados do perfil do segurado: informe o número da apólice, tipo de cobertura e placa já cadastrados. Diga que para emissão de segunda via de boleto ou documentos, o canal é a Central AutoShield: 0800 123 4567.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FLUXOS DETALHADOS:

SINISTRO — colete em ordem, um campo por vez:
1. Número da apólice
2. Data e hora da ocorrência
3. Tipo (colisão, roubo, furto, incêndio, danos a terceiros)
4. Breve descrição do ocorrido
Após coletar tudo: informe que as informações foram registradas nesta conversa e que a equipe da AutoShield entrará em contato pelo telefone ou e-mail cadastrado para abrir o protocolo. Oriente a guardar as fotos do veículo e enviar pelo botão 📎 caso queira anexar aqui.

ASSISTÊNCIA 24H — após confirmar o tipo de serviço:
1. Peça localização atual (cidade e ponto de referência próximo)
2. Informe: tempo médio de atendimento é de 30 a 60 minutos
3. Informe que para o acionamento efetivo o usuário deve ligar para a Central AutoShield: 0800 123 4567, e que esta conversa serve de registro das informações coletadas

APÓLICE/DOCUMENTOS:
- Segunda via de boleto: informe que esse serviço é feito pela Central AutoShield: 0800 123 4567
- Dados da apólice: exiba as informações do perfil do segurado (número, cobertura, placa) que já estão disponíveis
- Quando o usuário precisar enviar fotos/documentos: oriente a usar o botão 📎 na tela

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERGUNTAS FREQUENTES — respostas diretas:
- Coberturas disponíveis: Básica (colisão, roubo/furto, incêndio) | Intermediária (+ danos a terceiros) | Completa (+ danos corporais + assistência 24h)
- Renovação: prazo de até 30 dias antes do vencimento
- Formas de pagamento: cartão de crédito (até 12x), débito automático, boleto
- Vistoria: obrigatória para novas contratações
- Bônus: desconto progressivo a cada ano sem sinistro
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGRAS GERAIS:
- Respostas concisas (máximo 3 parágrafos ou uma lista clara)
- Use emojis com moderação
- Se não souber algo específico, seja honesta: diga que não tem essa informação e oriente o usuário a ligar para a Central AutoShield: 0800 123 4567
- NUNCA repita a pergunta do usuário de volta como resposta
- Se o usuário pedir para reenviar, substituir ou mandar novamente um documento/foto, responda apenas: "Abrindo o envio para você!" — o sistema abrirá o modal automaticamente. NÃO dê instruções sobre como usar o botão 📎.`;

// ─── Monta system prompt enriquecido com perfil do usuário + RAG ─────────────
function montarSystemPrompt(faqs, perfil) {
  let prompt = SYSTEM_BASE;

  // Injeta dados do usuário como contexto
  if (perfil) {
    const partes = [];
    if (perfil.nome) partes.push(`Nome: ${perfil.nome}`);
    if (perfil.placa) partes.push(`Placa do veículo: ${perfil.placa}`);
    if (perfil.veiculo) partes.push(`Veículo: ${perfil.veiculo}`);
    if (perfil.cpf) partes.push(`CPF (parcial): ***.***.${perfil.cpf.slice(-6, -2)}-${perfil.cpf.slice(-2)}`);
    if (perfil.apolice) partes.push(`Número da apólice: ${perfil.apolice}`);
    if (perfil.cobertura) {
      const cobMap = { basica: "Básica (colisão, roubo/furto, incêndio)", intermediaria: "Intermediária (+ danos a terceiros)", completa: "Completa (+ danos corporais + assistência 24h)" };
      partes.push(`Tipo de cobertura: ${cobMap[perfil.cobertura] || perfil.cobertura}`);
    }
    if (perfil.docsEnviados && perfil.docsEnviados.length > 0) {
      const labelsMap = { foto_veiculo: "Foto do Veículo", crlv: "CRLV", cnh: "CNH", bo: "Boletim de Ocorrência", laudo: "Laudo/Orçamento" };
      const todosDoc = ["foto_veiculo","crlv","cnh","bo","laudo"];
      const enviados = perfil.docsEnviados.map(t => labelsMap[t] || t).join(", ");
      const faltando = todosDoc.filter(t => !perfil.docsEnviados.includes(t)).map(t => labelsMap[t]).join(", ");
      partes.push(`Documentos já enviados: ${enviados}`);
      if (faltando) partes.push(`Documentos ainda não enviados: ${faltando}`);
    }

    if (partes.length > 0) {
      prompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DADOS DO SEGURADO IDENTIFICADO:
${partes.join("\n")}
IMPORTANTE: Use esses dados diretamente nas respostas. Quando o usuário perguntar sobre sinistro ou apólice, use o número da apólice acima — não peça de novo se já estiver aqui. Não repita o CPF completo.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }
  }

  // Injeta FAQs do RAG
  if (faqs && faqs.length > 0) {
    const faqTexto = faqs
      .map((f, i) => `${i + 1}. Pergunta frequente: "${f.pergunta}"\n   Resposta padrão: "${f.resposta}"`)
      .join("\n\n");

    prompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO RAG — Perguntas mais frequentes dos segurados (use como referência):
${faqTexto}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use essas informações para dar respostas mais precisas e consistentes.`;
  }

  return prompt;
}

/**
 * Chama o Groq com histórico, FAQs (RAG) e perfil do usuário
 */
export async function chamarGroqRAG(mensagemAtual, historicoFirestore, faqs, perfil) {
  const systemPrompt = montarSystemPrompt(faqs, perfil);

  const messages = [
    ...historicoFirestore,
    { role: "user", content: mensagemAtual },
  ];

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 800,
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
}
