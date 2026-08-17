// =============================================================
// SUSPENSÃO DA OPERAÇÃO — agosto/2026.
//
// Decisão de produto: manter NO AR apenas a landing page pública. Ficam
// suspensos, sem remoção de código:
//   · o agente de IA do WhatsApp (webhooks, cron de lembretes, simulador);
//   · toda a área restrita (login, dashboard, agenda, pacientes,
//     atendimentos, configurações) e as APIs que a alimentam.
//
// "Suspenso" aqui é DESLIGADO, não apagado: nada foi excluído do
// repositório, do Firestore ou dos volumes da VPS. É um interruptor.
//
// -------------------------------------------------------------
// COMO RELIGAR (não precisa mexer em código):
//   1. Vercel → Settings → Environment Variables:
//        NEXT_PUBLIC_OPERACAO_SUSPENSA = false
//   2. Redeploy.
//   3. Reativar a infraestrutura do WhatsApp — ver docs/SUSPENSAO.md
//      (subir a VM, repontar o DNS, `npm run rollout canary 80`).
//
// O padrão é SUSPENSO (`true`) de propósito: fail-safe. Uma variável
// esquecida no painel mantém o sistema desligado, que é o estado seguro —
// o modo de falha caro seria o inverso, a IA voltar a atender pacientes
// reais sem ninguém ter pedido.
//
// `NEXT_PUBLIC_` porque a landing precisa da flag no cliente (o formulário
// de leads é um componente client-side) e o servidor também a lê.
// =============================================================

export const OPERACAO_SUSPENSA = process.env.NEXT_PUBLIC_OPERACAO_SUSPENSA !== 'false';

/** Data em que a suspensão entrou em vigor — usada nos logs e avisos. */
export const SUSPENSA_DESDE = '2026-08-17';

/**
 * Resposta padrão das rotas de API suspensas.
 *
 * 503 + `Retry-After` é o código correto para indisponibilidade
 * TEMPORÁRIA: diz a crawlers e clientes HTTP que o recurso existe e deve
 * voltar, ao contrário de 404/410, que convidam o Google a desindexar. As
 * rotas da área restrita já estão fora do índice pelo robots.ts, mas os
 * webhooks são chamados por terceiros (Meta/Evolution) que interpretam o
 * status — 503 faz a Meta pausar as entregas em vez de invalidar a
 * inscrição do webhook.
 */
export function respostaSuspensa(): Response {
  return new Response(
    JSON.stringify({
      erro: 'Serviço temporariamente suspenso.',
      desde: SUSPENSA_DESDE,
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '86400',
        'Cache-Control': 'no-store',
      },
    },
  );
}
