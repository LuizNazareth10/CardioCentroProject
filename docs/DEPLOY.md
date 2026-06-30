# Guia de Deploy

## Pré-requisitos

- Conta Google Cloud (GCP) com projeto criado
- Conta Vercel Pro (uso comercial)
- Conta Meta Business verificada + número de WhatsApp Business
- Node.js 22+

---

## 1. GCP — Configurar o Firestore

```bash
# Instalar o SDK do Google Cloud se ainda não tiver
brew install google-cloud-sdk   # macOS
# ou siga https://cloud.google.com/sdk/docs/install

# Criar o projeto (ou usar um existente)
gcloud projects create cardiocentro-agenda --name="CardioCentro Agenda"
gcloud config set project cardiocentro-agenda

# Ativar as APIs necessárias
gcloud services enable firestore.googleapis.com

# Criar o banco Firestore (modo Native, região mais próxima do Brasil)
gcloud firestore databases create --location=southamerica-east1

# Aplicar as regras de segurança
gcloud firestore deploy --rules=firestore.rules

# Aplicar os índices
gcloud firestore indexes create --index-file=firestore.indexes.json
```

## 2. GCP — Criar Service Account

```bash
# Criar a service account
gcloud iam service-accounts create cardiocentro-backend \
  --display-name="CardioCentro Backend"

# Dar permissão ao Firestore
gcloud projects add-iam-policy-binding cardiocentro-agenda \
  --member="serviceAccount:cardiocentro-backend@cardiocentro-agenda.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# Baixar a chave JSON
gcloud iam service-accounts keys create serviceAccount.json \
  --iam-account=cardiocentro-backend@cardiocentro-agenda.iam.gserviceaccount.com

# Converter para base64 (para usar como variável de ambiente)
base64 -w 0 serviceAccount.json   # Linux
base64 -i serviceAccount.json     # macOS

# IMPORTANTE: não commitar serviceAccount.json (já está no .gitignore)
```

## 3. Vercel — Deploy do app

```bash
npm install -g vercel
vercel login

cd /caminho/do/projeto
vercel

# Durante o setup interativo:
#   - Framework: Next.js (detectado automaticamente)
#   - Build Command: npm run build
#   - Output Directory: .next
```

### Variáveis de ambiente na Vercel

No painel Vercel → Project → Settings → Environment Variables, adicione:

| Variável | Valor |
|----------|-------|
| `APP_BASE_URL` | `https://seu-dominio.vercel.app` |
| `AUTH_SECRET` | `openssl rand -base64 32` (gere e copie) |
| `DATA_BACKEND` | `firestore` |
| `GCP_PROJECT_ID` | `cardiocentro-agenda` |
| `GOOGLE_SERVICE_ACCOUNT_B64` | output do `base64` do passo 2 |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | do Firebase Console → Configurações do projeto |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `cardiocentro-agenda` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | do Firebase Console |
| `WHATSAPP_VERIFY_TOKEN` | qualquer string aleatória (você define) |
| `WHATSAPP_ACCESS_TOKEN` | do painel Meta for Developers |
| `WHATSAPP_PHONE_NUMBER_ID` | do painel Meta for Developers |
| `ANTHROPIC_API_KEY` | de console.anthropic.com |

```bash
# Após configurar as vars, redeploy
vercel --prod
```

## 4. WhatsApp — Configurar o webhook na Meta

1. Acesse [developers.facebook.com](https://developers.facebook.com) → Seu app → WhatsApp → Configuração
2. Em **Webhook**, clique em **Editar**:
   - URL do webhook: `https://seu-dominio.vercel.app/api/whatsapp/webhook`
   - Token de verificação: o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
3. Assine os eventos: `messages`
4. Clique em **Verificar e salvar** — o Next.js vai responder o challenge automaticamente

## 5. Popular o Firestore com os dados iniciais

```bash
# Localmente, com GOOGLE_SERVICE_ACCOUNT_B64 no .env.local:
npm run seed
```

O script `scripts/seed-firestore.ts` cria:
- O usuário admin (mesma senha do demo)
- Os exames, convênios e médicos da seed-data

## 6. Domínio próprio (opcional)

Na Vercel → Domains → Add Domain: `agenda.cardiocentro.com.br`
Configure o CNAME no seu registrador apontando para `cname.vercel-dns.com`.

---

## Alternativa: Cloud Run em vez da Vercel (custo ≈ R$ 0)

```bash
# Criar imagem Docker
gcloud run deploy cardiocentro \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --set-env-vars DATA_BACKEND=firestore,AUTH_SECRET=...,GCP_PROJECT_ID=...

# O Cloud Run usa Application Default Credentials — não precisa de service account
# externa, use gcloud auth application-default login em CI/CD
```

Vantagens: custo zero no free tier (2M req/mês), mesma região do Firestore (latência mínima).
Desvantagem: o CI/CD automático é mais manual que a integração Git da Vercel.

---

## Fluxo de atualização contínua

Após o setup:

```bash
git add . && git commit -m "feat: atualização"
git push origin main
# Vercel detecta e redeploy automaticamente
```
