import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

// =============================================================
// Defesa em profundidade da área restrita.
// Cada rota de API já valida a sessão individualmente; este
// middleware garante que NENHUMA página interna renderize sem
// cookie válido, mesmo que uma página nova esqueça a checagem.
// Roda no Edge Runtime — por isso usa jose (não bcrypt/fs).
// =============================================================

const COOKIE = 'cc_session';

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === 'production') return null; // fail-closed
  return new TextEncoder().encode(s || 'dev-secret-trocar');
}

export async function middleware(req: NextRequest) {
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
    '/dashboard/:path*',
    '/agenda/:path*',
    '/agendar/:path*',
    '/pacientes/:path*',
    '/atendimentos/:path*',
    '/simulador/:path*',
    '/configuracoes/:path*',
  ],
};
