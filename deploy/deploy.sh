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
#   ./deploy.sh qr         # desenha o QR de pareamento (só na 1ª vez)
#   ./deploy.sh webhook    # cadastra o webhook com o header do segredo
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
    # Pareamento de verdade: cria a instância (se preciso) e DESENHA o QR no
    # terminal, pronto para o celular da clínica ler. Só na primeira vez.
    source .env
    instancia="${EVOLUTION_INSTANCE:-cardiocentro}"

    for dep in curl jq; do
      command -v "$dep" >/dev/null 2>&1 || { echo "ERRO: falta '$dep'. Instale: sudo apt install -y curl jq qrencode" >&2; exit 1; }
    done

    api() { curl -sS -H "apikey: ${EVOLUTION_API_KEY}" "$@"; }

    estado="$(api "${SERVER_URL}/instance/connectionState/${instancia}" | jq -r '.instance.state // "inexistente"')"

    if [[ "$estado" == "open" ]]; then
      echo "✓ A instância '${instancia}' JÁ ESTÁ PAREADA — não leia QR nenhum."
      echo "  Ler o QR de novo derrubaria a sessão atual sem necessidade."
      exit 0
    fi

    if [[ "$estado" == "inexistente" || "$estado" == "null" ]]; then
      echo "→ Criando a instância '${instancia}'…"
      api -X POST "${SERVER_URL}/instance/create" \
        -H 'Content-Type: application/json' \
        -d "{\"instanceName\":\"${instancia}\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}" \
        >/dev/null
      sleep 3
    fi

    echo "→ Gerando o pareamento…"
    codigo="$(api "${SERVER_URL}/instance/connect/${instancia}" | jq -r '.code // .qrcode.code // empty')"

    if [[ -z "$codigo" ]]; then
      echo "ERRO: a Evolution não devolveu um código de pareamento." >&2
      echo "      Veja os logs com ./deploy.sh logs" >&2
      exit 1
    fi

    echo
    if command -v qrencode >/dev/null 2>&1; then
      qrencode -t ANSIUTF8 -m 1 "$codigo"
    else
      echo "(instale 'qrencode' para ver o QR aqui: sudo apt install -y qrencode)"
      echo "Código de pareamento:"
      echo "$codigo"
    fi
    echo
    echo "📱 No CELULAR da clínica:"
    echo "   Configurações → Dispositivos conectados → Conectar dispositivo"
    echo "   e aponte para o QR acima. Ele expira em ~40s — se perder, rode de novo."
    echo
    echo "Confirme depois com: ./deploy.sh status"
    echo "Atualizações futuras usam ./deploy.sh e NÃO pedem QR de novo."
    ;;

  webhook)
    # Cadastra o webhook da instância COM o header x-evolution-secret.
    #
    # Sem esse header, o app na Vercel responde 401 a TODAS as mensagens
    # (EVOLUTION_WEBHOOK_SECRET é fail-closed em produção) e o agente fica mudo
    # sem nenhum erro visível na Evolution. O WEBHOOK_GLOBAL_URL do
    # docker-compose entrega a URL, mas não manda header nenhum — por isso este
    # passo existe e precisa rodar depois do pareamento.
    source .env
    instancia="${EVOLUTION_INSTANCE:-cardiocentro}"

    command -v jq >/dev/null 2>&1 || { echo "ERRO: falta 'jq'. sudo apt install -y jq" >&2; exit 1; }
    if [[ -z "${EVOLUTION_WEBHOOK_SECRET:-}" ]]; then
      echo "ERRO: EVOLUTION_WEBHOOK_SECRET vazio no deploy/.env." >&2
      echo "      Use o MESMO valor cadastrado na Vercel." >&2
      exit 1
    fi

    echo "→ Cadastrando webhook da instância '${instancia}'…"
    resposta="$(curl -sS -X POST "${SERVER_URL}/webhook/set/${instancia}" \
      -H "apikey: ${EVOLUTION_API_KEY}" -H 'Content-Type: application/json' \
      -d "$(jq -n \
            --arg url "$WEBHOOK_URL" \
            --arg segredo "$EVOLUTION_WEBHOOK_SECRET" \
            '{webhook:{enabled:true,url:$url,headers:{"x-evolution-secret":$segredo,"Content-Type":"application/json"},byEvents:false,base64:false,events:["MESSAGES_UPSERT"]}}')")"

    echo "$resposta" | jq . 2>/dev/null || echo "$resposta"
    echo
    echo "✓ Confira nos logs da Vercel se as mensagens deixaram de dar 401."
    ;;

  down)
    # Descida SEGURA: para os containers mas PRESERVA os volumes (sem -v).
    echo "→ Parando containers (a sessão do WhatsApp é preservada)…"
    $DC down
    echo "✓ Containers parados. Rode ./deploy.sh para subir de novo sem reler QR."
    ;;

  *)
    echo "Ação desconhecida: $acao (use: up | pull | logs | status | qr | webhook | down)" >&2
    exit 1
    ;;
esac
