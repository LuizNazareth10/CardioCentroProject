import { NextRequest, NextResponse } from 'next/server';
import { autenticar, criarSessao, encerrarSessao } from '@/lib/auth';
import { ipDoRequest, permitir } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // proteção contra força bruta: 8 tentativas por IP a cada 10 minutos
  const ip = ipDoRequest(req);
  if (!permitir(`login:${ip}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json(
      { erro: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }
  const { email, senha } = (body ?? {}) as { email?: unknown; senha?: unknown };
  if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) {
    return NextResponse.json({ erro: 'Informe e-mail e senha.' }, { status: 400 });
  }

  const sessao = await autenticar(email.trim().toLowerCase(), senha);
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
