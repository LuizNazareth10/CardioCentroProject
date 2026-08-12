// =============================================================
// Cliente da Evolution API (WhatsApp via Baileys) — usado SOMENTE para o
// canal de teste (ver webhook em
// src/app/api/whatsapp/evolution/webhook/route.ts). Implementa a mesma
// interface `TransporteExterno` de client.ts, então reaproveita 100% da
// lógica de negócio do agente (src/lib/whatsapp/agent.ts) sem duplicar nada.
//
// IMPORTANTE: botões e listas interativas da Evolution/Baileys quebram no
// WhatsApp comum ("Não foi possível carregar a mensagem"). Por isso
// enviamos sempre texto numerado e resolvemos a resposta no webhook.
// =============================================================

import type { TransporteExterno } from './client';
import { formatarMenuTexto, salvarOpcoesEvolution } from './evolution-opcoes';

interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instancia: string;
}

function cfg(): EvolutionConfig | null {
  const apiUrl = process.env.EVOLUTION_API_URL?.trim().replace(/\/$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instancia = process.env.EVOLUTION_INSTANCE?.trim();
  if (!apiUrl || !apiKey || !instancia) return null;
  return { apiUrl, apiKey, instancia };
}

async function chamar(caminho: string, body: unknown): Promise<Response | null> {
  const c = cfg();
  if (!c) {
    console.error('[evolution] não configurada (EVOLUTION_API_URL/EVOLUTION_API_KEY/EVOLUTION_INSTANCE)');
    return null;
  }
  // A Evolution às vezes não decodifica \uD83D\uDC99 e manda o escape literal no WhatsApp.
  // Expandimos SÓ pares de surrogate (emojis) para UTF-8 real — sem tocar em \n, \" etc.
  const res = await fetch(`${c.apiUrl}${caminho}/${c.instancia}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', apikey: c.apiKey },
    body: jsonUtf8(body),
  });
  if (!res.ok) console.error('[evolution] erro ao chamar', caminho, res.status, await res.text());
  return res;
}

/** JSON com emojis em UTF-8 real (evita \uD83D… literal no WhatsApp). */
function jsonUtf8(body: unknown): string {
  return JSON.stringify(body).replace(
    /\\u([dD][89aAbB][0-9a-fA-F]{2})\\u([dD][c-fC-F][0-9a-fA-F]{2})/g,
    (_m, hi: string, lo: string) => String.fromCharCode(parseInt(hi, 16), parseInt(lo, 16)),
  );
}

function numeroLimpo(numero: string): string {
  return numero.replace(/\D/g, '');
}

async function enviarTextoPlano(to: string, texto: string): Promise<void> {
  // Se por algum caminho o texto já vier com escape literal, normaliza antes de enviar.
  const limpo = texto.replace(/\\u([0-9a-fA-F]{4})/gi, (_m, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  const res = await chamar('/message/sendText', { number: numeroLimpo(to), text: limpo });
  await marcarComoEnviadoPeloAgente(await idDaMensagemEnviada(res));
}

/** extrai `key.id` da resposta do /message/sendText — sem lançar se o formato vier diferente do esperado. */
async function idDaMensagemEnviada(res: Response | null): Promise<string | undefined> {
  if (!res?.ok) return undefined;
  try {
    const data = (await res.json()) as { key?: { id?: string } };
    return data?.key?.id;
  } catch {
    return undefined;
  }
}

// -------------------------------------------------------------
// Distingue, no webhook, um `fromMe:true` que é ECO do próprio agente de um
// `fromMe:true` que é a RECEPÇÃO digitando direto no celular/PC — a Evolution
// manda os dois formatos exatamente iguais. Guardamos o id de toda mensagem
// que o agente envia; no webhook (route.ts), um fromMe sem id aqui só pode
// ser humano → aciona marcarHandoffHumano (session.ts) para a IA não
// atropelar uma conversa que a recepção já está respondendo de verdade.
// -------------------------------------------------------------

async function marcarComoEnviadoPeloAgente(messageId: string | undefined): Promise<void> {
  if (!messageId) return;
  try {
    const { db } = await import('../db/firestore');
    await db().collection('evolution_msgs_agente').doc(messageId).set({ enviadoEm: new Date().toISOString() });
  } catch (e) {
    console.error('[evolution] falha ao marcar mensagem como enviada pelo agente:', e);
  }
}

/** true se ESTE agente enviou a mensagem (eco); false se veio de outro lugar (recepção). */
export async function foiEnviadoPeloAgente(messageId: string | undefined): Promise<boolean> {
  if (!messageId) return true; // sem id não dá pra provar handoff → não arrisca falso positivo
  try {
    const { db } = await import('../db/firestore');
    const doc = await db().collection('evolution_msgs_agente').doc(messageId).get();
    return doc.exists;
  } catch (e) {
    console.error('[evolution] falha ao checar remetente da mensagem (assumindo eco do agente):', e);
    return true; // falha ao checar → não bloqueia o comportamento de hoje (ignora o fromMe)
  }
}

export const transporteEvolution: TransporteExterno = {
  async enviarTexto(to, texto) {
    await enviarTextoPlano(to, texto);
  },

  async enviarBotoes(to, texto, botoes) {
    const opcoes = botoes.slice(0, 3).map((b) => ({ id: b.id, titulo: b.titulo }));
    await salvarOpcoesEvolution(to, opcoes);
    await enviarTextoPlano(to, formatarMenuTexto(texto, opcoes));
  },

  async enviarLista(to, texto, _botaoLista, secoes) {
    const opcoes = secoes.flatMap((s) => s.itens).slice(0, 10).map((i) => ({
      id: i.id,
      titulo: i.descricao ? `${i.titulo} — ${i.descricao}` : i.titulo,
    }));
    await salvarOpcoesEvolution(to, opcoes);
    await enviarTextoPlano(to, formatarMenuTexto(texto, opcoes));
  },

  /**
   * `mediaId` aqui é o token especial "evolution:<base64 do JSON da mensagem>"
   * montado pelo webhook (ver normalizarEntrada em route.ts) — a Evolution
   * API precisa da mensagem original (proto.WebMessageInfo) inteira para
   * extrair a mídia, não de um id simples como na Meta Cloud API.
   */
  async baixarMidia(mediaId) {
    if (!mediaId.startsWith('evolution:')) return null;
    const c = cfg();
    if (!c) return null;
    let mensagem: unknown;
    try {
      mensagem = JSON.parse(Buffer.from(mediaId.slice('evolution:'.length), 'base64').toString('utf8'));
    } catch {
      return null;
    }
    const res = await chamar('/chat/getBase64FromMediaMessage', { message: mensagem, convertToMp4: false });
    if (!res?.ok) return null;
    const data = (await res.json()) as { base64?: string; mimetype?: string };
    if (!data.base64) return null;
    return { base64: data.base64, mime: data.mimetype ?? 'image/jpeg' };
  },
};
