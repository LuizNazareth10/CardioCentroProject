import { NextRequest, NextResponse } from 'next/server';
import { lerSessao } from '@/lib/auth';
import { definirStatusConversa, obterConversa, registrarMensagem } from '@/lib/db';
import { enviarTexto } from '@/lib/whatsapp/client';
import { limparSessao } from '@/lib/whatsapp/session';

// GET /api/atendimentos/{telefone} — detalhe da conversa
export async function GET(_req: NextRequest, { params }: { params: { telefone: string } }) {
  if (!(await lerSessao())) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const conversa = await obterConversa(params.telefone);
  if (!conversa) return NextResponse.json({ erro: 'conversa não encontrada' }, { status: 404 });
  return NextResponse.json({ conversa });
}

// POST /api/atendimentos/{telefone} — { acao: 'responder'|'assumir'|'resolver', texto? }
export async function POST(req: NextRequest, { params }: { params: { telefone: string } }) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });

  const telefone = params.telefone;
  const body = await req.json();
  const acao = body.acao as 'responder' | 'assumir' | 'resolver';

  if (acao === 'responder') {
    const texto = (body.texto ?? '').trim();
    if (!texto) return NextResponse.json({ erro: 'mensagem vazia' }, { status: 400 });
    // envia via WhatsApp Cloud API (em dev, apenas loga) e registra no histórico
    await enviarTexto(telefone, texto);
    const conversa = await registrarMensagem(
      telefone,
      { de: 'recepcao', texto, ts: new Date().toISOString() },
      { status: 'em_atendimento' },
    );
    return NextResponse.json({ conversa });
  }

  if (acao === 'assumir') {
    await definirStatusConversa(telefone, 'em_atendimento');
    return NextResponse.json({ ok: true });
  }

  if (acao === 'resolver') {
    await definirStatusConversa(telefone, 'resolvido');
    // devolve o controle ao agente: a próxima mensagem do paciente recomeça no menu
    limparSessao(telefone);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: 'ação inválida' }, { status: 400 });
}
