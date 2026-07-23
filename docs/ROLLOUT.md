# Testar o agente em produção sem perder leads

Estratégia para colocar a IA na frente de clientes **reais** de forma
controlada e reversível, com monitoramento — e sem redeploy para ajustar.

## Os 4 modos (ajustáveis em runtime)

Em **Configurações → Rollout do agente** (ou pela variável `AGENTE_MODO`):

| Modo | O que faz | Quando usar |
|---|---|---|
| **full** | IA atende todas as leads (padrão) | operação normal |
| **shadow** | IA **rascunha** mas **não envia** ao paciente; o rascunho vai para o Slack/Discord | fase 0 — risco zero |
| **canary** | IA atende só **X%** das leads (fixo por número); o resto vai para a recepção | subir volume aos poucos |
| **paused** | kill-switch — IA não atende ninguém | incidente / pausa |

A mudança de modo/percentual vale **nas próximas mensagens**, sem novo deploy
(persiste no documento de config no Firestore; a tela tem prioridade sobre a
variável de ambiente).

## Por que é seguro (não perde lead)

1. A Evolution conecta como **dispositivo vinculado** ao celular da clínica:
   a recepção **continua vendo 100%** das conversas no WhatsApp. As leads que a
   IA **não** atende seguem com o time exatamente como hoje.
2. O canary é **pegajoso por número** (hash estável dos últimos 8 dígitos):
   a mesma pessoa é **sempre** IA ou **sempre** humano — nunca alterna no meio
   da conversa.
3. Seus **números de teste** (`EVOLUTION_NUMEROS_TESTE`) são **sempre**
   atendidos, independentemente do percentual — QA completo quando quiser.
4. Transbordo já existente: urgência, "falar com atendente" e convênios de
   regra especial (ex.: IPSEMG) caem na fila humana em `/atendimentos`.

### O risco que continua sendo seu (decisão consciente)

Rodar a **Evolution (API não-oficial)** no **número principal** da clínica
contraria os termos do WhatsApp e tem risco de **ban do número** — cujo estrago
seria a linha inteira, não só o percentual. Recomendação: rodar o piloto num
**número dedicado**, ou migrar o número principal para o **canal oficial da Meta
Cloud API** (já implementado no projeto). A lógica de modos/percentual é a mesma
nos dois canais.

## Roteiro sugerido

1. **Shadow** por alguns dias: leia os rascunhos no Slack/Discord, corrija o
   fluxo. Zero contato com o paciente.
2. **Canary 5%**: observe o painel de monitoramento (atendidos / erros).
3. Suba **5% → 10% → 25% → 50% → 100%** conforme a confiança, no controle
   deslizante — sem redeploy.
4. Qualquer susto: **paused** (1 clique) e tudo volta para a recepção.

## Monitoramento

O painel em **Configurações** mostra, dos últimos 100 eventos, quantas leads a
IA **atendeu**, quantos **rascunhos** (shadow) e quantos **erros**, com o feed
detalhado (número mascarado, horário, motivo). Só são registrados os eventos das
leads que a IA **tocou** — a superfície de risco do teste. Endpoint:
`GET /api/agente/monitor`.

Para o modo shadow, defina `SHADOW_WEBHOOK_URL` (URL de webhook do Slack ou do
Discord). Sem ela, os rascunhos aparecem só nos logs do servidor.

## CI/CD da VPS sem reler QR

O "cérebro" (Next.js) roda na **Vercel** e atualiza por `git push` — não toca na
VPS. A **VPS** só mantém a Evolution viva. A sessão do WhatsApp vive em
**volumes Docker**; enquanto eles existirem, atualizar os containers **não pede
QR de novo**.

- `deploy/docker-compose.yml` — Evolution + Postgres + Redis com volumes nomeados.
- `deploy/deploy.sh` — sobe/atualiza **sem** `down -v` (nunca apaga a sessão).
- `.github/workflows/deploy-vps.yml` — CI/CD: em mudanças de `deploy/`, faz SSH
  na VPS e roda `deploy.sh pull` (recria containers, preserva volumes).

Regra de ouro: **nunca** `docker compose down -v` em produção — o `-v` apaga os
volumes e força reler o QR.

```bash
# na VPS, primeira vez:
cp deploy/.env.example deploy/.env   # e preencher
./deploy.sh up
./deploy.sh qr        # parear uma única vez
# atualizações futuras (ou via GitHub Actions):
./deploy.sh pull      # sem QR
```
