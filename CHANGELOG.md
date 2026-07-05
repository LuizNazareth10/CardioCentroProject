# CHANGELOG.md — Revisão total (julho/2026)

Formato: **O quê** · *Por quê* · Como.

## Segurança

- **Removidas as credenciais demo do login** (`src/app/login/page.tsx`). *Credenciais válidas expostas publicamente.* Campos agora iniciam vazios; dica substituída por orientação neutra.
- **`serviceAccount.b64.txt` fora do git** (`git rm --cached` + `.gitignore` com `serviceAccount*.txt`/`*.b64.txt`). *Chave GCP commitada = vazamento.* ⚠️ Chave deve ser revogada (DIAGNOSTICO 1.2).
- **`AUTH_SECRET` obrigatória em produção** (`src/lib/auth.ts`). *Antes caía num segredo de dev previsível; cookies podiam ser forjados.* Agora lança erro (fail-closed) em produção.
- **Novo `src/middleware.ts`**. *Defesa em profundidade para páginas internas.* Valida o JWT (jose/Edge) em `/dashboard|agenda|agendar|pacientes|atendimentos|simulador|configuracoes|leads|metricas`; cookie inválido é apagado e redireciona a `/login`.
- **Rate limiting** (`src/lib/rate-limit.ts` novo). *Força bruta no login e spam no formulário público.* Janela deslizante por IP: login 8/10min, leads 5/10min. Aplicado em `api/auth` (que também passou a validar o corpo) e `api/leads`.
- **Headers de segurança globais** (`next.config.js`): HSTS, `X-Content-Type-Options`, `X-Frame-Options SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`.

## Captura de leads (bug crítico corrigido)

- **Formulário da landing agora envia de verdade** (`src/components/landing/Agendamento.tsx`). *O envio era simulado com `setTimeout`; todos os leads eram perdidos.* POST real para `/api/leads`, estado de erro visível, máscara de telefone BR progressiva, campos novos (data preferencial com `min=hoje`, turno), honeypot anti-bot invisível, aviso LGPD com link para `/privacidade`, botão "Como chegar" no mapa.
- **Novo domínio `Lead`** (`src/lib/types.ts`), persistência memory+Firestore (`src/lib/db/{index,store}.ts` — coleção `leads`), sanitização estrita (`sanitizarLeadFormulario` em `src/lib/validation.ts`).
- **Nova rota `/api/leads`**: POST público (validação + honeypot + rate limit), GET/PATCH autenticados.

## Landing page

- **Copy do hero** (`Hero.tsx`): título e subtítulo específicos (exames nomeados + "agendamento pelo WhatsApp em menos de 1 minuto"), CTAs acionáveis ("Quero agendar meu exame"). Pill: "Diagnóstico cardiológico completo no Centro de Juiz de Fora". *Textos vagos convertem menos; tudo dentro das normas do CFM (sem promessas de prazo/resultado).*
- **Nova seção Números** (`Numeros.tsx`): contadores animados (IntersectionObserver, respeita `prefers-reduced-motion`) com dados REAIS derivados de `seed-data`/`content` (9 exames/serviços, 5 médicos, 21 convênios, 1 min WhatsApp).
- **Nova seção Convênios** (`Convenios.tsx`): chips com os 21 convênios reais (fonte única `seed-data.ts`) + CTA de confirmação via WhatsApp. *Convênio é a objeção nº 1 do público 45–70.*
- **Nova seção FAQ** (`Faq.tsx`): 8 perguntas com `<details>` nativo (acessível) + **JSON-LD FAQPage**. Respostas alinhadas às regras reais (pedido médico obrigatório, cancelamento por telefone, prazo de laudo "informado no dia").
- **Botão flutuante de WhatsApp** (`FloatingWhatsApp.tsx`): FAB fixo com anel de pulso e rótulo no hover (desktop), visível também no mobile.
- **Depoimentos NÃO reativados** — o componente havia sido removido da página por decisão do cliente; depoimentos fictícios violariam a Res. CFM 2.336/2023. Prova social ficou a cargo de Números/Convênios/FAQ.
- **Sobre** com dados concretos (linha completa, +20 convênios) mantendo o fechamento emocional original. **Footer** com links de Privacidade/Termos. **Header** CTA "Agendar agora". Nav ganhou "Dúvidas" (#faq).
- `page.tsx` remontada: Hero → Números → Exames → Sobre → Corpo médico → Diferenciais → Convênios → FAQ → Agendamento (+ JSON-LD `MedicalClinic`, + FloatingWhatsApp).

## SEO

- `src/app/layout.tsx`: `metadataBase` dinâmico via `APP_BASE_URL` (fallback `https://cardiocentrojf.com.br`), description com termos locais, canonical, Open Graph com imagem, Twitter Card, `themeColor`.
- Novos `src/app/sitemap.ts` e `src/app/robots.ts` (área restrita/login/APIs bloqueados; sitemap com páginas públicas).
- `noindex` no login (`login/layout.tsx` novo) e em toda a área restrita (`(app)/layout.tsx`).

## LGPD

- Novas páginas **`/privacidade`** (política completa para clínica de saúde: dados coletados, bases legais, compartilhamento, prazos, direitos, DPO) e **`/termos`** (inclui "não substitui atendimento médico; emergência → 192").
- **`CookieBanner.tsx`** novo: opt-in de analytics; GA4 (`NEXT_PUBLIC_GA_ID`) só carrega após aceite; não aparece na área interna. `.env.example` documenta a variável.

## Tratamento de erros

- Novos `src/app/error.tsx` (Error Boundary global com "Tentar novamente" + digest), `src/app/not-found.tsx` (404 da marca) e `(app)/loading.tsx` (skeleton).

## Agente de WhatsApp

- **Sessões persistentes** (`src/lib/whatsapp/session.ts` reescrito): coleção `wa_sessions` no Firestore com TTL 30min quando `DATA_BACKEND=firestore`. *Em serverless a memória não sobrevive entre invocações — conversas quebravam no meio.* API virou assíncrona; `agent.ts` e `api/whatsapp/simular` adaptados. Testes E2E do agente passando.
- **System prompt reescrito** (`ai.ts`): identidade "Cardi", contexto completo real (endereço, horários, convênios, exames com preparo, médicos, política de cancelamento por telefone), guardrails obrigatórios: nunca diagnosticar/prescrever, nunca inventar preço/prazo, empatia antes de agendamento quando houver medo/ansiedade, escalar reclamação/reembolso.
- **Detecção de urgência** (nova intenção `urgencia` na IA e no fallback por palavras-chave): sintomas agudos → mensagem orientando pronto-socorro/**192 SAMU** (`mensagemUrgencia` em `messages.ts`) + transferência imediata para humano. *Segurança do paciente acima de conversão.*
- **Temperatura de lead automática**: confirmou agendamento → lead 🔥 `quente/agendado`; pediu atendente → 🌡️ `morno` (função `registrarLeadWhatsapp` com dedupe por telefone e regra "nunca rebaixa quem agendou").
- **Liga/desliga do agente sem deploy**: `AgenteConfig` em `clinic-config.ts` (+ `api/config`), toggle e mensagem automática em `/configuracoes`; o webhook em modo manual manda tudo para a fila humana e responde com a mensagem configurada.

## Área restrita

- **Nova página `/leads`**: contadores por temperatura (clicáveis como filtro), busca, filtros de status, ações (contatado/agendou/arquivar/restaurar, temperatura), link "Abrir WhatsApp", exportação **CSV** (separador `;` + BOM p/ Excel).
- **Nova página `/metricas`**: exames hoje/7d/30d, leads ativos; barras por exame, por médico e por origem (um matiz da marca, rótulos diretos); desfecho com cores de estado + rótulos (realizado/confirmado/cancelado/falta) e percentuais; leads por temperatura.
- **Sidebar** com "Leads" e "Métricas" (ícones novos).
- **Configurações**: seção "Agente de WhatsApp" (toggle + mensagem fora do ar + atalho para o simulador).

## Documentação

- Novos na raiz: `ARCHITECTURE.md`, `DIAGNOSTICO.md`, `DEPLOY.md` (decisão de infra + domínio cardiocentrojf.com.br + e-mail profissional + roadmap), `ESTRATEGIA-TRAFEGO-PAGO.md`, `CHANGELOG.md` (este arquivo).

## Decisões e trade-offs registrados

1. **Não migrar para Railway/Neon(Postgres)**: o app é Firestore de ponta a ponta; a troca seria uma reescrita sem ganho. Recomendação: Vercel + domínio (ou Cloud Run) — ver DEPLOY.md §1.
2. **Cancelamento/remarcação continua por telefone**: política atual da clínica embutida nas mensagens; automatizar exige identidade + antecedência (roadmap).
3. **Campanhas em massa e lembretes não implementados nesta rodada**: dependem de templates aprovados pela Meta e cron; implementar sem isso arrisca o número. Desenho pronto no DEPLOY.md §5.
4. **Rate limit em memória**: suficiente contra abuso comum; limite global exigiria Redis (documentado).
5. **Modelos de IA mantidos** (Haiku 4.5 para intenção/latência, Sonnet 5 para visão): adequados ao caso de uso e ao custo; IDs validados como atuais.

## Verificação executada

- `npm run build` ✅ (28 rotas, middleware, sitemap/robots gerados)
- `npm run test:engine` ✅ 20/20 casos do motor de agenda
- `npm run test:agent` ✅ fluxo E2E de agendamento pelo agente (com a nova sessão assíncrona)
- Smoke test manual do endpoint público de leads (ver seção de verificação no relatório final)
