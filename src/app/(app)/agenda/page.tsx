'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MEDICOS, EXAMES } from '@/lib/seed-data';
import type { Agendamento } from '@/lib/types';
import { hhmmToMin, minToHHMM, weekdayOf } from '@/lib/scheduling/time';
import { fmtDataExtenso, hojeJF } from '@/lib/format';

const GRID = 15;
const ROW_H = 40; // px por linha de 15min

export default function AgendaPage() {
  const router = useRouter();
  const [data, setData] = useState(hojeJF());
  const [ags, setAgs] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar(d: string) {
    setCarregando(true);
    const res = await fetch(`/api/agendamentos?de=${d}T00:00:00-03:00&ate=${d}T23:59:00-03:00`);
    const json = await res.json();
    setAgs(json.agendamentos ?? []);
    setCarregando(false);
  }

  useEffect(() => { carregar(data); }, [data]);

  const wd = weekdayOf(data);
  const medicosDoDia = MEDICOS.filter((m) => m.ativo && m.disponibilidade.some((j) => j.weekday === wd));

  // faixa de horas do dia (min..max das janelas dos médicos do dia)
  const { minDia, maxDia } = useMemo(() => {
    let lo = 24 * 60, hi = 0;
    medicosDoDia.forEach((m) =>
      m.disponibilidade.filter((j) => j.weekday === wd).forEach((j) => {
        lo = Math.min(lo, hhmmToMin(j.inicio));
        hi = Math.max(hi, hhmmToMin(j.fim));
      }),
    );
    if (lo > hi) { lo = 8 * 60; hi = 18 * 60; }
    return { minDia: lo, maxDia: hi };
  }, [data]);

  const linhas: number[] = [];
  for (let t = minDia; t < maxDia; t += GRID) linhas.push(t);

  const nomeExame = (id: string) => EXAMES.find((e) => e.id === id)?.nome ?? id;

  function celula(medicoId: string, t: number): { ag?: Agendamento; dentro: boolean } {
    const m = MEDICOS.find((x) => x.id === medicoId)!;
    const dentro = m.disponibilidade.some(
      (j) => j.weekday === wd && hhmmToMin(j.inicio) <= t && t < hhmmToMin(j.fim),
    );
    const ag = ags.find(
      (a) => a.medicoId === medicoId && a.status !== 'cancelado' &&
        hhmmToMin(a.inicio.slice(11, 16)) <= t && t < hhmmToMin(a.fim.slice(11, 16)),
    );
    return { ag, dentro };
  }

  function ehInicio(ag: Agendamento, t: number) {
    return hhmmToMin(ag.inicio.slice(11, 16)) === t;
  }
  function spanDe(ag: Agendamento) {
    return (hhmmToMin(ag.fim.slice(11, 16)) - hhmmToMin(ag.inicio.slice(11, 16))) / GRID;
  }

  /** clique num horário livre → abre a tela de agendamento já com médico/data/hora preenchidos */
  function abrirAgendamentoNoSlot(medicoId: string, t: number) {
    const params = new URLSearchParams({ medico: medicoId, data, hora: minToHHMM(t) });
    router.push(`/agendar?${params.toString()}`);
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Agenda</h1>
          <p className="text-sm capitalize text-muted">{fmtDataExtenso(data)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-outline" onClick={() => setData(shift(data, -1))}>←</button>
          <input type="date" className="input w-auto" value={data} onChange={(e) => setData(e.target.value)} />
          <button className="btn-outline" onClick={() => setData(shift(data, 1))}>→</button>
          <button className="btn-ghost" onClick={() => setData(hojeJF())}>Hoje</button>
        </div>
      </header>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-white border border-navy-100" /> Livre · clique para agendar</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-navyblue" /> Ocupado</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-navy-50 border border-navy-100" /> Fora do expediente</span>
      </div>

      {medicosDoDia.length === 0 ? (
        <div className="mt-6 card p-10 text-center text-sm text-muted">Nenhum médico disponível neste dia.</div>
      ) : (
        <div className="mt-4 card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              {/* cabeçalho de médicos */}
              <div
                className="sticky top-0 z-20 grid border-b border-navy-200 bg-white/95 backdrop-blur-sm"
                style={{ gridTemplateColumns: `76px repeat(${medicosDoDia.length}, 1fr)` }}
              >
                <div className="px-2 py-3" />
                {medicosDoDia.map((m) => (
                  <div key={m.id} className="border-l border-navy-100 px-3 py-3">
                    <div className="truncate text-sm font-bold text-navy-900">{m.nome}</div>
                    <div className="truncate text-[11px] text-muted">{m.especialidade ?? m.crm}</div>
                  </div>
                ))}
              </div>

              {/* linhas de horário */}
              <div className="relative">
                {carregando && <div className="absolute inset-0 z-10 grid place-items-center bg-white/60 text-sm text-muted">Carregando…</div>}
                {linhas.map((t) => {
                  const hora = t % 60 === 0;
                  const meia = t % 60 === 30;
                  return (
                    <div
                      key={t}
                      className={`grid ${hora ? 'border-t-2 border-navy-200' : meia ? 'border-t border-navy-100' : 'border-t border-navy-100/40'}`}
                      style={{ gridTemplateColumns: `76px repeat(${medicosDoDia.length}, 1fr)`, height: ROW_H }}
                    >
                      <div className={`px-2 py-1 text-right text-[11px] ${hora ? 'font-bold text-navy-800' : 'text-muted'}`}>
                        {hora ? minToHHMM(t) : meia ? minToHHMM(t) : ''}
                      </div>
                      {medicosDoDia.map((m) => {
                        const { ag, dentro } = celula(m.id, t);
                        if (ag && !ehInicio(ag, t)) return <div key={m.id} className="border-l border-navy-100/60" />;
                        if (ag) {
                          const span = spanDe(ag);
                          return (
                            <div key={m.id} className="relative border-l border-navy-100/60 p-0.5">
                              <button
                                type="button"
                                onClick={() => router.push(`/pacientes/${ag.pacienteId}`)}
                                className="absolute inset-x-0.5 overflow-hidden rounded-lg bg-navyblue px-2.5 py-1.5 text-left text-white shadow-soft transition hover:bg-navyblue-700"
                                style={{ height: `calc(${span * ROW_H}px - 4px)` }}
                              >
                                <div className="truncate text-[11px] font-bold">{ag.pacienteNome}</div>
                                <div className="truncate text-[10px] text-white/75">{nomeExame(ag.exameId)}</div>
                              </button>
                            </div>
                          );
                        }
                        return dentro ? (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => abrirAgendamentoNoSlot(m.id, t)}
                            title={`Agendar com ${m.nome} às ${minToHHMM(t)}`}
                            className={`group relative border-l border-navy-100/60 bg-white transition-colors hover:bg-cardio/10 ${hora ? 'bg-white' : ''}`}
                          >
                            <span className="pointer-events-none absolute inset-1 rounded-md opacity-0 ring-1 ring-inset ring-cardio/40 transition-opacity group-hover:opacity-100" />
                          </button>
                        ) : (
                          <div key={m.id} className="border-l border-navy-100/60 bg-navy-50/60" />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function shift(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
