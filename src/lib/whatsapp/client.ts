// =============================================================
// Cliente da WhatsApp Cloud API (Meta).
// Envia mensagens de texto e mensagens interativas (botões/listas).
// Requer WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.
// =============================================================

import { AsyncLocalStorage } from 'async_hooks';

const API = 'https://graph.facebook.com/v20.0';

function cfg() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return { token, phoneId, ativo: Boolean(token && phoneId) };
}

// -------------------------------------------------------------
// Modo simulação: quando um "sink" está ativo no contexto async,
// as mensagens de saída são CAPTURADAS (não enviadas à Meta nem
// logadas). Usado pelo simulador web (/simulador) para exibir as
// respostas do agente sem depender do WhatsApp real.
// -------------------------------------------------------------
export type EnvioCapturado = Record<string, unknown>;
const capturaStore = new AsyncLocalStorage<EnvioCapturado[]>();

/** roda `fn` capturando tudo que o agente enviaria; devolve as mensagens */
export async function capturarEnvios(fn: () => Promise<void>): Promise<EnvioCapturado[]> {
  const sink: EnvioCapturado[] = [];
  await capturaStore.run(sink, fn);
  return sink;
}

async function enviar(payload: Record<string, unknown>) {
  const sink = capturaStore.getStore();
  if (sink) {
    // modo simulação: só coleta, não envia
    sink.push(payload);
    return;
  }
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

/**
 * Baixa uma mídia recebida (ex.: foto do pedido médico) via API da Meta.
 * Retorna o conteúdo em base64 + mime, ou null se não configurado/falhar.
 *
 * Modo de teste local: se `mediaId` vier prefixado com "local:" (usado pelo
 * simulador scripts/chat-agent.ts), lê um arquivo do disco em vez de chamar
 * a API da Meta — permite testar a leitura de pedido médico sem WhatsApp.
 * IDs reais da Meta são sempre numéricos, então não há risco de colisão.
 */
export async function baixarMidia(mediaId: string): Promise<{ base64: string; mime: string } | null> {
  if (mediaId.startsWith('local:')) {
    const { readFile } = await import('fs/promises');
    const caminho = mediaId.slice('local:'.length);
    const buf = await readFile(caminho);
    const ext = caminho.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { base64: buf.toString('base64'), mime };
  }
  const { token, ativo } = cfg();
  if (!ativo || !token) {
    console.log('[whatsapp:dev] baixaria mídia', mediaId);
    return null;
  }
  try {
    const meta = await fetch(`${API}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    const info = (await meta.json()) as { url?: string; mime_type?: string };
    if (!info.url) return null;
    const bin = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
    const buf = Buffer.from(await bin.arrayBuffer());
    return { base64: buf.toString('base64'), mime: info.mime_type ?? 'image/jpeg' };
  } catch (e) {
    console.error('[whatsapp] erro ao baixar mídia:', e);
    return null;
  }
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
