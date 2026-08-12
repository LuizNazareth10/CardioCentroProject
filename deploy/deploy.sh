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
#   ./deploy.sh preflight  # confere o .env e a stack ANTES de parear
#   ./deploy.sh qr         # desenha o QR de pareamento (só na 1ª vez)
#   ./deploy.sh settings   # aplica os ajustes de segurança da instância
#   ./deploy.sh webhook    # cadastra o webhook com o header do segredo
# =============================================================
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "ERRO: crie um arquivo deploy/.env a partir de deploy/.env.example antes de subir." >&2
  exit 1
fi

# shellcheck disable=SC1091
source .env
instancia="${EVOLUTION_INSTANCE:-cardiocentro}"

api() { curl -sS -H "apikey: ${EVOLUTION_API_KEY}" "$@"; }

# -------------------------------------------------------------
# Ajustes da instância que protegem o número principal da clínica. Cada um
# existe por um motivo específico — não são "boas práticas" genéricas:
#
#  syncFullHistory=false  A proteção NA FONTE contra responder conversa antiga.
#                         Sem ela, ao ler o QR a Evolution puxa o histórico do
#                         aparelho e reemite messages.upsert para semanas de
#                         conversa já tratada pela recepção. A janela de frescor
#                         de 10 min no app é a segunda rede; esta é a primeira.
#  groupsIgnore=true      Grupo nem chega ao webhook (o app já descarta @g.us,
#                         mas assim não gasta invocação da Vercel à toa).
#  readMessages=false     CRÍTICO num número compartilhado: em true, a Evolution
#                         marcaria como lida TODA mensagem que chega — inclusive
#                         os 95% que são da recepção. A equipe perderia o "não
#                         lido" e passaria a não enxergar paciente esperando.
#  rejectCall=false       A clínica RECEBE ligação de paciente pelo WhatsApp.
#                         Rejeitar automático derrubaria chamada de gente real.
#  alwaysOnline=false     "Sempre online" mente sobre a presença da recepção e é
#                         o tipo de sinal não-humano que pesa numa avaliação de
#                         ban.
#
# Sem comentários dentro do programa jq de propósito: este trecho roda no
# minuto do pareamento e não é hora de descobrir incompatibilidade de sintaxe.
# -------------------------------------------------------------
payload_settings() {
  jq -n '{syncFullHistory:false,groupsIgnore:true,readMessages:false,readStatus:false,rejectCall:false,alwaysOnline:false}'
}

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
    for dep in curl jq; do
      command -v "$dep" >/dev/null 2>&1 || { echo "ERRO: falta '$dep'. Instale: sudo apt install -y curl jq qrencode" >&2; exit 1; }
    done

    estado="$(api "${SERVER_URL}/instance/connectionState/${instancia}" | jq -r '.instance.state // "inexistente"')"

    if [[ "$estado" == "open" ]]; then
      echo "✓ A instância '${instancia}' JÁ ESTÁ PAREADA — não leia QR nenhum."
      echo "  Ler o QR de novo derrubaria a sessão atual sem necessidade."
      exit 0
    fi

    if [[ "$estado" == "inexistente" || "$estado" == "null" ]]; then
      echo "→ Criando a instância '${instancia}' com os ajustes de segurança…"
      api -X POST "${SERVER_URL}/instance/create" \
        -H 'Content-Type: application/json' \
        -d "$(jq -n --arg nome "$instancia" --argjson s "$(payload_settings)" \
              '{instanceName:$nome,integration:"WHATSAPP-BAILEYS",qrcode:true} + $s')" \
        >/dev/null
      sleep 3
    fi

    # Reaplica SEMPRE, mesmo em instância que já existia de um teste anterior —
    # nesse caso o bloco de criação acima é pulado e os ajustes nunca valeriam.
    # syncFullHistory precisa estar em false ANTES de o QR ser lido.
    echo "→ Garantindo os ajustes de segurança antes do pareamento…"
    api -X POST "${SERVER_URL}/settings/set/${instancia}" \
      -H 'Content-Type: application/json' -d "$(payload_settings)" >/dev/null || true

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
    # sem nenhum erro visível na Evolution.
    #
    # Como o webhook GLOBAL está desligado no docker-compose (ele não manda
    # header e duplicava cada entrega), este é o ÚNICO caminho de entrega —
    # rodar este passo depois do pareamento não é opcional.
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

  settings)
    # Aplica (e mostra) os ajustes de segurança da instância. Rode isto se a
    # instância já existia antes desta versão do script — os ajustes de criação
    # não valem retroativamente.
    command -v jq >/dev/null 2>&1 || { echo "ERRO: falta 'jq'. sudo apt install -y jq" >&2; exit 1; }
    echo "→ Aplicando ajustes em '${instancia}'…"
    api -X POST "${SERVER_URL}/settings/set/${instancia}" \
      -H 'Content-Type: application/json' -d "$(payload_settings)" >/dev/null
    echo "→ Como ficou (lido de volta da Evolution):"
    api "${SERVER_URL}/settings/find/${instancia}" | jq . 2>/dev/null || echo "(não consegui ler de volta)"
    echo
    echo "Esperado: syncFullHistory=false · groupsIgnore=true · readMessages=false · alwaysOnline=false · rejectCall=false"
    ;;

  preflight)
    # Conferência ANTES de encostar no celular. Cada item aqui já foi, em
    # algum momento, a causa de "conectou e o agente ficou mudo" ou pior.
    echo "=== Preflight — conferindo antes de parear ==="
    falhas=0
    aviso() { echo "  ✗ $1"; falhas=$((falhas + 1)); }
    ok()    { echo "  ✓ $1"; }

    echo
    echo "1) Variáveis em deploy/.env"
    for v in EVOLUTION_DOMINIO SERVER_URL EVOLUTION_API_KEY POSTGRES_PASSWORD WEBHOOK_URL EVOLUTION_WEBHOOK_SECRET EVOLUTION_INSTANCE; do
      if [[ -z "${!v:-}" ]]; then aviso "$v está VAZIA"; else ok "$v definida"; fi
    done
    if [[ "${EVOLUTION_API_KEY:-}" == "troque-por-uma-chave-forte" ]]; then aviso "EVOLUTION_API_KEY ainda é a do exemplo"; fi
    if [[ "${POSTGRES_PASSWORD:-}" == "troque-esta-senha" ]]; then aviso "POSTGRES_PASSWORD ainda é a do exemplo"; fi
    case "${WEBHOOK_URL:-}" in
      https://*/api/whatsapp/evolution/webhook) ok "WEBHOOK_URL aponta para a rota certa" ;;
      *) aviso "WEBHOOK_URL deveria terminar em /api/whatsapp/evolution/webhook (e ser https)" ;;
    esac

    echo
    echo "2) Containers"
    if $DC ps --status running 2>/dev/null | grep -q evolution_api; then ok "evolution-api rodando"; else aviso "evolution-api NÃO está rodando (./deploy.sh)"; fi
    if $DC ps --status running 2>/dev/null | grep -q evolution_caddy; then ok "caddy rodando"; else aviso "caddy NÃO está rodando"; fi

    echo
    echo "3) TLS e alcance da Evolution"
    if curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${SERVER_URL}" 2>/dev/null | grep -qE '^(200|401|403|404)$'; then
      ok "SERVER_URL responde por HTTPS (certificado válido)"
    else
      aviso "SERVER_URL não respondeu — DNS apontando para esta VPS? porta 443 liberada?"
    fi

    echo
    echo "4) Estado da instância"
    estado="$(api "${SERVER_URL}/instance/connectionState/${instancia}" 2>/dev/null | jq -r '.instance.state // "inexistente"' 2>/dev/null || echo erro)"
    echo "  → instância '${instancia}': ${estado}"
    if [[ "$estado" == "open" ]]; then echo "     (já pareada — NÃO rode ./deploy.sh qr de novo)"; fi

    echo
    if [[ $falhas -gt 0 ]]; then
      echo "❌ $falhas item(ns) para resolver ANTES de ler o QR."
      exit 1
    fi
    echo "✅ Preflight limpo."
    echo "   Falta ainda, do lado da Vercel: EVOLUTION_NUMEROS_TESTE vazia e"
    echo "   'npm run rollout' dizendo canary 5%."
    ;;

  down)
    # Descida SEGURA: para os containers mas PRESERVA os volumes (sem -v).
    echo "→ Parando containers (a sessão do WhatsApp é preservada)…"
    $DC down
    echo "✓ Containers parados. Rode ./deploy.sh para subir de novo sem reler QR."
    ;;

  *)
    echo "Ação desconhecida: $acao (use: up | pull | logs | status | preflight | qr | settings | webhook | down)" >&2
    exit 1
    ;;
esac
