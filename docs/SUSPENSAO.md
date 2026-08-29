# Suspensão da operação — agosto/2026

> **Estado atual: SUSPENSO desde 18/08/2026.**
> No ar apenas a **landing page pública** (`/`, `/privacidade`, `/termos`).
> Fora do ar: agente de IA do WhatsApp e área restrita inteira.

Nada foi excluído. Nem código, nem dados do Firestore, nem os volumes do
Docker na VPS. Isto é um **interruptor**, e este documento é o caminho de
volta.

---

## O que foi desligado, e onde

| # | Camada | Estado | Onde vive |
|---|--------|--------|-----------|
| 1 | Rollout do agente | `paused` (era `canary 80%`) | Firestore `config/clinic` |
| 2 | VM da Evolution API | `TERMINATED` | GCP `cardiocentro-pipeline`, `evolution-vps`, zona `us-east1-b` |
| 3 | IP estático `35.211.31.176` | **liberado** | GCP — reserva `evolution-ip` excluída |
| 4 | Área restrita + todo `/api/*` | 503 / redireciona para `/` | `src/middleware.ts` |
| 5 | Cron diário de lembretes | removido | `vercel.json` |
| 6 | Formulário de leads da landing | trocado por CTA de WhatsApp/telefone | `src/components/landing/Agendamento.tsx` |

O interruptor de 4 e 6 é uma constante só: `OPERACAO_SUSPENSA`, em
[`src/lib/suspensao.ts`](../src/lib/suspensao.ts). Ela é `true` por padrão —
**fail-safe**: variável esquecida mantém tudo desligado, que é o estado
seguro. O caro seria o contrário.

### Por que o rollout foi para `paused` E a VM foi parada

Redundância deliberada. A VM parada corta a entrega na origem (nenhum webhook
sai). O `paused` no Firestore garante que, se alguém subir a VM sem ler este
documento, o agente ainda assim **não responde a paciente nenhum** — a decisão
é reavaliada a cada mensagem, sem redeploy.

### Por que o IP estático foi liberado

Contraintuitivo, e é o detalhe que faz a diferença na fatura:

- IP **em uso** por VM ligada → coberto pelo free tier (744 h/mês grátis) = **US$ 0**
- IP **reservado e ocioso** (VM parada) → **US$ 0,01/h ≈ US$ 7,44/mês**

Ou seja: parar a VM e *deixar o IP reservado* faria a conta **subir** de US$ 0
para ~US$ 7,44/mês. Preços conferidos na Cloud Billing Catalog API em
18/08/2026 (SKUs `Static Ip Charge` e `External IP Charge on a Standard VM`).

O custo disso é que, na volta, o IP será **outro** — e o DNS precisa ser
repontado. Cinco minutos de trabalho, descritos abaixo.

---

## O que continua de pé (e por quê)

- **Disco de 30 GB da VM** — preservado. É onde estão os volumes
  `evolution_instances` (a sessão pareada do WhatsApp), `postgres_data` e
  `caddy_data`. **Não apague.** Cabe inteiro nos 30 GiB/mês grátis do free
  tier → **US$ 0**.
- **Firestore** — todos os dados intactos (agendamentos, pacientes,
  atendimentos, config). Volume de leitura/escrita cai a ~zero com o sistema
  parado, bem dentro da cota gratuita → **US$ 0**.
- **Landing page na Vercel** — é o que fica no ar.

---

## Como voltar

### 1. Religar a aplicação (2 minutos)

Na Vercel → *Settings* → *Environment Variables*:

```
NEXT_PUBLIC_OPERACAO_SUSPENSA = false
```

Redeploy. Isso devolve o login, a área restrita, o `/api/*` e o formulário de
leads da landing.

### 2. Restaurar o cron de lembretes (se for usar)

Em `vercel.json`, devolver o bloco removido:

```json
"crons": [
  { "path": "/api/cron/lembretes", "schedule": "0 12 * * *" }
]
```

### 3. Religar a infraestrutura do WhatsApp

```bash
# sobe a VM (o disco e os volumes estão intactos)
gcloud compute instances start evolution-vps \
  --zone us-east1-b --project cardiocentro-pipeline

# descobre o novo IP externo (efêmero)
gcloud compute instances describe evolution-vps \
  --zone us-east1-b --project cardiocentro-pipeline \
  --format="value(networkInterfaces[0].accessConfigs[0].natIP)"
```

Depois:

1. **Apontar o DNS** de `EVOLUTION_DOMINIO` para o novo IP e esperar propagar.
   O Caddy reemite o certificado Let's Encrypt sozinho na primeira subida.
   Se quiser um IP fixo de novo, reserve antes de subir a VM — lembrando que
   ele só é grátis enquanto estiver **anexado a uma VM ligada**.
2. Na VPS: `cd deploy && ./deploy.sh preflight` e depois `./deploy.sh`.
3. **Provável necessidade de reler o QR Code.** O WhatsApp desvincula um
   dispositivo conectado que fica ~14 dias offline. Passado esse prazo, os
   volumes continuam lá mas a sessão expirou do lado da Meta:
   `./deploy.sh qr` e parear de novo no celular da clínica.
4. `./deploy.sh webhook` — recadastra o webhook com o header do segredo.
   Sem este passo o agente fica **mudo sem erro visível**.

### 4. Reabrir o agente com cuidado

Não volte direto para `canary 80%`. O valor 80 ficou salvo no Firestore, mas
o caminho seguro depois de meses parado é reconferir antes:

```bash
npm run rollout              # confere o estado efetivo
npm run rollout shadow       # rascunha sem enviar nada — valide as respostas
npm run rollout canary 5     # reabre devagar
```

### 5. Reverter o formulário de leads

O passo 1 já traz o formulário de volta automaticamente. Mas ele só faz
sentido se alguém for **ler** os leads na área restrita — foi exatamente por
isso que ele saiu. Confirme que a recepção vai acompanhar a tela de leads
antes de reativar, senão mantenha o CTA de WhatsApp.

---

## Custo enquanto suspenso

| Item | Antes | Depois |
|------|-------|--------|
| GCP (VM + disco + IP) | US$ 0 (free tier) | **US$ 0** |
| Firestore | US$ 0 (free tier) | **US$ 0** |
| WhatsApp Cloud API | US$ 0 (reativo) | **US$ 0** |
| Anthropic API (Haiku/Sonnet) | poucos US$ | **US$ 0** |
| Vercel | plano atual | plano atual |

**A única linha que sobra é a Vercel.** Ver [`CUSTOS.md`](CUSTOS.md).
