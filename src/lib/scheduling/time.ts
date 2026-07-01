// Utilidades de tempo — operamos no fuso fixo de Juiz de Fora (BRT, -03:00).
// O Brasil não tem horário de verão desde 2019, então o offset é estável.

export const TZ_OFFSET = '-03:00';
export const GRID_MIN = 15; // grade de 15 minutos

/** "HH:MM" -> minutos desde a meia-noite */
export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** minutos desde a meia-noite -> "HH:MM" */
export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" + minutos -> ISO com offset de JF */
export function toISO(dateStr: string, min: number): string {
  return `${dateStr}T${minToHHMM(min)}:00${TZ_OFFSET}`;
}

/** ISO -> { date: "YYYY-MM-DD", min } no fuso de JF */
export function fromISO(iso: string): { date: string; min: number } {
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return { date, min: hhmmToMin(time) };
}

/** dia da semana (0=dom..6=sab) de uma data "YYYY-MM-DD" */
export function weekdayOf(dateStr: string): number {
  // meio-dia UTC evita virada de dia por fuso
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/** adiciona N dias a "YYYY-MM-DD" */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** arredonda para cima ao próximo múltiplo do grid */
export function ceilToGrid(min: number): number {
  return Math.ceil(min / GRID_MIN) * GRID_MIN;
}

// ============================================================
// Agenda quinzenal (Dr. Júlio Lovisi e Dra. Fernanda Lanzoni às quartas)
// A referência de semana "ativa" é 08/07/2026 (primeira quarta com os dois).
// Ativa quando Math.floor(diferençaEmSemanas) % 2 === 0 a partir da ref.
// ============================================================
export const QUINZENAL_REF = '2026-07-08';

/** true se a data "YYYY-MM-DD" cai numa semana quinzenal ativa */
export function semanaQuinzenalAtiva(dateStr: string): boolean {
  const ref = new Date(`${QUINZENAL_REF}T12:00:00Z`).getTime();
  const d = new Date(`${dateStr}T12:00:00Z`).getTime();
  const diffSemanas = (d - ref) / (7 * 24 * 60 * 60 * 1000);
  return Math.floor(diffSemanas) % 2 === 0;
}
