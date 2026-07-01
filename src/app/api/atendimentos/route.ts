import { NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { listarConversas } from '@/lib/db';

// GET /api/atendimentos — fila de conversas do WhatsApp (handoff humano)
export async function GET() {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const conversas = await listarConversas();
  return NextResponse.json({ conversas });
}
