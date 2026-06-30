import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { obterUsuarioPorEmail } from './db';

const COOKIE = 'cc_session';
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-trocar');

export interface Sessao {
  userId: string;
  nome: string;
  papel: string;
}

export async function autenticar(email: string, senha: string): Promise<Sessao | null> {
  const u = await obterUsuarioPorEmail(email);
  if (!u || !u.ativo) return null;
  const ok = bcrypt.compareSync(senha, u.senhaHash);
  if (!ok) return null;
  return { userId: u.id, nome: u.nome, papel: u.papel };
}

export async function criarSessao(sessao: Sessao) {
  const token = await new SignJWT({ ...sessao })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export async function lerSessao(): Promise<Sessao | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: payload.userId as string, nome: payload.nome as string, papel: payload.papel as string };
  } catch {
    return null;
  }
}

export function encerrarSessao() {
  cookies().delete(COOKIE);
}
