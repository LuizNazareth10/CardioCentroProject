import type { Agendamento, Exame, Medico, SlotDisponivel } from '../types';
import { GRID_MIN, addDays, ceilToGrid, fromISO, hhmmToMin, toISO, weekdayOf } from './time';

// ============================================================
// MOTOR DE AGENDAMENTO
// Regras:
//  - exames só começam/terminam em múltiplos de 15min
//  - um médico nunca tem dois exames sobrepostos
//  - é possível filtrar por médico de preferência
//  - exames consecutivos são priorizados com o MESMO médico
// ============================================================

interface BuscaOpts {
  /** data inicial "YYYY-MM-DD" (default: hoje JF) */
  dataInicio: string;
  /** quantos dias olhar à frente */
  dias?: number;
  /** se informado, só este médico é considerado */
  medicoPreferidoId?: string;
  /** não oferecer slots antes deste instante (ISO) — ex.: agora */
  naoAntesDe?: string;
  /** limite de slots retornados */
  limite?: number;
}

/** dois intervalos [a1,a2) e [b1,b2) se sobrepõem? */
function sobrepoe(a1: number, a2: number, b1: number, b2: number): boolean {
  return a1 < b2 && b1 < a2;
}

/** ocupações (em minutos) de um médico numa data, a partir dos agendamentos */
function ocupacoesDoDia(
  medicoId: string,
  date: string,
  agendamentos: Agendamento[],
): Array<[number, number]> {
  return agendamentos
    .filter(
      (a) =>
        a.medicoId === medicoId &&
        a.status !== 'cancelado' &&
        a.inicio.slice(0, 10) === date,
    )
    .map((a) => [fromISO(a.inicio).min, fromISO(a.fim).min] as [number, number]);
}

/** um bloco [inicio, fim) cabe livre na grade do médico naquele dia? */
function blocoLivre(
  medico: Medico,
  date: string,
  inicio: number,
  fim: number,
  ocupacoes: Array<[number, number]>,
): boolean {
  const wd = weekdayOf(date);
  // precisa estar inteiramente dentro de ALGUMA janela de disponibilidade
  const dentroDeJanela = medico.disponibilidade.some(
    (j) => j.weekday === wd && hhmmToMin(j.inicio) <= inicio && fim <= hhmmToMin(j.fim),
  );
  if (!dentroDeJanela) return false;
  // não pode colidir com nenhuma ocupação
  return !ocupacoes.some(([o1, o2]) => sobrepoe(inicio, fim, o1, o2));
}

/**
 * Gera slots livres para UM exame.
 * Se houver médico de preferência, só ele é considerado.
 */
export function gerarSlots(
  exame: Exame,
  medicos: Medico[],
  agendamentos: Agendamento[],
  opts: BuscaOpts,
): SlotDisponivel[] {
  const { dataInicio, dias = 14, medicoPreferidoId, naoAntesDe, limite = 60 } = opts;
  const elegiveis = medicos.filter(
    (m) =>
      m.ativo &&
      m.examesHabilitados.includes(exame.id) &&
      (!medicoPreferidoId || m.id === medicoPreferidoId),
  );

  const slots: SlotDisponivel[] = [];
  const piso = naoAntesDe ? fromISO(naoAntesDe) : null;

  for (let d = 0; d < dias && slots.length < limite; d++) {
    const date = addDays(dataInicio, d);
    const wd = weekdayOf(date);

    for (const medico of elegiveis) {
      const janelas = medico.disponibilidade.filter((j) => j.weekday === wd);
      if (janelas.length === 0) continue;
      const ocup = ocupacoesDoDia(medico.id, date, agendamentos);

      for (const j of janelas) {
        const janInicio = hhmmToMin(j.inicio);
        const janFim = hhmmToMin(j.fim);
        for (let start = janInicio; start + exame.duracaoMin <= janFim; start += GRID_MIN) {
          const end = start + exame.duracaoMin;
          // respeita "não antes de"
          if (piso && date === piso.date && start < ceilToGrid(piso.min)) continue;
          if (piso && date < piso.date) continue;
          if (blocoLivre(medico, date, start, end, ocup)) {
            slots.push({
              medicoId: medico.id,
              medicoNome: medico.nome,
              inicio: toISO(date, start),
              fim: toISO(date, end),
            });
          }
        }
      }
    }
  }

  // ordena por horário e limita
  slots.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return slots.slice(0, limite);
}

export interface ItemProposta {
  exameId: string;
  exameNome: string;
  medicoId: string;
  medicoNome: string;
  inicio: string;
  fim: string;
}

export interface Proposta {
  /** true se todos os exames ficaram com o mesmo médico, em sequência */
  mesmoMedico: boolean;
  itens: ItemProposta[];
}

/**
 * Para uma sequência de exames consecutivos (uma "sessão"), tenta encaixar
 * TODOS com o MESMO médico, em blocos contíguos. Se nenhum médico conseguir
 * o bloco inteiro, faz fallback distribuindo entre médicos preservando a
 * sequência temporal.
 */
export function proporSessao(
  examesSeq: Exame[],
  medicos: Medico[],
  agendamentos: Agendamento[],
  opts: BuscaOpts,
): Proposta | null {
  const { dataInicio, dias = 14, medicoPreferidoId, naoAntesDe } = opts;
  const duracaoTotal = examesSeq.reduce((s, e) => s + e.duracaoMin, 0);
  const piso = naoAntesDe ? fromISO(naoAntesDe) : null;

  // 1) tenta o mesmo médico para o bloco inteiro
  const candidatos = medicos.filter(
    (m) =>
      m.ativo &&
      examesSeq.every((e) => m.examesHabilitados.includes(e.id)) &&
      (!medicoPreferidoId || m.id === medicoPreferidoId),
  );

  for (let d = 0; d < dias; d++) {
    const date = addDays(dataInicio, d);
    const wd = weekdayOf(date);
    for (const medico of candidatos) {
      const janelas = medico.disponibilidade.filter((j) => j.weekday === wd);
      const ocup = ocupacoesDoDia(medico.id, date, agendamentos);
      for (const j of janelas) {
        const janInicio = hhmmToMin(j.inicio);
        const janFim = hhmmToMin(j.fim);
        for (let start = janInicio; start + duracaoTotal <= janFim; start += GRID_MIN) {
          if (piso && date === piso.date && start < ceilToGrid(piso.min)) continue;
          if (piso && date < piso.date) continue;
          if (blocoLivre(medico, date, start, start + duracaoTotal, ocup)) {
            // monta itens consecutivos
            let cursor = start;
            const itens: ItemProposta[] = examesSeq.map((e) => {
              const item: ItemProposta = {
                exameId: e.id,
                exameNome: e.nome,
                medicoId: medico.id,
                medicoNome: medico.nome,
                inicio: toISO(date, cursor),
                fim: toISO(date, cursor + e.duracaoMin),
              };
              cursor += e.duracaoMin;
              return item;
            });
            return { mesmoMedico: true, itens };
          }
        }
      }
    }
  }

  // 2) fallback: distribui exame a exame pelo melhor slot disponível,
  //    mantendo a ordem cronológica.
  const itens: ItemProposta[] = [];
  let cursorISO = naoAntesDe ?? toISO(dataInicio, 0);
  for (const e of examesSeq) {
    const slots = gerarSlots(e, medicos, agendamentos.concat(toAgs(itens)), {
      dataInicio,
      dias,
      medicoPreferidoId,
      naoAntesDe: cursorISO,
      limite: 1,
    });
    if (slots.length === 0) return null;
    const s = slots[0];
    itens.push({
      exameId: e.id,
      exameNome: e.nome,
      medicoId: s.medicoId,
      medicoNome: s.medicoNome,
      inicio: s.inicio,
      fim: s.fim,
    });
    cursorISO = s.fim;
  }
  const mesmo = itens.every((i) => i.medicoId === itens[0].medicoId);
  return { mesmoMedico: mesmo, itens };
}

/** converte itens de proposta em "agendamentos" temporários p/ checagem de conflito */
function toAgs(itens: ItemProposta[]): Agendamento[] {
  return itens.map((i, idx) => ({
    id: `tmp-${idx}`,
    pacienteId: 'tmp',
    pacienteNome: 'tmp',
    medicoId: i.medicoId,
    exameId: i.exameId,
    convenioId: 'tmp',
    inicio: i.inicio,
    fim: i.fim,
    status: 'agendado' as const,
    origem: 'sistema' as const,
    criadoEm: new Date().toISOString(),
  }));
}
