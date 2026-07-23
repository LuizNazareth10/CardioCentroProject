// =============================================================
// Monitoramento do rollout do agente.
//
// Registra um evento por mensagem recebida (decisão do rollout + desfecho)
// para dar VISIBILIDADE durante o teste com clientes reais: quantas leads a
// IA atendeu, quantas foram para humano, quantos rascunhos (shadow) e erros.
// No volume de um canary pequeno o custo de escrita é irrelevante.
//
// A coleção `agente_eventos` é efêmera por natureza; pode ter TTL no
// Firestore (recomendado: 30 dias) sem impacto no negócio.
// =============================================================

import type { DecisaoRollout } from './rollout';

export type DesfechoEvento = 'atendido' | 'humano' | 'shadow' | 'pausado' | 'erro';

export interface EventoAgente {
  ts: string;
  /** número mascarado (privacidade) */
  numero: string;
  bucket: number;
  modo: string;
  desfecho: DesfechoEvento;
  motivo: string;
  /** ms gastos processando (quando aplicável) */
  ms?: number;
  erro?: string;
}

const isFirestore = process.env.DATA_BACKEND === 'firestore';

function mascarar(telefone: string): string {
  const d = telefone.replace(/\D/g, '');
  if (d.length < 6) return '***';
  return `${d.slice(0, 4)}…${d.slice(-2)}`;
}

/**
 * Grava um evento. Fire-and-forget: NUNCA lança — monitorar não pode
 * derrubar o atendimento.
 */
export async function registrarEvento(
  telefone: string,
  decisao: DecisaoRollout,
  desfecho: DesfechoEvento,
  extra?: { ms?: number; erro?: string },
): Promise<void> {
  const evento: EventoAgente = {
    ts: new Date().toISOString(),
    numero: mascarar(telefone),
    bucket: decisao.bucket,
    modo: decisao.modo,
    desfecho,
    motivo: decisao.motivo,
    ...(extra?.ms !== undefined ? { ms: extra.ms } : {}),
    ...(extra?.erro ? { erro: extra.erro.slice(0, 300) } : {}),
  };
  if (!isFirestore) {
    console.info('[monitor]', JSON.stringify(evento));
    return;
  }
  try {
    const { db } = await import('../db/firestore');
    await db().collection('agente_eventos').add(evento);
  } catch (e) {
    console.error('[monitor] falha ao gravar evento (ignorado):', e);
  }
}

export interface ResumoMonitor {
  total: number;
  porDesfecho: Record<string, number>;
  ultimos: EventoAgente[];
}

/** Resumo dos últimos eventos, para o painel de monitoramento. */
export async function resumoMonitor(limite = 100): Promise<ResumoMonitor> {
  if (!isFirestore) return { total: 0, porDesfecho: {}, ultimos: [] };
  const { db } = await import('../db/firestore');
  const snap = await db().collection('agente_eventos').orderBy('ts', 'desc').limit(limite).get();
  const ultimos = snap.docs.map((d) => d.data() as EventoAgente);
  const porDesfecho: Record<string, number> = {};
  for (const e of ultimos) porDesfecho[e.desfecho] = (porDesfecho[e.desfecho] ?? 0) + 1;
  return { total: ultimos.length, porDesfecho, ultimos };
}
