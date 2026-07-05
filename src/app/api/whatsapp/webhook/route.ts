import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { carregarClinicConfig } from '@/lib/clinic-config';
import { registrarMensagem } from '@/lib/db';
import { processarMensagem, type Entrada } from '@/lib/whatsapp/agent';
import { enviarTexto } from '@/lib/whatsapp/client';

// Verificação do webhook exigida pela Meta ao configurar.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

/**
 * Valida a assinatura HMAC-SHA256 (X-Hub-Signature-256) que a Meta envia,
 * assinada com o App Secret. Só é aplicada quando WHATSAPP_APP_SECRET existe
 * (em dev/demo sem segredo, a checagem é ignorada). Usa o corpo CRU.
 */
function assinaturaValida(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // sem segredo configurado → não valida (dev)
  if (!header?.startsWith('sha256=')) return false;
  const esperado = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Recebimento de mensagens.
export async function POST(req: NextRequest) {
  try {
    // corpo cru é necessário para validar a assinatura antes de confiar no JSON
    const raw = await req.text();
    if (!assinaturaValida(raw, req.headers.get('x-hub-signature-256'))) {
      return new NextResponse('invalid signature', { status: 401 });
    }
    const body = JSON.parse(raw || '{}');
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg) return NextResponse.json({ ok: true }); // status updates etc.

    const from = msg.from as string;
    const entrada = normalizar(msg);
    if (entrada) {
      // não bloquear a resposta ao webhook (Meta espera 200 rápido)
      tratarEntrada(from, entrada).catch((e) =>
        console.error(`[agente] erro (from=${from}, tipo=${entrada.tipo}):`, e),
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[webhook] erro:', e);
    return NextResponse.json({ ok: true });
  }
}

/**
 * Roteia a mensagem: se o agente estiver LIGADO nas configurações,
 * processa normalmente; se estiver DESLIGADO (modo manual), registra a
 * mensagem na fila humana (/atendimentos) e envia a resposta automática.
 */
async function tratarEntrada(from: string, entrada: Entrada): Promise<void> {
  const { agente } = await carregarClinicConfig();
  if (agente.ativo) return processarMensagem(from, entrada);

  const texto = entrada.tipo === 'imagem' ? '📷 (enviou uma imagem)' : entrada.valor;
  await registrarMensagem(
    from,
    { de: 'paciente', texto, ts: new Date().toISOString() },
    { status: 'aguardando' },
  );
  await enviarTexto(from, agente.mensagemForaDoAr);
}

function normalizar(msg: any): Entrada | null {
  if (msg.type === 'text') return { tipo: 'texto', valor: msg.text?.body ?? '' };
  if (msg.type === 'image' && msg.image?.id) {
    return { tipo: 'imagem', valor: msg.image.id, mime: msg.image.mime_type ?? 'image/jpeg' };
  }
  if (msg.type === 'interactive') {
    const i = msg.interactive;
    if (i?.type === 'button_reply') return { tipo: 'interativo', valor: i.button_reply.id };
    if (i?.type === 'list_reply') return { tipo: 'interativo', valor: i.list_reply.id };
  }
  if (msg.type === 'button') return { tipo: 'interativo', valor: msg.button?.payload ?? msg.button?.text ?? '' };
  return null;
}
