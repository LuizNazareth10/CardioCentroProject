import { NextRequest, NextResponse } from 'next/server';
import { processarMensagem, type Entrada } from '@/lib/whatsapp/agent';

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

// Recebimento de mensagens.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg) return NextResponse.json({ ok: true }); // status updates etc.

    const from = msg.from as string;
    const entrada = normalizar(msg);
    if (entrada) {
      // não bloquear a resposta ao webhook (Meta espera 200 rápido)
      processarMensagem(from, entrada).catch((e) => console.error('[agente] erro:', e));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[webhook] erro:', e);
    return NextResponse.json({ ok: true });
  }
}

function normalizar(msg: any): Entrada | null {
  if (msg.type === 'text') return { tipo: 'texto', valor: msg.text?.body ?? '' };
  if (msg.type === 'interactive') {
    const i = msg.interactive;
    if (i?.type === 'button_reply') return { tipo: 'interativo', valor: i.button_reply.id };
    if (i?.type === 'list_reply') return { tipo: 'interativo', valor: i.list_reply.id };
  }
  if (msg.type === 'button') return { tipo: 'interativo', valor: msg.button?.payload ?? msg.button?.text ?? '' };
  return null;
}
