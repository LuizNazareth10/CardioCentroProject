# ARCHITECTURE.md — Mapa do projeto Cardiocentro

> Gerado na revisão completa de julho/2026. Complementa `docs/ARQUITETURA.md` (visão original) — este arquivo é o mapa atualizado pós-revisão.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js **14.2.5** (App Router) + React 18.3 + TypeScript 5.5 |
| Estilo | Tailwind CSS 3.4 (tokens da marca em `tailwind.config.ts`), framer-motion, lucide-react |
| Banco de dados | **GCP Firestore** (firebase-admin, server-only) com fallback em memória (`DATA_BACKend=memory`) |
| Autenticação | Sessão própria: bcryptjs + JWT (`jose`, HS256) em cookie httpOnly `cc_session` (12h) |
| WhatsApp | **Meta WhatsApp Cloud API** (webhook + envio); simulador interno sem Meta em `/simulador` |
| IA | **API da Anthropic** (raw fetch): `claude-haiku-4-5-20251001` (intenção) e `claude-sonnet-5` (visão — foto do pedido médico). Fallback por palavras-chave sem chave |
| Hospedagem | Vercel (região `gru1`), projeto GCP `cardiocentro-pipeline` |

## Estrutura de pastas

```
cardiocentro/
├── ARCHITECTURE.md / DIAGNOSTICO.md / DEPLOY.md /          ← entregáveis da revisão
│   ESTRATEGIA-TRAFEGO-PAGO.md / CHANGELOG.md
├── docs/                          ← documentação original (ARQUITETURA, CUSTOS, DECISOES, DEPLOY)
├── firestore.rules                ← nega todo acesso client-side (admin SDK ignora)
├── firestore.indexes.json         ← índices compostos (agendamentos, triagens)
├── next.config.js                 ← imagens AVIF/WebP + headers de segurança (HSTS etc.)
├── vercel.json                    ← região gru1 + no-store nas APIs
├── scripts/
│   ├── seed-firestore.ts          ← cria usuário admin no Firestore (rodar 1x)
│   ├── test-engine.ts             ← 20 testes do motor de agenda
│   ├── test-agent.ts              ← teste E2E do agente WhatsApp
│   └── chat-agent.ts              ← chat com o agente no terminal
├── public/img/                    ← fotos reais da clínica + imagens de apoio
└── src/
    ├── middleware.ts              ← [NOVO] defesa em profundidade: JWT em todas as páginas internas
    ├── app/
    │   ├── layout.tsx             ← fontes, metadata global (OG/Twitter/canonical), CookieBanner
    │   ├── page.tsx               ← landing (+ JSON-LD MedicalClinic)
    │   ├── sitemap.ts / robots.ts ← [NOVO] SEO
    │   ├── error.tsx / not-found.tsx  ← [NOVO] páginas de erro
    │   ├── privacidade/ termos/   ← [NOVO] páginas LGPD
    │   ├── login/                 ← login (layout com noindex)
    │   ├── (app)/                 ← ÁREA RESTRITA (layout exige sessão + noindex)
    │   │   ├── dashboard/  agenda/  agendar/  pacientes/  pacientes/[id]/  pacientes/novo/
    │   │   ├── atendimentos/      ← fila humana do WhatsApp (handoff)
    │   │   ├── leads/             ← [NOVO] CRM básico (temperatura, status, CSV)
    │   │   ├── metricas/          ← [NOVO] métricas 30 dias
    │   │   ├── simulador/         ← chat de teste do agente (sem Meta)
    │   │   ├── configuracoes/     ← exames/convênios/contato + [NOVO] liga/desliga do agente
    │   │   └── loading.tsx        ← [NOVO] skeleton
    │   └── api/
    │       ├── auth/              ← login/logout (POST com rate limit, DELETE)
    │       ├── agendamentos/      ← GET/POST/PATCH (auth; revalida conflito no servidor)
    │       ├── disponibilidade/   ← GET slots do motor (auth)
    │       ├── pacientes/ [id]/   ← CRUD sanitizado (auth)
    │       ├── atendimentos/ [telefone]/ ← fila humana (auth)
    │       ├── leads/             ← [NOVO] POST público (rate limit + honeypot) · GET/PATCH (auth)
    │       ├── config/            ← GET/PUT configurações da clínica (auth)
    │       └── whatsapp/
    │           ├── webhook/       ← Meta (GET verify, POST HMAC) + modo manual do agente
    │           └── simular/       ← roda o agente capturando saídas (auth)
    ├── components/
    │   ├── Sidebar.tsx  Logo.tsx  FichaIdentidadePrint.tsx
    │   ├── CookieBanner.tsx       ← [NOVO] consentimento LGPD + GA4 opt-in
    │   └── landing/               ← Header, Hero, Numeros[NOVO], Especialidades, Sobre,
    │       CorpoMedico, Diferenciais, Convenios[NOVO], Faq[NOVO], Agendamento (form real),
    │       Footer, FloatingWhatsApp[NOVO], Depoimentos (fora do ar — decisão do cliente/CFM),
    │       Reveal, BrandLogo, content.ts (copy centralizada)
    └── lib/
        ├── seed-data.ts           ← FONTE ÚNICA: exames, aparelhos, convênios, médicos, contato
        ├── clinic-config.ts       ← overrides no Firestore (exames/convênios/contato/agente)
        ├── types.ts               ← domínio (Paciente, Agendamento, Triagem, Lead[NOVO], Conversa…)
        ├── validation.ts          ← sanitização (paciente, triagem, lead[NOVO])
        ├── auth.ts                ← bcrypt + JWT (falha fechada sem AUTH_SECRET em produção)
        ├── rate-limit.ts          ← [NOVO] janela deslizante por IP
        ├── env.ts                 ← checagem de variáveis no boot
        ├── format.ts              ← datas/horas pt-BR
        ├── db/
        │   ├── index.ts           ← API única de dados (memory ⇄ firestore)
        │   ├── firestore.ts       ← conexão Admin SDK
        │   └── store.ts           ← store em memória com dados fictícios de demo
        ├── scheduling/
        │   ├── engine.ts          ← gerarSlots / gerarSlotsAparelho / proporSessao
        │   └── time.ts            ← grade 15min, quinzenal (ref. 2026-07-08)
        └── whatsapp/
            ├── agent.ts           ← máquina de estados da conversa (+ leads, urgência)
            ├── ai.ts              ← intenção (Haiku) + leitura de pedido médico (Sonnet 5)
            ├── session.ts         ← estado por telefone — Firestore `wa_sessions` [NOVO] ou memória
            ├── client.ts          ← Cloud API da Meta + captura p/ simulador
            └── messages.ts        ← toda a copy do agente (inclui urgência [NOVO])
```

## Endpoints de API

| Rota | Método | Auth | Descrição |
|---|---|---|---|
| `/api/auth` | POST | — (rate limit 8/10min/IP) | Login → cookie `cc_session` |
| `/api/auth` | DELETE | cookie | Logout |
| `/api/leads` | POST | — (rate limit 5/10min/IP + honeypot) | Lead do formulário da landing |
| `/api/leads` | GET / PATCH | cookie | Listar / atualizar status·temperatura·observação |
| `/api/agendamentos` | GET/POST/PATCH | cookie | Agenda (POST revalida conflito) |
| `/api/disponibilidade` | GET | cookie | Slots do motor (exames, médico, período) |
| `/api/pacientes` (+`/[id]`) | GET/POST/PATCH | cookie | Cadastro sanitizado |
| `/api/atendimentos` (+`/[telefone]`) | GET/POST/PATCH | cookie | Fila humana do WhatsApp |
| `/api/config` | GET/PUT | cookie | Config da clínica (exames, convênios, contato, agente) |
| `/api/whatsapp/webhook` | GET | token Meta | Verificação do webhook |
| `/api/whatsapp/webhook` | POST | HMAC (X-Hub-Signature-256) | Mensagens; respeita liga/desliga do agente |
| `/api/whatsapp/simular` | POST | cookie | Simulador do agente |

## Coleções do Firestore

`usuarios` · `pacientes` · `agendamentos` · `triagens` · `conversas` (handoff) · `leads` [NOVO] · `wa_sessions` [NOVO — estado do agente] · `config/clinic` (overrides).

## Variáveis de ambiente

Ver `.env.example`. Obrigatórias em produção: `AUTH_SECRET`, `DATA_BACKEND=firestore`, `GCP_PROJECT_ID`, `GOOGLE_SERVICE_ACCOUNT_B64`, `APP_BASE_URL`. WhatsApp: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`. Opcionais: `ANTHROPIC_API_KEY` (IA), `NEXT_PUBLIC_GA_ID` (analytics com consentimento).

## Fluxos principais

1. **Lead da landing** → `POST /api/leads` (validação + honeypot + rate limit) → coleção `leads` → painel `/leads` (contatado/agendado/arquivado, CSV).
2. **Agendamento WhatsApp** → webhook → (config `agente.ativo`?) → máquina de estados (`agent.ts`) com sessão em `wa_sessions` → motor de agenda → grava `agendamentos` + lead 🔥 → confirmação + orientações de preparo.
3. **Handoff humano** → etapa `humano` na sessão → conversa em `conversas` → painel `/atendimentos` responde → simulador/paciente recebe.
4. **Urgência** → IA/palavras-chave detectam sintoma agudo → mensagem 192/SAMU → handoff imediato.
