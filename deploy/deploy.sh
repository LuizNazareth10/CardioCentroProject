#!/usr/bin/env bash
# =============================================================
# Deploy da stack da VPS (Evolution API) SEM derrubar o WhatsApp.
#
# Regra de ouro: este script NUNCA usa `down -v`. Ele só recria os
# containers a partir das imagens/configuração atuais, mantendo intactos
# os volumes onde vive a sessão do WhatsApp — então o QR Code NÃO precisa
# ser lido de novo a cada atualização.
#
# O agente (Next.js) roda na Vercel e é atualizado por git push; este
# script não tem nada a ver com ele — cuida apenas da infraestrutura de
# conexão do WhatsApp na VPS.
#
# Uso, na VPS, dentro de deploy/:
#   ./deploy.sh            # aplica a configuração atual (padrão)
#   ./deploy.sh pull       # baixa novas imagens antes de aplicar
#   ./deploy.sh logs       # segue os logs da Evolution
#   ./deploy.sh status     # mostra o estado dos containers
#   ./deploy.sh qr         # imprime o passo p/ parear (só na 1ª vez)
# =============================================================
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "ERRO: crie um arquivo deploy/.env a partir de deploy/.env.example antes de subir." >&2
  exit 1
fi

# docker compose (v2) ou docker-compose (v1)
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

acao="${1:-up}"

case "$acao" in
  up)
    echo "→ Subindo/atualizando a stack SEM apagar a sessão (sem -v)…"
    # --remove-orphans limpa containers órfãos; volumes permanecem intactos.
    $DC up -d --remove-orphans
    echo "✓ Pronto. A sessão do WhatsApp foi preservada (nenhum QR necessário)."
    $DC ps
    ;;

  pull)
    echo "→ Baixando novas imagens…"
    $DC pull
    echo "→ Recriando containers com as novas imagens (volumes preservados)…"
    $DC up -d --remove-orphans
    $DC ps
    ;;

  logs)
    $DC logs -f evolution-api
    ;;

  status)
    $DC ps
    ;;

  qr)
    source .env
    echo "Pareamento (só na PRIMEIRA vez, ou se a sessão for perdida):"
    echo
    echo "1) Crie a instância (nome = EVOLUTION_INSTANCE do app):"
    echo "   curl -sS -X POST '${SERVER_URL}/instance/create' \\"
    echo "     -H 'apikey: ${EVOLUTION_API_KEY}' -H 'Content-Type: application/json' \\"
    echo "     -d '{\"instanceName\":\"NOME_DA_INSTANCIA\",\"integration\":\"WHATSAPP-BAILEYS\"}'"
    echo
    echo "2) Pegue o QR em ${SERVER_URL}/instance/connect/NOME_DA_INSTANCIA"
    echo "   e leia no WhatsApp da clínica (Aparelhos conectados)."
    echo
    echo "Depois disso, atualizações futuras usam ./deploy.sh e NÃO pedem QR de novo."
    ;;

  down)
    # Descida SEGURA: para os containers mas PRESERVA os volumes (sem -v).
    echo "→ Parando containers (a sessão do WhatsApp é preservada)…"
    $DC down
    echo "✓ Containers parados. Rode ./deploy.sh para subir de novo sem reler QR."
    ;;

  *)
    echo "Ação desconhecida: $acao (use: up | pull | logs | status | qr | down)" >&2
    exit 1
    ;;
esac
