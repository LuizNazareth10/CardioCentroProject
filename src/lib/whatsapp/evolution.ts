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
  // Mesma resposta, de novo, poucos segundos depois: quase sempre é o
  // paciente mandando 2 ou 3 fotos do pedido em sequência, e cada foto
  // disparava o mesmo par de mensagens ("recebi, deixa eu ver…" + resultado).
  // O paciente terminava com 6 mensagens idênticas do agente. Repetir não
  // acrescenta nada — a primeira resposta já está lá, logo acima na conversa.
  if (await ehRepeticaoRecente(to, limpo)) {
    console.info('[evolution] resposta idêntica repetida em poucos segundos — não reenviada');
    return;
  }

  // ANTES de mandar: fecha a corrida descrita em `houveEnvioRecente`. Precisa
  // estar gravado no banco antes de a mensagem sair, porque o webhook do eco
  // pode chegar antes de esta função terminar.
  await marcarEnvioEmVoo(to);
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

/**
 * Chave por CONVERSA usada pelo marcador de envio em voo. Mesma normalização
 * que o webhook aplica ao remetente (`destino`), para os dois lados baterem.
 */
function chaveEnvio(numero: string): string {
  const d = numeroLimpo(numero);
  return d.startsWith('55') ? d : `55${d}`;
}

/**
 * Janela em que um `fromMe` sem id conhecido ainda é tratado como eco do
 * próprio agente. Generosa de propósito: o custo de errar para MAIS é só
 * deixar de marcar um handoff que a próxima mensagem da recepção marca; o
 * custo de errar para MENOS é o agente se calar sozinho (ver abaixo).
 */
const JANELA_ENVIO_EM_VOO_MS = 20_000;

/**
 * Janela em que repetir EXATAMENTE a mesma resposta é considerado eco inútil.
 * Curta de propósito: o alvo é a rajada (várias fotos seguidas), não impedir
 * que a mesma pergunta seja refeita minutos depois, quando repetir é legítimo.
 */
const JANELA_REPETICAO_MS = 45_000;

/** hash curto do texto — evita guardar a mensagem inteira só para comparar. */
function hashTexto(t: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * true se ESTA mensagem, idêntica, já foi mandada para este número há poucos
 * segundos. Quando devolve false, registra a mensagem como a última enviada.
 * Falha de banco nunca bloqueia o envio: preferimos uma resposta repetida a
 * um paciente sem resposta.
 */
async function ehRepeticaoRecente(numero: string, texto: string): Promise<boolean> {
  try {
    const { db } = await import('../db/firestore');
    const ref = db().collection('evolution_ultima_resposta').doc(chaveEnvio(numero));
    const d = (await ref.get()).data() as { hash?: string; em?: number } | undefined;
    if (d?.hash === hashTexto(texto) && typeof d.em === 'number' && Date.now() - d.em <= JANELA_REPETICAO_MS) {
      return true;
    }
    await ref.set({ hash: hashTexto(texto), em: Date.now() });
    return false;
  } catch (e) {
    console.error('[evolution] falha ao checar repetição (enviando mesmo assim):', e);
    return false;
  }
}

/** Registra que o agente está enviando algo para este número AGORA. */
async function marcarEnvioEmVoo(numero: string): Promise<void> {
  try {
    const { db } = await import('../db/firestore');
    await db().collection('evolution_envios_em_voo').doc(chaveEnvio(numero)).set({ em: Date.now() });
  } catch (e) {
    console.error('[evolution] falha ao marcar envio em voo:', e);
  }
}

/** true se o agente mandou alguma mensagem para este número nos últimos segundos. */
async function houveEnvioRecente(numero: string): Promise<boolean> {
  if (!numero) return false;
  try {
    const { db } = await import('../db/firestore');
    const doc = await db().collection('evolution_envios_em_voo').doc(chaveEnvio(numero)).get();
    const em = doc.data()?.em as number | undefined;
    return typeof em === 'number' && Date.now() - em <= JANELA_ENVIO_EM_VOO_MS;
  } catch (e) {
    console.error('[evolution] falha ao checar envio em voo (assumindo eco):', e);
    return true;
  }
}

/**
 * true se ESTE agente enviou a mensagem (eco); false se veio de outro lugar
 * (recepção digitando no celular/PC).
 *
 * A checagem por id sozinha TEM UMA CORRIDA, e ela derrubou atendimentos em
 * produção: o Baileys emite `messages.upsert` para a mensagem que acabou de
 * sair ANTES de a chamada `/message/sendText` retornar para nós — ou seja,
 * antes de `marcarComoEnviadoPeloAgente` ter o id para gravar. Quando o
 * webhook do eco ganha essa corrida, o id ainda não existe, o agente conclui
 * "isso foi a recepção" e marca handoff CONTRA A PRÓPRIA RESPOSTA — a partir
 * dali ele fica mudo para aquele paciente até a sessão expirar (2h).
 *
 * Por isso, quando o id não é encontrado, ainda perguntamos se o agente
 * enviou algo para esse número há poucos segundos (`marcarEnvioEmVoo` grava
 * ANTES do envio, então está sempre lá quando o eco chega). Só é handoff de
 * verdade quando as duas checagens falham.
 */
export async function foiEnviadoPeloAgente(messageId: string | undefined, numero?: string): Promise<boolean> {
  if (!messageId) return true; // sem id não dá pra provar handoff → não arrisca falso positivo
  try {
    const { db } = await import('../db/firestore');
    const doc = await db().collection('evolution_msgs_agente').doc(messageId).get();
    if (doc.exists) return true;
  } catch (e) {
    console.error('[evolution] falha ao checar remetente da mensagem (assumindo eco do agente):', e);
    return true; // falha ao checar → não bloqueia o comportamento de hoje (ignora o fromMe)
  }
  return houveEnvioRecente(numero ?? '');
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
