// =============================================================
// Cliente da WhatsApp Cloud API (Meta).
// Envia mensagens de texto e mensagens interativas (botões/listas).
// Requer WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.
// =============================================================

const API = 'https://graph.facebook.com/v20.0';

function cfg() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return { token, phoneId, ativo: Boolean(token && phoneId) };
}

async function enviar(payload: Record<string, unknown>) {
  const { token, phoneId, ativo } = cfg();
  if (!ativo) {
    // Em dev/demo sem credenciais, apenas loga (não quebra o fluxo).
    console.log('[whatsapp:dev] enviaria →', JSON.stringify(payload));
    return;
  }
  const res = await fetch(`${API}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  if (!res.ok) console.error('[whatsapp] erro ao enviar:', await res.text());
}

export async function enviarTexto(to: string, texto: string) {
  await enviar({ to, type: 'text', text: { body: texto } });
}

/** até 3 botões de resposta rápida */
export async function enviarBotoes(to: string, texto: string, botoes: Array<{ id: string; titulo: string }>) {
  await enviar({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: texto },
      action: { buttons: botoes.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.titulo.slice(0, 20) } })) },
    },
  });
}

/** lista de opções (ideal p/ muitos itens, ex.: exames) */
export async function enviarLista(
  to: string,
  texto: string,
  botaoLista: string,
  secoes: Array<{ titulo: string; itens: Array<{ id: string; titulo: string; descricao?: string }> }>,
) {
  await enviar({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: texto },
      action: {
        button: botaoLista.slice(0, 20),
        sections: secoes.map((s) => ({
          title: s.titulo.slice(0, 24),
          rows: s.itens.slice(0, 10).map((i) => ({ id: i.id, title: i.titulo.slice(0, 24), description: i.descricao?.slice(0, 72) })),
        })),
      },
    },
  });
}
