import type { Agendamento, AparelhoConfig, Exame, Medico, SlotDisponivel, Weekday } from '../types';
import {
  GRID_MIN, addDays, ceilToGrid, fromISO, hhmmToMin, semanaQuinzenalAtiva, toISO, weekdayOf,
} from './time';

// ============================================================
// MOTOR DE AGENDAMENTO — dois modos:
//  1) MÉDICO: respeita janelas do médico, exames por janela,
//     duração por médico e disponibilidade quinzenal (quartas).
//  2) APARELHO (Mapa/Holter): slots fixos por dia, sexta bloqueada,
//     capacidade por slot (1 aparelho por horário).
// Regras gerais:
//  - exames começam em múltiplos de 15min
//  - um médico/aparelho nunca tem dois exames sobrepostos
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

/** duração (min) de um exame PARA ESTE médico (override do padrão) */
export function duracaoDoMedico(medico: Medico, exame: Exame): number {
  return medico.duracoes?.[exame.id] ?? exame.duracaoMin;
}

/** o médico oferece este exame nesta janela? (respeita exames da janela) */
function janelaOferece(medico: Medico, janela: { exames?: string[] }, exameId: string): boolean {
  return janela.exames ? janela.exames.includes(exameId) : medico.examesHabilitados.includes(exameId);
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

/** janelas de um médico num dia (respeita quinzenal) */
function janelasDoDia(medico: Medico, date: string) {
  const wd = weekdayOf(date);
  const ativa = semanaQuinzenalAtiva(date);
  return medico.disponibilidade.filter((j) => j.weekday === wd && (!j.quinzenal || ativa));
}

/** um bloco [inicio, fim) cabe livre nas janelas do médico naquele dia p/ o exame? */
function blocoLivre(
  medico: Medico,
  date: string,
  inicio: number,
  fim: number,
  exameId: string,
  ocupacoes: Array<[number, number]>,
): boolean {
  // precisa estar inteiramente dentro de ALGUMA janela que ofereça o exame
  const dentroDeJanela = janelasDoDia(medico, date).some(
    (j) => janelaOferece(medico, j, exameId) && hhmmToMin(j.inicio) <= inicio && fim <= hhmmToMin(j.fim),
  );
  if (!dentroDeJanela) return false;
  return !ocupacoes.some(([o1, o2]) => sobrepoe(inicio, fim, o1, o2));
}

/**
 * Gera slots livres para UM exame de médico.
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

    for (const medico of elegiveis) {
      const janelas = janelasDoDia(medico, date).filter((j) => janelaOferece(medico, j, exame.id));
      if (janelas.length === 0) continue;
      const ocup = ocupacoesDoDia(medico.id, date, agendamentos);
      const dur = duracaoDoMedico(medico, exame);

      for (const j of janelas) {
        const janInicio = hhmmToMin(j.inicio);
        const janFim = hhmmToMin(j.fim);
        for (let start = janInicio; start + dur <= janFim; start += GRID_MIN) {
          const end = start + dur;
          if (piso && date === piso.date && start < ceilToGrid(piso.min)) continue;
          if (piso && date < piso.date) continue;
          if (!ocup.some(([o1, o2]) => sobrepoe(start, end, o1, o2))) {
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

  slots.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return slots.slice(0, limite);
}

/**
 * Gera slots livres de um APARELHO (Mapa/Holter): horários fixos por dia,
 * sexta e fim de semana bloqueados, capacidade por slot.
 */
export function gerarSlotsAparelho(
  config: AparelhoConfig,
  agendamentos: Agendamento[],
  opts: { dataInicio: string; dias?: number; naoAntesDe?: string; limite?: number },
): SlotDisponivel[] {
  const { dataInicio, dias = 14, naoAntesDe, limite = 60 } = opts;
  const piso = naoAntesDe ? fromISO(naoAntesDe) : null;
  const slots: SlotDisponivel[] = [];

  for (let d = 0; d < dias && slots.length < limite; d++) {
    const date = addDays(dataInicio, d);
    const wd = weekdayOf(date);
    // sexta (5) e fim de semana (0,6) — clínica não abre no sábado p/ retirar
    if (wd === 5 || wd === 0 || wd === 6) continue;
    const horarios = config.slots[wd as Weekday] ?? [];

    for (const hhmm of horarios) {
      const start = hhmmToMin(hhmm);
      if (piso && date === piso.date && start < ceilToGrid(piso.min)) continue;
      if (piso && date < piso.date) continue;

      const ocupados = agendamentos.filter(
        (a) =>
          a.exameId === config.exameId &&
          a.status !== 'cancelado' &&
          a.inicio.slice(0, 10) === date &&
          a.inicio.slice(11, 16) === hhmm,
      ).length;

      if (ocupados < config.capacidadePorSlot) {
        slots.push({
          medicoId: config.tipo, // "aparelho virtual" (mapa|holter)
          medicoNome: config.nome,
          inicio: toISO(date, start),
          fim: toISO(date, start + config.duracaoMin),
        });
      }
    }
  }

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
 * TODOS com o MESMO médico, num bloco contíguo dentro de UMA janela que
 * ofereça todos os exames. Fallback: distribui exame a exame preservando a
 * ordem cronológica.
 */
export function proporSessao(
  examesSeq: Exame[],
  medicos: Medico[],
  agendamentos: Agendamento[],
  opts: BuscaOpts,
): Proposta | null {
  const { dataInicio, dias = 14, medicoPreferidoId, naoAntesDe } = opts;
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
    for (const medico of candidatos) {
      const duracaoTotal = examesSeq.reduce((s, e) => s + duracaoDoMedico(medico, e), 0);
      const ocup = ocupacoesDoDia(medico.id, date, agendamentos);
      // só janelas que ofereçam TODOS os exames da sessão
      const janelas = janelasDoDia(medico, date).filter((j) =>
        examesSeq.every((e) => janelaOferece(medico, j, e.id)),
      );
      for (const j of janelas) {
        const janInicio = hhmmToMin(j.inicio);
        const janFim = hhmmToMin(j.fim);
        for (let start = janInicio; start + duracaoTotal <= janFim; start += GRID_MIN) {
          if (piso && date === piso.date && start < ceilToGrid(piso.min)) continue;
          if (piso && date < piso.date) continue;
          if (!ocup.some(([o1, o2]) => sobrepoe(start, start + duracaoTotal, o1, o2))) {
            let cursor = start;
            const itens: ItemProposta[] = examesSeq.map((e) => {
              const dur = duracaoDoMedico(medico, e);
              const item: ItemProposta = {
                exameId: e.id,
                exameNome: e.nome,
                medicoId: medico.id,
                medicoNome: medico.nome,
                inicio: toISO(date, cursor),
                fim: toISO(date, cursor + dur),
              };
              cursor += dur;
              return item;
            });
            return { mesmoMedico: true, itens };
          }
        }
      }
    }
  }

  // 2) fallback: distribui exame a exame pelo melhor slot disponível.
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
