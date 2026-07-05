# DEPLOY.md — Infraestrutura, domínio e custos

> Substitui/complementa `docs/DEPLOY.md` (setup original GCP+Vercel, que continua válido para o passo a passo de Firestore/service account/webhook). Este documento cobre a **decisão de infraestrutura**, o **domínio cardiocentrojf.com.br** e o **roadmap**.

## 1. Decisão de infraestrutura (com trade-offs)

O pedido original sugeria migrar para Railway + **Neon (Postgres)** + Cloudflare. **Não recomendo**: a aplicação usa **Firestore** — trocar para Postgres significaria reescrever toda a camada de dados (`src/lib/db`) e o estado do agente, sem ganho funcional. As opções reais:

| Opção | Custo/mês | Esforço | Quando escolher |
|---|---|---|---|
| **A. Vercel (atual) + domínio próprio** ✅ recomendada agora | R$ 0 (Hobby) ou US$ 20 (Pro) | ~1h | Já funciona; deploy automático por git; domínio custom é grátis. **Atenção:** uso comercial formalmente exige o plano Pro nos termos da Vercel. Hobby: 100 GB de banda/mês — muito acima do tráfego esperado de uma clínica local |
| **B. Google Cloud Run (mesmo GCP do Firestore)** | ≈ R$ 0 (free tier 2M req/mês) | ~1 dia | Se quiser custo zero "oficial" para uso comercial e latência mínima com o Firestore (mesma região). Comandos prontos em `docs/DEPLOY.md` §Alternativa |
| C. VPS (Hostinger/Contabo) com Docker | R$ 50–100 | vários dias + manutenção contínua (SO, SSL, backups, segurança) | Só se houver exigência de infraestrutura própria. Para uma clínica, o custo de manutenção supera o benefício |

**Plano recomendado:** manter a Vercel hoje (opção A, plano Pro quando o site oficial for ao ar), reavaliar Cloud Run (opção B) se o custo do Pro incomodar. O Firestore permanece nos dois casos — free tier: 50k leituras/dia, 20k escritas/dia, 1 GiB — folgado para a operação da clínica (estimativas em `docs/CUSTOS.md`).

## 2. Domínio cardiocentrojf.com.br (passo a passo)

1. **Registrar** em [registro.br](https://registro.br) (≈ R$ 40/ano). CNPJ ou CPF do responsável.
2. **Vercel** → Project → Settings → **Domains** → Add:
   - `cardiocentrojf.com.br` (principal) e `www.cardiocentrojf.com.br`.
   - A Vercel mostra os registros a criar. No painel DNS do registro.br:
     - `A @ 76.76.21.21`
     - `CNAME www cname.vercel-dns.com`
   - Marque `www` → **Redirect to** `cardiocentrojf.com.br` (308) no painel da Vercel — isso resolve o redirecionamento www→apex.
3. **HTTPS/SSL**: automático na Vercel (Let's Encrypt, renovação automática). HTTP→HTTPS já é forçado pela plataforma; **HSTS** já está configurado no `next.config.js`.
4. **Variável de ambiente**: `APP_BASE_URL=https://cardiocentrojf.com.br` (Production) → redeploy. Isso ajusta canonical, OG, sitemap e robots automaticamente (o código já lê essa variável).
5. **Google Search Console**: adicionar propriedade "Domínio" (verificação por TXT no DNS) → enviar `https://cardiocentrojf.com.br/sitemap.xml` → pedir indexação da home.
6. **Google Business Profile**: atualizar o site do perfil da clínica para o novo domínio (impacto direto em busca local).
7. *(Opcional)* **Cloudflare** na frente (DNS + proxy grátis): apontar nameservers do registro.br para a Cloudflare e lá criar os registros acima. Ganha cache/WAF; adiciona um ponto de configuração. Não é necessário no início.

## 3. E-mail profissional (contato@cardiocentrojf.com.br)

Com o domínio registrado — **Zoho Mail Forever Free** (até 5 caixas):
1. Criar conta em zoho.com/mail → adicionar domínio `cardiocentrojf.com.br`.
2. Verificar via TXT; criar caixa `contato@`.
3. DNS no registro.br: registros **MX** (`mx.zoho.com`, `mx2.zoho.com`, `mx3.zoho.com`), **SPF** `v=spf1 include:zoho.com ~all` e **DKIM** (gerado no painel Zoho).
4. Configurar encaminhamento do `cardiocentrojf@hotmail.com` para a caixa nova durante a transição.
5. Atualizar `email` em `src/lib/seed-data.ts` (CONTATO) e redeploy — landing, ficha e políticas atualizam sozinhas.

## 4. Checklist antes de ir ao ar com o domínio

- [ ] Chave GCP antiga **revogada** e nova em `GOOGLE_SERVICE_ACCOUNT_B64` (ver DIAGNOSTICO 1.2)
- [ ] Senha do admin trocada no Firestore (DIAGNOSTICO 1.3)
- [ ] `AUTH_SECRET` forte definida (Production) — sem ela o login agora **bloqueia** de propósito
- [ ] `APP_BASE_URL=https://cardiocentrojf.com.br`
- [ ] `DATA_BACKEND=firestore`, `GCP_PROJECT_ID`, `GOOGLE_SERVICE_ACCOUNT_B64` conferidos
- [ ] `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` definidos; webhook da Meta apontando para `https://cardiocentrojf.com.br/api/whatsapp/webhook`
- [ ] `ANTHROPIC_API_KEY` definida (senão o agente cai no modo palavras-chave e não lê pedido por foto)
- [ ] CRMs dos médicos preenchidos em `seed-data.ts`
- [ ] HTTPS ok, `www` redirecionando, `/sitemap.xml` e `/robots.txt` respondendo
- [ ] Formulário da landing gravando lead (testar e conferir em `/leads`)
- [ ] Simulador (`/simulador`): fluxo completo de agendamento + "quero falar com atendente" + frase de urgência
- [ ] Login só com credenciais reais; `/dashboard` inacessível deslogado (middleware)
- [ ] Search Console verificado + sitemap enviado
- [ ] (Se usar GA4) `NEXT_PUBLIC_GA_ID` definido — só carrega após consentimento no banner
- [ ] Backup: exportação do Firestore agendada (GCP Console → Firestore → Import/Export → agendar para bucket GCS) e restauração testada 1x

## 5. Roadmap técnico (desenho das próximas features)

**Lembretes 24h/2h + follow-up (WhatsApp)**
1. Criar *message templates* no Meta Business (ex.: `lembrete_exame_24h`) — mensagens fora da janela de 24h exigem template aprovado.
2. Adicionar `vercel.json` → `crons` (ex.: a cada 30min chamar `/api/cron/lembretes` protegida por `CRON_SECRET`).
3. A rota varre `agendamentos` de amanhã/2h sem flag `lembrete24hEnviado` → envia template → marca a flag.

**Campanhas de reengajamento (`/dashboard/campanhas`)**
- Pré-requisitos de compliance: lista **opt-in**, templates de marketing aprovados pela Meta, limite de envio/hora (tier do número), opção de descadastro. Sem isso há risco real de banimento do número.
- Alternativa imediata já disponível: exportar CSV do `/leads` → criar Público Personalizado no Meta Ads (remarketing pago, sem risco ao número).

**Gestão de laudos (`/dashboard/laudos`)**
- Upload de PDF → bucket GCS privado → salvar metadados em `laudos` (pacienteId, exameId, data) → gerar **URL assinada** (validade 7 dias) → enviar por template WhatsApp. Sem endpoint público de arquivos.

**Testes E2E + CI**
- Playwright: fluxos formulário→lead, login, agendamento manual, simulador. GitHub Actions: `npm run build && npm run test:engine && npm run test:agent` a cada push; deploy da Vercel condicionado ao check.

**Monitoramento**
- UptimeRobot (grátis) em `https://cardiocentrojf.com.br` + `/api/whatsapp/webhook` (GET retorna 403 — usar keyword monitoring), alerta por e-mail.
- Sentry (plano free) para erros de runtime — o hook está pronto em `src/app/error.tsx`.
- Microsoft Clarity (grátis) para heatmaps — carregar via CookieBanner (mesmo padrão do GA4) se decidir usar.
