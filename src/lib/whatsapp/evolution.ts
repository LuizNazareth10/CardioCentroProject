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
  const res = await fetch(`${c.apiUrl}${caminho}/${c.instancia}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: c.apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error('[evolution] erro ao chamar', caminho, res.status, await res.text());
  return res;
}

function numeroLimpo(numero: string): string {
  return numero.replace(/\D/g, '');
}

async function enviarTextoPlano(to: string, texto: string): Promise<void> {
  await chamar('/message/sendText', { number: numeroLimpo(to), text: texto });
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
