# 🛡️ AutoShield Chatbot — Seguro Automotivo com IA

Chatbot de atendimento ao cliente para seguro de automóvel, construído com **React + Vite**, **Firebase**, **Groq (Llama 3.3)** e **Cloudinary** para upload de documentos — tudo no **plano gratuito**.

---

## 🏗️ Arquitetura

```
src/
├── components/
│   ├── Login.jsx          # Tela de login com Google
│   ├── Onboarding.jsx     # Cadastro de CPF e Placa (novo usuário)
│   ├── Chat.jsx           # Interface principal do chatbot
│   └── UploadDocumento.jsx # Modal de upload via Cloudinary
├── services/
│   ├── firestoreService.js # CRUD no Firestore + índices de CPF/Placa
│   ├── groqService.js      # Chamada à API do Groq com RAG + perfil
│   └── cloudinaryService.js # Upload de documentos (sem Firebase Storage)
├── hooks/
│   └── useAuth.js          # Hook de autenticação Google
└── App.jsx                 # Roteamento: Login → Onboarding → Chat
```

---

## 🚀 Configuração

### 1. Clone e instale

```bash
git clone <seu-repositorio>
cd chatbot-seguro-auto
npm install
```

### 2. Configure as variáveis de ambiente

Copie o arquivo de exemplo e preencha com suas credenciais:

```bash
cp .env.example .env
```

| Variável | Onde obter |
|----------|-----------|
| `VITE_FIREBASE_*` | [Firebase Console](https://console.firebase.google.com) > Configurações do Projeto |
| `VITE_GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| `VITE_CLOUDINARY_CLOUD_NAME` | [cloudinary.com](https://cloudinary.com) > Dashboard |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary > Settings > Upload > Upload Presets |

### 3. Configure o Cloudinary (gratuito)

1. Crie conta em [cloudinary.com](https://cloudinary.com) — **grátis, sem cartão**
2. No Dashboard, copie seu **Cloud Name**
3. Vá em **Settings → Upload → Upload Presets → Add upload preset**:
   - Signing Mode: **Unsigned**
   - Nome: `seguro_auto_docs`
   - Pasta: `seguro_auto` (opcional)
4. Adicione ao `.env`:
   ```
   VITE_CLOUDINARY_CLOUD_NAME=seu_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=seguro_auto_docs
   ```

> **Limites do plano gratuito Cloudinary:** 25 GB storage + 25 GB bandwidth/mês. Suficiente para dezenas de milhares de documentos de seguro.

### 4. Configure o Firebase

No [Firebase Console](https://console.firebase.google.com):

- **Authentication** → Provedores → Google → Ativar
- **Firestore** → Criar banco em modo produção
- Copie as regras de `firestore.rules` para o Console
- Copie os índices de `firestore.indexes.json` → Firestore → Índices

### 5. Rode o projeto

```bash
npm run dev
```

---

## 🔄 Fluxo do Usuário

```
Login Google
    ↓
[Firestore] Busca perfil pelo UID
    ↓
onboarding_completo?
  ├─ NÃO → Onboarding (CPF + Placa + Modelo)
  │          ↓ verifica duplicatas nos índices
  │          ↓ salva perfil + cpf_index + placa_index
  └─ SIM → Chat
              ↓
         Menu de Triagem (antes do 1º envio):
         🚨 Assistência | 🚗 Sinistro | 📄 Apólice | 👤 Atendente
              ↓
         Chat com RAG (Groq + Firestore FAQ)
         + Upload de documentos (📎 → Cloudinary → URL no Firestore)
```

---

## 📂 Estrutura do Firestore

| Coleção | Descrição |
|---------|-----------|
| `/usuarios/{uid}` | Perfil: nome, CPF, placa, veículo, contadores |
| `/cpf_index/{cpf}` | Índice para evitar CPFs duplicados |
| `/placa_index/{placa}` | Índice para evitar placas duplicadas |
| `/conversas/{id}` | Conversa com subcoleções: perguntas, respostas, documentos |
| `/faq_aprendido/{chave}` | FAQs geradas automaticamente pelo RAG |
| `/topicos/{nome}` | Estatísticas por tópico de atendimento |

---

## 📎 Upload de Documentos

O chatbot suporta envio de:

| Documento | Formatos | Uso |
|-----------|---------|-----|
| Foto do Veículo | JPG, PNG | Vistoria, registro de sinistro |
| CRLV | JPG, PNG, PDF | Validação do veículo |
| CNH | JPG, PNG, PDF | Validação do condutor |
| Boletim de Ocorrência | JPG, PNG, PDF | Sinistro por roubo/acidente grave |
| Laudo / Orçamento | JPG, PNG, PDF | Reparo do veículo |

Os arquivos são enviados ao **Cloudinary** (upload não assinado, sem backend necessário). A URL permanente é então salva no **Firestore** dentro da conversa correspondente.

---

## 🔒 Segurança

- CPFs e Placas são validados no frontend (formato) e no Firestore (duplicatas)
- As regras do Firestore garantem que cada usuário acessa apenas seus próprios dados
- Variáveis sensíveis ficam no `.env` (nunca commitadas no Git)
- A chave da Groq está exposta no frontend — para produção, mova as chamadas para uma **Cloud Function**

---

## 📦 Deploy no Firebase Hosting (Spark gratuito)

```bash
npm run build
firebase deploy --only hosting
```
"# stech-chatbot-ana" 
