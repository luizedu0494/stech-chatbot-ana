// ══════════════════════════════════════════════════════════════════════════════
// CLOUDINARY SERVICE — Upload gratuito sem Firebase Storage
//
// COMO CONFIGURAR (uma vez só):
// 1. Crie conta gratuita em https://cloudinary.com
// 2. No Dashboard, copie: Cloud Name
// 3. Vá em Settings > Upload > Upload Presets > Add upload preset
//    - Signing Mode: UNSIGNED
//    - Dê o nome: "seguro_auto_docs"
//    - Pasta: seguro_auto
//    - Salve
// 4. Coloque suas credenciais no .env:
//    VITE_CLOUDINARY_CLOUD_NAME=seu_cloud_name
//    VITE_CLOUDINARY_UPLOAD_PRESET=seguro_auto_docs
//
// LIMITES DO PLANO GRATUITO:
// - 25 GB de armazenamento
// - 25 GB de largura de banda/mês
// - Suficiente para MILHARES de documentos de seguro
// ══════════════════════════════════════════════════════════════════════════════

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "SEU_CLOUD_NAME";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "seguro_auto_docs";

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

// Tipos permitidos e seus limites
const TIPOS_PERMITIDOS = {
  "image/jpeg": { label: "JPG", maxMB: 10 },
  "image/png": { label: "PNG", maxMB: 10 },
  "image/webp": { label: "WEBP", maxMB: 10 },
  "application/pdf": { label: "PDF", maxMB: 20 },
};

/**
 * Valida o arquivo antes do upload
 */
function validarArquivo(arquivo) {
  const tipo = TIPOS_PERMITIDOS[arquivo.type];
  if (!tipo) {
    throw new Error(`Tipo não suportado. Envie: JPG, PNG ou PDF.`);
  }
  const maxBytes = tipo.maxMB * 1024 * 1024;
  if (arquivo.size > maxBytes) {
    throw new Error(`Arquivo muito grande. Máximo: ${tipo.maxMB}MB para ${tipo.label}.`);
  }
  return tipo;
}

/**
 * Faz o upload de um arquivo para o Cloudinary
 * @param {File} arquivo - O arquivo selecionado pelo usuário
 * @param {string} userId - UID do Firebase para organizar a pasta
 * @param {string} tipoDocumento - Ex: "foto_veiculo", "cnh", "bo", "crlv"
 * @param {Function} onProgress - Callback de progresso (0-100)
 * @returns {Promise<{url: string, publicId: string, tipo: string, nome: string, tamanho: number}>}
 */
export async function uploadDocumento(arquivo, userId, tipoDocumento, onProgress) {
  validarArquivo(arquivo);

  const formData = new FormData();
  formData.append("file", arquivo);
  formData.append("upload_preset", UPLOAD_PRESET);
  // Organiza por usuário e tipo de documento
  formData.append("folder", `seguro_auto/${userId}/${tipoDocumento}`);
  // Tag para buscar depois
  formData.append("tags", `uid_${userId},doc_${tipoDocumento},seguro_auto`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve({
          url: data.secure_url,          // URL HTTPS permanente
          publicId: data.public_id,      // ID para deletar depois se precisar
          tipo: tipoDocumento,
          nome: arquivo.name,
          tamanho: arquivo.size,
          formato: data.format,
          largura: data.width || null,
          altura: data.height || null,
        });
      } else {
        reject(new Error(`Erro no upload: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Falha na conexão durante o upload.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelado.")));

    xhr.open("POST", UPLOAD_URL);
    xhr.send(formData);
  });
}

/**
 * Tipos de documentos que o chatbot pode solicitar
 */
export const TIPOS_DOCUMENTO = {
  foto_veiculo: {
    label: "Foto do Veículo",
    emoji: "🚗",
    descricao: "Foto do carro (dano, placa ou panorâmica)",
    aceita: "image/*",
  },
  crlv: {
    label: "CRLV",
    emoji: "📋",
    descricao: "Documento do veículo (Certificado de Registro)",
    aceita: "image/*,application/pdf",
  },
  cnh: {
    label: "CNH",
    emoji: "🪪",
    descricao: "Carteira Nacional de Habilitação",
    aceita: "image/*,application/pdf",
  },
  bo: {
    label: "Boletim de Ocorrência",
    emoji: "🚔",
    descricao: "B.O. do acidente ou roubo",
    aceita: "image/*,application/pdf",
  },
  laudo: {
    label: "Laudo / Orçamento",
    emoji: "🔧",
    descricao: "Orçamento da oficina ou laudo técnico",
    aceita: "image/*,application/pdf",
  },
};

/**
 * Formata tamanho do arquivo para exibição
 */
export function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
