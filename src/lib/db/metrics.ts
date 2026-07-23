// =============================================================
// Instrumentação da camada de dados.
//
// Mede, por operação: duração e QUANTOS DOCUMENTOS foram lidos do
// Firestore. A contagem de documentos é o número que importa — no
// Firestore o custo (tempo E dinheiro) é por documento lido, não por
// query. Uma query que devolve 94 mil documentos para exibir 40 é o
// tipo de problema que este módulo existe para tornar visível.
//
// Ligado com DB_METRICS=1. Desligado, o overhead é uma comparação booleana.
// =============================================================

export interface AmostraOperacao {
  /** nome da operação, ex.: "listarAgendamentos(de,ate)" */
  op: string;
  /** milissegundos decorridos */
  ms: number;
  /** documentos lidos do banco nesta operação */
  docs: number;
}

const ligado = () => process.env.DB_METRICS === '1';

/** amostras acumuladas no processo (usado pelo script de medição) */
const amostras: AmostraOperacao[] = [];

export function registrarAmostra(a: AmostraOperacao): void {
  if (!ligado()) return;
  amostras.push(a);
  const alerta = a.docs >= 1000 ? ' ⚠️ LEITURA EM MASSA' : '';
  console.info(`[db] ${a.op} — ${a.ms.toFixed(0)}ms · ${a.docs} doc(s)${alerta}`);
}

/** Envolve uma operação de leitura, medindo tempo e documentos lidos. */
export async function medir<T>(op: string, fn: () => Promise<T>, contarDocs: (r: T) => number): Promise<T> {
  if (!ligado()) return fn();
  const t0 = Date.now();
  const r = await fn();
  registrarAmostra({ op, ms: Date.now() - t0, docs: contarDocs(r) });
  return r;
}

export function coletarAmostras(): AmostraOperacao[] {
  return [...amostras];
}

export function limparAmostras(): void {
  amostras.length = 0;
}

/** Agrega as amostras por operação — base do relatório de performance. */
export function resumo(): Array<{ op: string; chamadas: number; msTotal: number; docsTotal: number; docsPorChamada: number }> {
  const porOp = new Map<string, { chamadas: number; msTotal: number; docsTotal: number }>();
  for (const a of amostras) {
    const atual = porOp.get(a.op) ?? { chamadas: 0, msTotal: 0, docsTotal: 0 };
    atual.chamadas += 1;
    atual.msTotal += a.ms;
    atual.docsTotal += a.docs;
    porOp.set(a.op, atual);
  }
  return [...porOp.entries()]
    .map(([op, v]) => ({ ...v, op, docsPorChamada: Math.round(v.docsTotal / v.chamadas) }))
    .sort((a, b) => b.docsTotal - a.docsTotal);
}
