'use client';

import { useEffect, useMemo, useState } from 'react';
import { MEDICOS, EXAMES } from '@/lib/seed-data';
import type { Agendamento } from '@/lib/types';
import { hhmmToMin, minToHHMM, weekdayOf } from '@/lib/scheduling/time';
import { fmtDataExtenso, hojeJF } from '@/lib/format';

const GRID = 15;

export default function AgendaPage() {
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

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Agenda</h1>
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
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-white border border-navy-100" /> Livre</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-navy-700" /> Ocupado</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-navy-50 border border-navy-100" /> Fora do expediente</span>
      </div>

      {medicosDoDia.length === 0 ? (
        <div className="mt-6 card p-10 text-center text-sm text-muted">Nenhum médico disponível neste dia.</div>
      ) : (
        <div className="mt-4 card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* cabeçalho de médicos */}
              <div className="grid border-b border-navy-100" style={{ gridTemplateColumns: `72px repeat(${medicosDoDia.length}, 1fr)` }}>
                <div className="px-2 py-3" />
                {medicosDoDia.map((m) => (
                  <div key={m.id} className="border-l border-navy-100 px-3 py-3">
                    <div className="text-sm font-bold text-navy-900">{m.nome}</div>
                    <div className="text-[11px] text-muted">{m.crm}</div>
                  </div>
                ))}
              </div>

              {/* linhas de horário */}
              <div className="relative">
                {carregando && <div className="absolute inset-0 z-10 grid place-items-center bg-white/60 text-sm text-muted">Carregando…</div>}
                {linhas.map((t) => (
                  <div key={t} className="grid border-b border-navy-100/50"
                    style={{ gridTemplateColumns: `72px repeat(${medicosDoDia.length}, 1fr)`, minHeight: 34 }}>
                    <div className={`px-2 py-1 text-right text-[11px] ${t % 60 === 0 ? 'font-bold text-navy-700' : 'text-muted'}`}>
                      {minToHHMM(t)}
                    </div>
                    {medicosDoDia.map((m) => {
                      const { ag, dentro } = celula(m.id, t);
                      if (ag && !ehInicio(ag, t)) return <div key={m.id} className="border-l border-navy-100/50" />;
                      if (ag) {
                        const span = spanDe(ag);
                        return (
                          <div key={m.id} className="relative border-l border-navy-100/50 p-0.5">
                            <div className="absolute inset-x-0.5 rounded-lg bg-navy-700 px-2 py-1 text-white shadow-sm"
                              style={{ height: `calc(${span * 34}px - 4px)` }}>
                              <div className="truncate text-[11px] font-bold">{ag.pacienteNome}</div>
                              <div className="truncate text-[10px] text-white/75">{nomeExame(ag.exameId)}</div>
                            </div>
                          </div>
                        );
                      }
                      return <div key={m.id} className={`border-l border-navy-100/50 ${dentro ? 'bg-white hover:bg-brand-red/5' : 'bg-navy-50/60'}`} />;
                    })}
                  </div>
                ))}
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
