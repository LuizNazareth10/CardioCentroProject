import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { OPERACAO_SUSPENSA, respostaSuspensa } from '@/lib/suspensao';

// =============================================================
// Defesa em profundidade da área restrita.
// Cada rota de API já valida a sessão individualmente; este
// middleware garante que NENHUMA página interna renderize sem
// cookie válido, mesmo que uma página nova esqueça a checagem.
// Roda no Edge Runtime — por isso usa jose (não bcrypt/fs).
//
// SUSPENSÃO (ago/2026): com OPERACAO_SUSPENSA, este middleware é também o
// portão único que desliga a área restrita INTEIRA — inclusive o /login,
// que passa a redirecionar para a landing. Fica ANTES da checagem de
// sessão de propósito: assim nem quem ainda tem cookie válido no navegador
// consegue abrir uma tela interna. Ver src/lib/suspensao.ts.
//
// O matcher passou a cobrir TODO o /api/* por causa da suspensão: são 26
// handlers em 14 arquivos, e desligar um por um convida a esquecer
// exatamente aquele que importa (o webhook do WhatsApp). Um portão só, aqui,
// é o que se consegue auditar de uma olhada. Fora da suspensão o middleware
// devolve `next()` para /api sem opinar — cada rota continua validando a
// própria sessão, como sempre fez.
//
// A landing NÃO consome nenhuma rota de /api desde que o formulário de
// leads virou CTA de WhatsApp/telefone (ver Agendamento.tsx), então cobrir
// /api/* inteiro não derruba nada do que fica no ar.
// =============================================================

const COOKIE = 'cc_session';

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === 'production') return null; // fail-closed
  return new TextEncoder().encode(s || 'dev-secret-trocar');
}

export async function middleware(req: NextRequest) {
  const ehApi = req.nextUrl.pathname.startsWith('/api/');

  // Portão da suspensão: área restrita fora do ar, tudo cai na landing.
  // API responde 503 em vez de redirecionar — quem chama /api é webhook ou
  // fetch, e um 302 para uma página HTML só produziria erro de parse do
  // outro lado, escondendo o motivo real.
  if (OPERACAO_SUSPENSA) {
    if (ehApi) return respostaSuspensa();
    // O cookie de sessão é apagado na passagem para que ninguém fique com
    // uma sessão pendurada por 7 dias esperando a volta.
    const res = NextResponse.redirect(new URL('/', req.url));
    res.cookies.delete(COOKIE);
    return res;
  }

  // Fora da suspensão, /api volta a ser assunto de cada rota.
  if (ehApi) return NextResponse.next();

  // /login entra no matcher só para poder ser bloqueado acima. Fora da
  // suspensão ele é público — sem esta saída, exigir sessão na própria
  // tela de login criaria um laço de redirecionamento infinito.
  if (req.nextUrl.pathname.startsWith('/login')) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  const loginUrl = new URL('/login', req.url);

  if (!token) return NextResponse.redirect(loginUrl);
  const key = secret();
  if (!key) {
    console.error('[middleware] AUTH_SECRET ausente em produção — bloqueando área restrita.');
    return NextResponse.redirect(loginUrl);
  }
  try {
    await jwtVerify(token, key);
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete(COOKIE); // remove cookie inválido/expirado
    return res;
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    '/login/:path*',
    '/login',
    '/dashboard/:path*',
    '/agenda/:path*',
    '/agendar/:path*',
    '/pacientes/:path*',
    '/atendimentos/:path*',
    '/simulador/:path*',
    '/configuracoes/:path*',
  ],
};
