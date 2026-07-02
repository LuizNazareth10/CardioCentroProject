export function fmtHora(iso: string): string {
  return iso.slice(11, 16);
}

export function fmtData(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** rótulo curto e humano de um dia: "qua 02/07" */
export function fmtDiaCurto(iso: string): string {
  const dateStr = iso.slice(0, 10);
  const d = new Date(`${dateStr}T12:00:00Z`);
  const [, m, day] = dateStr.split('-');
  return `${DIAS_CURTOS[d.getUTCDay()]} ${day}/${m}`;
}

export function fmtDataExtenso(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

export function hojeJF(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function idade(dataNascimento?: string): string {
  if (!dataNascimento) return '—';
  const nasc = new Date(dataNascimento);
  const diff = Date.now() - nasc.getTime();
  return `${Math.floor(diff / (365.25 * 24 * 3600 * 1000))} anos`;
}

export function iniciais(nome: string): string {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}
