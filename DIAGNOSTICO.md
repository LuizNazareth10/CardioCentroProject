# DIAGNOSTICO.md — Auditoria completa (julho/2026)

Legenda de severidade: 🔴 **Crítico** · 🟠 **Médio** · 🟡 **Baixo**
Status: ✅ corrigido nesta revisão · ⚠️ exige ação manual sua · 📋 recomendação futura

---

## 1. Segurança

| # | Sev. | Problema | Status |
|---|---|---|---|
| 1.1 | 🔴 | **Credenciais demo expostas e pré-preenchidas no login** (`admin@cardiocentro.com / cardio123` visíveis publicamente na página) | ✅ Removidas do formulário e do rodapé da página |
| 1.2 | 🔴 | **`serviceAccount.b64.txt` commitado no git** — chave da service account do GCP (acesso total ao Firestore) dentro do repositório | ✅ Removido do rastreamento (`git rm --cached`) e bloqueado no `.gitignore`. ⚠️ **AÇÃO OBRIGATÓRIA: a chave continua no HISTÓRICO do git e deve ser considerada vazada. Revogue-a e gere outra**: GCP Console → IAM → Service Accounts → chave antiga → *Delete* → criar nova → atualizar `GOOGLE_SERVICE_ACCOUNT_B64` na Vercel. Se o repositório for/foi público, faça isso HOJE. |
| 1.3 | 🔴 | **Senha padrão `cardio123` também em produção** — `scripts/seed-firestore.ts` cria o admin com a mesma senha do demo | ⚠️ Troque a senha do usuário no Firestore (gere novo hash: `node -e "console.log(require('bcryptjs').hashSync('NOVA_SENHA',10))"` e atualize o campo `senhaHash` do doc `usuarios/user_admin`) |
| 1.4 | 🟠 | `AUTH_SECRET` ausente caía em segredo de dev (`dev-secret-trocar`) mesmo em produção — qualquer um poderia forjar o cookie | ✅ Agora **falha fechada**: em produção sem `AUTH_SECRET`, login e sessões são bloqueados. ⚠️ Confirme que `AUTH_SECRET` está definida na Vercel (o build local acusou ausência) |
| 1.5 | 🟠 | Sem proteção contra força bruta no login | ✅ Rate limit 8 tentativas/10min por IP (`src/lib/rate-limit.ts`). Limitação: em serverless o contador é por instância; para limite global usar Upstash Redis (📋) |
| 1.6 | 🟠 | Páginas internas dependiam só do layout para redirecionar; nenhuma barreira extra | ✅ `src/middleware.ts` valida o JWT em todas as rotas internas (defesa em profundidade; as APIs já validavam sessão individualmente — confirmado na auditoria) |
| 1.7 | 🟠 | Sem headers de segurança (HSTS, nosniff, frame, referrer, permissions) | ✅ Adicionados em `next.config.js` para todas as rotas |
| 1.8 | 🟡 | Webhook só valida HMAC se `WHATSAPP_APP_SECRET` existir | ⚠️ Defina `WHATSAPP_APP_SECRET` na Vercel antes de conectar o número oficial |
| 1.9 | 🟡 | `images.remotePatterns` ainda permite `images.unsplash.com` (não usado) | 📋 Remover quando confirmar que nenhuma imagem remota é usada |

**Não encontrados** (verificado): SQL injection (não há SQL), XSS via `dangerouslySetInnerHTML` (só JSON-LD gerado no servidor), rotas de API sem autenticação (todas checam `lerSessao()` exceto as públicas por design), segredos no bundle do cliente.

## 2. Bugs funcionais

| # | Sev. | Problema | Status |
|---|---|---|---|
| 2.1 | 🔴 | **O formulário da landing NÃO enviava nada** — `Agendamento.tsx` simulava o envio com `setTimeout` e descartava os dados. Todo lead do site era perdido silenciosamente, mostrando "Solicitação enviada!" | ✅ Criado `POST /api/leads` (público, validado, rate-limited, honeypot anti-bot) + coleção `leads` + painel `/leads`. O formulário agora grava de verdade e trata erro de rede |
| 2.2 | 🔴 | **Sessão do agente WhatsApp em memória** — na Vercel cada invocação pode cair em outra instância; o paciente perdia o fluxo no meio da conversa (cold start = conversa zerada) | ✅ Sessões movidas para o Firestore (`wa_sessions`, TTL 30min) quando `DATA_BACKEND=firestore`; memória continua no modo dev. Testes E2E do agente passando |
| 2.3 | 🟠 | Sem páginas de erro (`error.tsx`, `not-found.tsx`) — erro de runtime derrubava a UI padrão do Next | ✅ Criadas com a identidade visual da marca + `loading.tsx` na área restrita |
| 2.4 | 🟡 | `docs/DEPLOY.md` afirma que o seed cria exames/convênios/médicos — o script só cria o usuário (dados vêm estáticos de `seed-data.ts`) | ✅ Corrigido no novo `DEPLOY.md` da raiz |

## 3. SEO

| # | Sev. | Problema | Status |
|---|---|---|---|
| 3.1 | 🟠 | `metadataBase` apontava para `cardiocentro.com.br` (domínio que não é seu); sem canonical, sem Twitter Card, OG sem imagem | ✅ Base agora usa `APP_BASE_URL` (fallback `cardiocentrojf.com.br`), canonical, OG com imagem, Twitter Card, keywords locais ("ecocardiograma juiz de fora" etc.) |
| 3.2 | 🟠 | Sem `sitemap.xml` nem `robots.txt` | ✅ Gerados dinamicamente (`app/sitemap.ts`, `app/robots.ts`); área restrita e APIs bloqueadas |
| 3.3 | 🟠 | Sem dados estruturados | ✅ JSON-LD `MedicalClinic` (endereço, telefone, horários, Instagram) na landing + `FAQPage` na seção de dúvidas |
| 3.4 | 🟠 | Login e área restrita indexáveis | ✅ `robots: noindex` via layouts + robots.txt |
| 3.5 | 🟡 | Título único para todas as páginas | ✅ Template `%s · Cardiocentro` já existia; títulos específicos em privacidade/termos/login/área |

## 4. LGPD / conformidade

| # | Sev. | Problema | Status |
|---|---|---|---|
| 4.1 | 🟠 | Footer prometia "Conformidade com a LGPD" **sem existir política de privacidade** — dados de saúde são dados sensíveis | ✅ Criadas `/privacidade` (LGPD para clínica de saúde) e `/termos` (inclui aviso "não substitui atendimento médico / emergência 192"), linkadas no footer e no formulário |
| 4.2 | 🟠 | Sem gestão de consentimento para analytics | ✅ `CookieBanner` com opt-in; GA4 (`NEXT_PUBLIC_GA_ID`) só carrega após aceite. Sem a variável, nenhum script externo é carregado |
| 4.3 | 🟡 | E-mail `cardiocentrojf@hotmail.com` pouco profissional | 📋 Após registrar o domínio, criar `contato@cardiocentrojf.com.br` (Zoho Mail gratuito — passo a passo no DEPLOY.md) e atualizar `seed-data.ts` |

## 5. Publicidade médica (CFM — Res. 2.336/2023)

| # | Sev. | Ponto | Status |
|---|---|---|---|
| 5.1 | 🟠 | O pedido original sugeria **depoimentos fictícios com nome e nota** e **promessa de "laudo em 48h"**. Depoimentos inventados e promessas de resultado/prazo não confirmadas violam as normas de publicidade médica — além de o componente `Depoimentos` já ter sido **removido da página por decisão do cliente** em commit anterior | ✅ **Não implementado de propósito.** A prova social foi construída com dados REAIS e verificáveis: seção de números (9 exames/serviços, 5 médicos, 21 convênios), seção de convênios e FAQ. O componente `Depoimentos.tsx` permanece no código para uso futuro com depoimentos reais e autorizados por escrito |
| 5.2 | 🟡 | FAQ e agente prometiam prazo de laudo? | ✅ Copy revisada: prazo "varia por exame, informado no dia" — sem promessas. Prompt do agente proíbe inventar preços/prazos |
| 5.3 | 🟡 | `crm` dos médicos está vazio em `seed-data.ts`, mas o footer diz "Corpo clínico registrado no CRM-MG" | ⚠️ Preencher os CRMs reais em `src/lib/seed-data.ts` (campo `crm`) — publicidade médica exige identificação do responsável técnico com CRM |

## 6. Performance / acessibilidade (estado bom — pontos verificados)

- ✅ `next/font` com `display: swap`; imagens via `next/image` com AVIF/WebP automáticos (a conversão de `FotoClinica.jpeg` etc. é feita pelo otimizador do Next em runtime — não é preciso converter manualmente); hero com `priority`.
- ✅ `prefers-reduced-motion` respeitado globalmente; skip-link; labels/aria nos formulários; FAQ com `<details>` nativo (teclado ok).
- ✅ First Load JS da landing: **149 kB** (bom para o conjunto de animações). Sem dependências pesadas ociosas no `package.json`.
- 📋 Melhorias futuras: lazy do iframe do mapa já existe; considerar `next/dynamic` para framer-motion se quiser reduzir ainda mais; medir Core Web Vitals no Search Console após o domínio ir ao ar.

## 7. Funcionalidades pedidas × entregues nesta revisão

| Pedido | Situação |
|---|---|
| Painel de Leads/CRM (`/leads`) | ✅ Com temperatura 🔥/🌡️/❄️, filtros, ações, CSV, link direto p/ WhatsApp |
| Métricas (`/metricas`) | ✅ 30 dias: por exame, médico, origem, desfecho (realizado/cancelado/falta), leads |
| Config do agente sem código | ✅ Liga/desliga + mensagem automática em `/configuracoes`; teste no `/simulador` já existia |
| Prompt do agente (identidade "Cardi", guardrails, empatia, escalonamento) | ✅ Reescrito com contexto completo da clínica + regra de urgência (192/SAMU) |
| Temperatura de lead automática | ✅ Agendou = 🔥 quente · pediu atendente = 🌡️ morno · formulário = morno |
| Cancelamento/remarcação pelo agente | ❌ **Mantido por telefone fixo de propósito** — é a política atual da clínica (mensagens existentes orientam ligar). Automatizar exige confirmação de identidade + regras de antecedência; roadmap abaixo |
| Lembretes 24h/2h e follow-up de laudo | 📋 Roadmap — exige *templates* aprovados pela Meta (mensagens fora da janela de 24h) + um agendador (Vercel Cron). Ver DEPLOY.md §Roadmap |
| Disparador de campanhas (`/campanhas`) | 📋 Roadmap — envio em massa fora da janela de 24h **só** com templates aprovados pela Meta e lista opt-in; implementar sem isso arrisca banimento do número. A exportação CSV do `/leads` + listas personalizadas do Meta Ads cobrem o reengajamento hoje |
| Gestão de laudos (`/laudos`) | 📋 Roadmap — exige storage (GCS) + links assinados; desenho proposto no DEPLOY.md |
| Drag-and-drop na agenda / visão semanal | 📋 Roadmap (a agenda atual já tem visão diária por médico com estados visuais) |
| Testes E2E Playwright + CI | 📋 Roadmap — hoje há `test:engine` (20 casos) e `test:agent` (E2E do fluxo de agendamento) passando |

## 8. Checklist de ações manuais (na ordem)

1. ⚠️ **Revogar e recriar a chave da service account GCP** (item 1.2) e atualizar a env na Vercel.
2. ⚠️ **Trocar a senha do admin** em produção (item 1.3).
3. ⚠️ Conferir na Vercel: `AUTH_SECRET`, `WHATSAPP_APP_SECRET`, `APP_BASE_URL=https://cardiocentrojf.com.br`.
4. ⚠️ Preencher os **CRMs reais** dos médicos em `seed-data.ts` (item 5.3).
5. Registrar `cardiocentrojf.com.br` e seguir o `DEPLOY.md`.
6. (Opcional) Criar GA4 e definir `NEXT_PUBLIC_GA_ID`.
