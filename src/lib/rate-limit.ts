import type { NextRequest } from 'next/server';

// =============================================================
// Rate limiting simples em memória (janela deslizante por chave).
// Protege login e endpoints públicos contra força bruta e spam.
//
// LIMITAÇÃO conhecida: em serverless (Vercel) cada instância tem
// seu próprio Map — o limite vale por instância, não globalmente.
// Ainda assim barra a maioria dos ataques (que reutilizam conexão
// e caem na mesma instância). Para limite global, usar Upstash
// Redis ou Firestore — ver docs/DIAGNOSTICO.md.
// =============================================================

const buckets = new Map<string, number[]>();
const MAX_KEYS = 5000; // evita crescimento sem fim da memória

/**
 * Retorna true se a ação é PERMITIDA para esta chave.
 * @param chave   identificador (ex.: "login:1.2.3.4")
 * @param limite  nº máximo de ações dentro da janela
 * @param janelaMs tamanho da janela em ms
 */
export function permitir(chave: string, limite: number, janelaMs: number): boolean {
  const agora = Date.now();
  const historico = (buckets.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (historico.length >= limite) {
    buckets.set(chave, historico);
    return false;
  }
  historico.push(agora);
  if (!buckets.has(chave) && buckets.size >= MAX_KEYS) {
    // descarta a chave mais antiga para abrir espaço
    const primeira = buckets.keys().next().value;
    if (primeira) buckets.delete(primeira);
  }
  buckets.set(chave, historico);
  return true;
}

/** Extrai o IP do cliente (atrás do proxy da Vercel/Cloudflare). */
export function ipDoRequest(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'desconhecido'
  );
}
