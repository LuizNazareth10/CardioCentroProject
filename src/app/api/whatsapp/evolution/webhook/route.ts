import { NextRequest, NextResponse } from 'next/server';
import { processarMensagem, type Entrada } from '@/lib/whatsapp/agent';
import { comTransporte } from '@/lib/whatsapp/client';
import { transporteEvolution } from '@/lib/whatsapp/evolution';

// =============================================================
// Webhook da Evolution API — canal de TESTE, isolado do webhook oficial
// da Meta Cloud API (src/app/api/whatsapp/webhook/route.ts, inalterado).
//
// Restrito por design à lista de números de cliente de teste
// (EVOLUTION_NUMEROS_TESTE, separados por vírgula) conversando com o
// número-agente pareado na instância da Evolution API. Qualquer outra
// origem — outro número, grupo, ou mensagem enviada pelo próprio agente
// (eco) — é ignorada sem processar nada e sem tocar no banco.
//
// maxDuration maior que o padrão: o fluxo completo (sessão + IA + envio)
// pode passar de alguns segundos, e a Evolution API RETRANSMITE o webhook
// se não receber resposta a tempo — cada retransmissão, sem a proteção de
// `jaProcessada` abaixo, reprocessaria a mensagem inteira do zero.
// =============================================================
export const maxDuration = 60;

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!segredo) return true; // sem segredo configurado → não valida (dev)
  return req.headers.get('x-evolution-secret') === segredo;
}

/**
 * Marca um id de mensagem como processado de forma ATÔMICA (via `.create()`,
 * que falha se o doc já existir). Devolve `true` só na primeira vez que esse
 * id é visto — chamadas seguintes (reenvio/retry da Evolution API) devolvem
 * `false` e o webhook responde ok sem rodar o agente de novo.
 */
async function primeiraVez(messageId: string | undefined): Promise<boolean> {
  if (!messageId) return true;
  try {
    const { db } = await import('@/lib/db/firestore');
    await db().collection('evolution_msgs_processadas').doc(messageId).create({ processadoEm: new Date().toISOString() });
    return true;
  } catch (e) {
    const codigo = (e as { code?: number })?.code;
    if (codigo === 6 || /ALREADY_EXISTS/i.test(String(e))) return false; // já processada (retry)
    console.error('[evolution:dedup] erro ao checar duplicidade:', e);
    return true; // falha ao checar → não bloqueia (prefere um possível duplicado a perder a mensagem)
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!autorizado(req)) return new NextResponse('invalid secret', { status: 401 });

    const body = await req.json();
    const evento = String(body?.event ?? '').toLowerCase();
    if (evento !== 'messages.upsert') return NextResponse.json({ ok: true });

    const data = body?.data;
    const key = data?.key;
    if (!key) return NextResponse.json({ ok: true });
    if (key.fromMe) return NextResponse.json({ ok: true }); // eco do que o próprio agente mandou

    const remoteJid: string = key.remoteJid ?? '';
    if (remoteJid.endsWith('@g.us')) return NextResponse.json({ ok: true }); // bloqueia grupos

    const numerosPermitidos = (process.env.EVOLUTION_NUMEROS_TESTE ?? '')
      .split(',')
      .map((n) => n.replace(/\D/g, ''))
      .filter(Boolean);
    const numero = remoteJid.replace(/@.*$/, '').replace(/\D/g, '');
    if (numerosPermitidos.length === 0 || !numerosPermitidos.includes(numero)) {
      return NextResponse.json({ ok: true }); // só os números de teste
    }

    if (!(await primeiraVez(key.id))) return NextResponse.json({ ok: true }); // retry da Evolution — já tratamos essa mensagem

    const entrada = normalizarEntrada(data);
    if (!entrada) return NextResponse.json({ ok: true });

    // AGUARDA o processamento (diferente do webhook da Meta): em runtime
    // serverless (Vercel), uma promise "solta" pode ser encerrada assim que
    // a resposta HTTP é enviada, antes do envio de saída terminar.
    await comTransporte(transporteEvolution, () => processarMensagem(numero, entrada));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[evolution:webhook] erro:', e);
    return NextResponse.json({ ok: true, erro: e instanceof Error ? e.message : String(e) });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizarEntrada(data: any): Entrada | null {
  const msg = data?.message;
  if (!msg) return null;
  if (typeof msg.conversation === 'string') return { tipo: 'texto', valor: msg.conversation };
  if (typeof msg.extendedTextMessage?.text === 'string') return { tipo: 'texto', valor: msg.extendedTextMessage.text };
  if (typeof msg.buttonsResponseMessage?.selectedButtonId === 'string') {
    return { tipo: 'interativo', valor: msg.buttonsResponseMessage.selectedButtonId };
  }
  if (typeof msg.listResponseMessage?.singleSelectReply?.selectedRowId === 'string') {
    return { tipo: 'interativo', valor: msg.listResponseMessage.singleSelectReply.selectedRowId };
  }
  if (msg.imageMessage) {
    // a Evolution precisa da mensagem inteira p/ extrair a mídia depois — ver evolution.ts
    const token = 'evolution:' + Buffer.from(JSON.stringify(data)).toString('base64');
    return { tipo: 'imagem', valor: token, mime: msg.imageMessage.mimetype ?? 'image/jpeg' };
  }
  return null;
}
