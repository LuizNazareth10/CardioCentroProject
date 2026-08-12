import { NextRequest, NextResponse } from 'next/server';
import { processarMensagem, type Entrada } from '@/lib/whatsapp/agent';
import { capturarEnvios, comTransporte } from '@/lib/whatsapp/client';
import { foiEnviadoPeloAgente, transporteEvolution } from '@/lib/whatsapp/evolution';
import { resolverOpcaoEvolution } from '@/lib/whatsapp/evolution-opcoes';
import { carregarClinicConfig } from '@/lib/clinic-config';
import { decidirRollout, encaminharRascunhoShadow, transporteCaptura } from '@/lib/whatsapp/rollout';
import { registrarEvento } from '@/lib/whatsapp/monitor';
import { numeroPermitido } from '@/lib/whatsapp/evolution-numeros';
import { liberarSemSegredo, segredoConfere } from '@/lib/env';
import { marcarHandoffHumano } from '@/lib/whatsapp/session';

// =============================================================
// Webhook da Evolution API — canal do WhatsApp da clínica, isolado do webhook
// oficial da Meta Cloud API (src/app/api/whatsapp/webhook/route.ts, inalterado).
//
// EVOLUTION_NUMEROS_TESTE tem DOIS regimes, e é a chave que vira o piloto em
// produção:
//
//  • PREENCHIDA  → modo piloto. Portão rígido: só remetentes da allowlist
//    chegam ao agente, e chegam marcados como "sempre atende" (resposta real
//    inclusive em `paused` e em `canary` com 0%). Era o regime de QA.
//  • VAZIA       → canal aberto ao público. Todo remetente é avaliado pelo
//    ROLLOUT (Configurações → Rollout do agente): em `canary 5%`, só ~5% dos
//    pacientes — fixos por número — são atendidos pela IA; o restante segue
//    com a recepção humana, que continua vendo 100% das conversas no aparelho.
//
// Grupos, mensagens antigas (sync de histórico) e o eco do próprio agente são
// ignorados sem tocar no banco nem enviar qualquer resposta. Um `fromMe` que
// NÃO é eco do agente — a recepção digitou direto no celular/PC — marca
// handoff humano (ver tratarEcoOuHandoffHumano) para a IA não atropelar uma
// conversa que já está sendo respondida por gente, mesmo que esse número
// caia no bucket do canary na mensagem seguinte.
//
// maxDuration maior que o padrão: o fluxo completo (sessão + IA + envio)
// pode passar de alguns segundos, e a Evolution API RETRANSMITE o webhook
// se não receber resposta a tempo — cada retransmissão, sem a proteção de
// `jaProcessada` abaixo, reprocessaria a mensagem inteira do zero.
// =============================================================
export const maxDuration = 60;

/**
 * Idade máxima (minutos) de uma mensagem para o agente responder.
 *
 * Ao ler o QR, a Evolution SINCRONIZA o histórico do aparelho e pode reemitir
 * `messages.upsert` para conversas antigas. Sem este corte, o pareamento faria
 * o agente responder de uma vez a semanas de mensagens que a recepção já
 * tratou — no número principal da clínica, na frente de pacientes reais.
 */
const JANELA_FRESCOR_MIN = Number(process.env.EVOLUTION_JANELA_FRESCOR_MIN) || 10;

/** true se a mensagem é recente o bastante para ser "ao vivo". */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function recente(data: any): boolean {
  const bruto = Number(data?.messageTimestamp);
  if (!Number.isFinite(bruto) || bruto <= 0) return true; // sem timestamp → não bloqueia
  const segundos = bruto > 1e12 ? bruto / 1000 : bruto; // Evolution manda em s; tolera ms
  const idadeMin = (Date.now() / 1000 - segundos) / 60;
  return idadeMin <= JANELA_FRESCOR_MIN;
}

// Em produção, EVOLUTION_WEBHOOK_SECRET ausente BLOQUEIA o webhook
// (fail-closed): sem ele qualquer um poderia injetar mensagens forjadas e
// conversar com o agente como se fosse paciente. Em dev a checagem é dispensada.
function autorizado(req: NextRequest): boolean {
  const segredo = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!segredo) return liberarSemSegredo();
  return segredoConfere(segredo, req.headers.get('x-evolution-secret'));
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

    const remoteJid: string = key.remoteJid ?? '';
    if (remoteJid.endsWith('@g.us')) return NextResponse.json({ ok: true }); // bloqueia grupos, mesmo fromMe

    if (key.fromMe) {
      // Sync de histórico no pareamento pode reemitir SEMANAS de mensagens já
      // enviadas — sem o corte de frescor, cada uma seria avaliada abaixo e
      // geraria handoff para números aleatórios que não têm nada a ver com agora.
      if (recente(data)) await tratarEcoOuHandoffHumano(key, data);
      return NextResponse.json({ ok: true });
    }

    // WhatsApp/Evolution pode mandar com ou sem 55, com ou sem o 9º dígito,
    // e em alguns casos o JID principal vem como @lid (telefone em remoteJidAlt).
    const numero = extrairTelefone(key, data);
    if (!numero) return NextResponse.json({ ok: true });

    // Mensagem antiga (sync de histórico no pareamento) → não responde.
    if (!recente(data)) {
      console.info('[evolution:webhook] ignorado: mensagem fora da janela de frescor (sync de histórico?)');
      return NextResponse.json({ ok: true });
    }

    // Allowlist VAZIA = canal aberto: quem filtra é o rollout (canary %), não
    // esta lista. Allowlist PREENCHIDA = modo piloto, portão rígido de QA.
    const numerosPermitidos = (process.env.EVOLUTION_NUMEROS_TESTE ?? '')
      .split(',')
      .map((n) => n.replace(/\D/g, ''))
      .filter(Boolean);
    const modoPiloto = numerosPermitidos.length > 0;
    const naAllowlist = modoPiloto && numeroPermitido(numero, numerosPermitidos);
    if (modoPiloto && !naAllowlist) {
      console.info('[evolution:webhook] ignorado: modo piloto ativo e remetente fora de EVOLUTION_NUMEROS_TESTE');
      return NextResponse.json({ ok: true });
    }

    const { agente } = await carregarClinicConfig();
    // `sempreAtende` só vale para a allowlist de QA. Paciente real passa pelo
    // rollout — é o que faz o canary de 5% valer de verdade.
    const decisao = decidirRollout(numero, agente, naAllowlist);

    if (!decisao.atende) {
      // lead vai para a recepção humana (ou IA pausada): não tocamos em nada.
      console.info('[evolution:webhook] não atendido pela IA:', decisao.motivo);
      // só registramos evento quando a IA estava ELEGÍVEL (paused), para não
      // gerar uma escrita por mensagem no volume de humanos do canary.
      if (decisao.modo === 'paused') await registrarEvento(numero, decisao, 'pausado');
      return NextResponse.json({ ok: true });
    }

    if (!(await primeiraVez(key.id))) return NextResponse.json({ ok: true }); // retry da Evolution — já tratamos essa mensagem

    const entrada0 = normalizarEntrada(data);
    if (!entrada0) return NextResponse.json({ ok: true });

    // Responde sempre no formato internacional BR (55…), que a Evolution espera.
    const destino = numero.startsWith('55') ? numero : `55${numero}`;

    // Menus do Evolution vão em texto numerado (botões/listas quebram no WA comum).
    // Se o paciente responder "1", "2"…, traduzimos para o(s) id(s) interativo(s)
    // esperado(s) pelo agente. "1 2 3" num menu de exames vira 3 entradas —
    // processadas em sequência abaixo, exatamente como 3 toques separados.
    let entradas: Entrada[] = [entrada0];
    if (entrada0.tipo === 'texto') {
      const ids = await resolverOpcaoEvolution(destino, entrada0.valor);
      if (ids?.length) entradas = ids.map((valor) => ({ tipo: 'interativo', valor }));
    }

    const t0 = Date.now();
    try {
      if (decisao.shadow) {
        // MODO SHADOW: roda o agente para produzir o rascunho, mas o
        // transporte de captura garante que NADA chega ao paciente. O
        // rascunho vai para o webhook de observação (Slack/Discord).
        const rascunhos: Array<Record<string, unknown>> = [];
        await comTransporte(transporteCaptura(rascunhos), async () => {
          for (const entrada of entradas) {
            await processarMensagem(destino, entrada, {
              pushName: typeof data?.pushName === 'string' ? data.pushName : undefined,
            });
          }
        });
        const textoEntrada = entrada0.tipo === 'texto' ? entrada0.valor : `[${entrada0.tipo}]`;
        await encaminharRascunhoShadow(destino, textoEntrada, rascunhos);
        await registrarEvento(numero, decisao, 'shadow', { ms: Date.now() - t0 });
        return NextResponse.json({ ok: true });
      }

      // AGUARDA o processamento (diferente do webhook da Meta): em runtime
      // serverless (Vercel), uma promise "solta" pode ser encerrada assim que
      // a resposta HTTP é enviada, antes do envio de saída terminar.
      await comTransporte(transporteEvolution, async () => {
        for (const entrada of entradas) {
          await processarMensagem(destino, entrada, {
            pushName: typeof data?.pushName === 'string' ? data.pushName : undefined,
          });
        }
      });
      await registrarEvento(numero, decisao, 'atendido', { ms: Date.now() - t0 });
    } catch (err) {
      await registrarEvento(numero, decisao, 'erro', {
        ms: Date.now() - t0,
        erro: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[evolution:webhook] erro:', e);
    return NextResponse.json({ ok: true, erro: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * `fromMe:true` chega tanto quando o PRÓPRIO agente manda uma resposta (eco,
 * pelo mesmo mecanismo de "dispositivo vinculado") quanto quando a RECEPÇÃO
 * digita direto no celular/PC — a Evolution manda os dois formatos idênticos,
 * sem nenhum campo que diga quem originou.
 *
 * Diferenciamos pelo id: `foiEnviadoPeloAgente` (evolution.ts) só é true para
 * ids que o PRÓPRIO agente gerou (marcados no envio). Se não é eco, é a
 * recepção respondendo de verdade — marcamos handoff para a IA não atropelar
 * uma conversa que já está sendo respondida por gente, mesmo que o número
 * caia no bucket do canary na mensagem seguinte.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tratarEcoOuHandoffHumano(key: any, data: any): Promise<void> {
  if (await foiEnviadoPeloAgente(key.id)) return; // eco do próprio agente
  const numero = extrairTelefone(key, data);
  if (!numero) return;
  await marcarHandoffHumano(numero);
  console.info('[evolution:webhook] recepção respondeu manualmente — handoff marcado');
}

/** Digitos de um JID WhatsApp (`5532…@s.whatsapp.net` → `5532…`). Ignora `@lid`. */
function digitosDeJid(jid: unknown): string {
  if (typeof jid !== 'string' || !jid) return '';
  if (jid.includes('@lid')) return '';
  return jid.replace(/@.*$/, '').replace(/\D/g, '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extrairTelefone(key: any, data: any): string {
  const candidatos = [
    digitosDeJid(key?.remoteJid),
    digitosDeJid(key?.remoteJidAlt),
    digitosDeJid(key?.participant),
    digitosDeJid(key?.participantAlt),
    String(data?.sender ?? '').replace(/\D/g, ''),
  ].filter((n) => n.length >= 10);
  return candidatos[0] ?? '';
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
