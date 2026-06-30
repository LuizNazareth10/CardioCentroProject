import { NextRequest, NextResponse } from 'next/server';
import { autenticar, criarSessao, encerrarSessao } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json();
  const sessao = await autenticar(email, senha);
  if (!sessao) {
    return NextResponse.json({ erro: 'E-mail ou senha inválidos.' }, { status: 401 });
  }
  await criarSessao(sessao);
  return NextResponse.json({ ok: true, nome: sessao.nome });
}

export async function DELETE() {
  encerrarSessao();
  return NextResponse.json({ ok: true });
}
