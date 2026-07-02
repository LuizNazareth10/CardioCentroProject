'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { APARELHOS, MEDICOS, EXAMES } from '@/lib/seed-data';
import type { Agendamento, Medico, StatusAgendamento, TipoAparelho, Weekday } from '@/lib/types';
import { hhmmToMin, minToHHMM, semanaQuinzenalAtiva, weekdayOf } from '@/lib/scheduling/time';
import { fmtDataExtenso, hojeJF } from '@/lib/format';

const GRID = 15;
const ROW_H = 40; // px por linha de 15min

type Coluna =
  | { key: string; tipo: 'medico'; nome: string; sub: string; medico: Medico; atende: boolean }
  | { key: string; tipo: 'aparelho'; nome: string; sub: string; aparelho: TipoAparelho; slots: Set<number>; atende: boolean };

function nowMinJF(): number {
  const s = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false });
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export default function AgendaPage() {
  const router = useRouter();
  const [data, setData] = useState(hojeJF());
  const [ags, setAgs] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [acaoAg, setAcaoAg] = useState<Agendamento | null>(null);
  const [tick, setTick] = useState(0); // move a linha de "agora"

  const carregar = useCallback(async (d: string) => {
    setCarregando(true);
    const res = await fetch(`/api/agendamentos?de=${d}T00:00:00-03:00&ate=${d}T23:59:00-03:00`);
    const json = await res.json();
    setAgs(json.agendamentos ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(data); }, [data, carregar]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 60_000); return () => clearInterval(id); }, []);

  const wd = weekdayOf(data);
  const semanaAtiva = semanaQuinzenalAtiva(data);
  const ehHoje = data === hojeJF();

  const janelasDia = useCallback(
    (m: Medico) => m.disponibilidade.filter((j) => j.weekday === wd && (!j.quinzenal || semanaAtiva)),
    [wd, semanaAtiva],
  );

  // resumo do horário de atendimento do médico no dia (ex.: "08:00–12:00")
  const resumoJanelas = useCallback(
    (m: Medico) =>
      janelasDia(m)
        .slice()
        .sort((a, b) => hhmmToMin(a.inicio) - hhmmToMin(b.inicio))
        .map((j) => `${j.inicio}–${j.fim}`)
        .join(' · '),
    [janelasDia],
  );

  const slotsAparelho = (tipo: TipoAparelho): string[] =>
    (wd === 5 || wd === 0 || wd === 6 ? [] : APARELHOS[tipo].slots[wd as Weekday] ?? []);
  const mapaSlots = slotsAparelho('mapa');
  const holterSlots = slotsAparelho('holter');

  // colunas: TODOS os médicos ativos (sempre) + MAPA + HOLTER
  const colunas: Coluna[] = useMemo(() => {
    const cols: Coluna[] = MEDICOS.filter((m) => m.ativo).map((m) => ({
      key: m.id, tipo: 'medico' as const, nome: m.nome,
      sub: m.especialidade ?? 'Cardiologista', medico: m, atende: janelasDia(m).length > 0,
    }));
    cols.push({ key: 'mapa', tipo: 'aparelho', nome: 'MAPA', sub: `${APARELHOS.mapa.capacidade} aparelhos`, aparelho: 'mapa', slots: new Set(mapaSlots.map(hhmmToMin)), atende: mapaSlots.length > 0 });
    cols.push({ key: 'holter', tipo: 'aparelho', nome: 'HOLTER', sub: `${APARELHOS.holter.capacidade} aparelhos`, aparelho: 'holter', slots: new Set(holterSlots.map(hhmmToMin)), atende: holterSlots.length > 0 });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // faixa de horas (união das janelas ativas + slots de aparelho)
  const { minDia, maxDia } = useMemo(() => {
    let lo = 24 * 60, hi = 0;
    MEDICOS.filter((m) => m.ativo).forEach((m) =>
      janelasDia(m).forEach((j) => { lo = Math.min(lo, hhmmToMin(j.inicio)); hi = Math.max(hi, hhmmToMin(j.fim)); }),
    );
    [...mapaSlots, ...holterSlots].forEach((h) => { const t = hhmmToMin(h); lo = Math.min(lo, t); hi = Math.max(hi, t + GRID); });
    if (lo > hi) { lo = 8 * 60; hi = 18 * 60; }
    lo = Math.floor(lo / 60) * 60; // arredonda p/ hora cheia (grade limpa)
    hi = Math.ceil(hi / 30) * 30;
    return { minDia: lo, maxDia: hi };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const linhas: number[] = [];
  for (let t = minDia; t < maxDia; t += GRID) linhas.push(t);

  const nomeExame = (id: string) => EXAMES.find((e) => e.id === id)?.nome ?? id;

  function celulaMedico(m: Medico, t: number): { ag?: Agendamento; dentro: boolean } {
    const dentro = janelasDia(m).some((j) => hhmmToMin(j.inicio) <= t && t < hhmmToMin(j.fim));
    const ag = ags.find(
      (a) => a.medicoId === m.id && a.status !== 'cancelado' &&
        hhmmToMin(a.inicio.slice(11, 16)) <= t && t < hhmmToMin(a.fim.slice(11, 16)),
    );
    return { ag, dentro };
  }
  const apptAparelho = (tipo: TipoAparelho, t: number) =>
    ags.find((a) => a.exameId === tipo && a.status !== 'cancelado' && hhmmToMin(a.inicio.slice(11, 16)) === t);

  const ehInicio = (ag: Agendamento, t: number) => hhmmToMin(ag.inicio.slice(11, 16)) === t;
  const spanDe = (ag: Agendamento) =>
    Math.max(1, (hhmmToMin(ag.fim.slice(11, 16)) - hhmmToMin(ag.inicio.slice(11, 16))) / GRID);

  function abrir(medicoOuAparelho: { medico?: string; aparelho?: TipoAparelho }, t: number) {
    const p = new URLSearchParams({ data, hora: minToHHMM(t) });
    if (medicoOuAparelho.medico) p.set('medico', medicoOuAparelho.medico);
    if (medicoOuAparelho.aparelho) p.set('aparelho', medicoOuAparelho.aparelho);
    router.push(`/agendar?${p.toString()}`);
  }

  async function mudarStatus(id: string, status: StatusAgendamento) {
    await fetch('/api/agendamentos', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setAcaoAg(null);
    carregar(data);
  }

  const statusCor: Record<StatusAgendamento, string> = {
    agendado: 'bg-navyblue', confirmado: 'bg-info', realizado: 'bg-success',
    faltou: 'bg-warning', cancelado: 'bg-gray-400',
  };

  const blocoOcupado = (ag: Agendamento, span: number) => (
    <button
      type="button"
      onClick={() => setAcaoAg(ag)}
      className={`absolute inset-x-0.5 overflow-hidden rounded-lg px-2.5 py-1.5 text-left text-white shadow-soft transition hover:brightness-110 ${statusCor[ag.status]}`}
      style={{ height: `calc(${span * ROW_H}px - 4px)` }}
      title={`${ag.pacienteNome} · ${nomeExame(ag.exameId)} (${ag.status})`}
    >
      <div className="truncate text-[11px] font-bold">{ag.pacienteNome}</div>
      <div className="truncate text-[10px] text-white/75">{nomeExame(ag.exameId)}</div>
    </button>
  );

  const nowMin = nowMinJF();
  const mostraAgora = ehHoje && nowMin >= minDia && nowMin < maxDia;
  const topoAgora = ((nowMin - minDia) / GRID) * ROW_H;
  void tick; // dependência que reposiciona a linha a cada minuto

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Agenda</h1>
          <p className="text-sm capitalize text-muted">{fmtDataExtenso(data)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-outline" aria-label="Dia anterior" onClick={() => setData(shift(data, -1))}>←</button>
          <input type="date" className="input w-auto" value={data} onChange={(e) => setData(e.target.value)} />
          <button className="btn-outline" aria-label="Próximo dia" onClick={() => setData(shift(data, 1))}>→</button>
          <button className="btn-ghost" onClick={() => setData(hojeJF())}>Hoje</button>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="slot-livre h-3.5 w-3.5 rounded ring-1 ring-inset ring-success/30" /> Livre · clique para agendar</span>
        <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-navyblue" /> Ocupado (clique p/ gerenciar)</span>
        <span className="flex items-center gap-1.5"><i className="slot-bloqueado h-3.5 w-3.5 rounded ring-1 ring-inset ring-navy-100" /> Bloqueado · fora do horário</span>
        <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-cardio" /> Agora</span>
      </div>

      <div className="mt-4 card overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 90 + colunas.length * 138 }}>
            {/* cabeçalho */}
            <div
              className="sticky top-0 z-20 grid border-b border-navy-200 bg-white/95 backdrop-blur-sm"
              style={{ gridTemplateColumns: `72px repeat(${colunas.length}, 1fr)` }}
            >
              <div className="px-2 py-3" />
              {colunas.map((c) => {
                const horario = c.tipo === 'medico' && c.atende ? resumoJanelas(c.medico) : '';
                return (
                  <div
                    key={c.key}
                    className={`border-l px-3 py-2.5 ${c.tipo === 'aparelho' ? 'border-navy-200 bg-cardio/5' : 'border-navy-100'} ${!c.atende ? 'bg-navy-50/40' : ''}`}
                  >
                    <div className={`flex items-center gap-1.5`}>
                      <span className={`h-1.5 w-1.5 flex-none rounded-full ${!c.atende ? 'bg-navy-200' : c.tipo === 'aparelho' ? 'bg-cardio' : 'bg-success'}`} />
                      <span className={`truncate text-sm font-bold ${!c.atende ? 'text-muted' : c.tipo === 'aparelho' ? 'text-cardio-700' : 'text-navy-900'}`}>{c.nome}</span>
                    </div>
                    <div className="truncate text-[11px] text-muted">{c.atende ? c.sub : 'Sem atendimento hoje'}</div>
                    {c.atende && (
                      <div className={`mt-1 truncate text-[10px] font-semibold ${c.tipo === 'aparelho' ? 'text-cardio-700/80' : 'text-success'}`}>
                        {c.tipo === 'medico' ? `🕐 ${horario}` : `${c.slots.size} horários fixos`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* linhas */}
            <div className="relative">
              {carregando && <div className="absolute inset-0 z-30 grid place-items-center bg-white/60 text-sm text-muted">Carregando…</div>}

              {/* linha do horário atual */}
              {mostraAgora && (
                <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: topoAgora }}>
                  <span className="ml-[60px] h-2 w-2 flex-none rounded-full bg-cardio" />
                  <span className="h-px flex-1 bg-cardio/70" />
                </div>
              )}

              {linhas.map((t) => {
                const hora = t % 60 === 0;
                const meia = t % 60 === 30;
                return (
                  <div
                    key={t}
                    className={`grid ${hora ? 'border-t-2 border-navy-200' : meia ? 'border-t border-navy-100' : 'border-t border-navy-100/40'}`}
                    style={{ gridTemplateColumns: `72px repeat(${colunas.length}, 1fr)`, height: ROW_H }}
                  >
                    <div className={`px-2 py-1 text-right text-[11px] ${hora ? 'font-bold text-navy-800' : 'text-muted'}`}>
                      {hora || meia ? minToHHMM(t) : ''}
                    </div>

                    {colunas.map((c) => {
                      if (c.tipo === 'medico') {
                        // médico não atende hoje → coluna inteira bloqueada
                        if (!c.atende) return <div key={c.key} className="slot-off-dia border-l border-navy-100/60" />;
                        const { ag, dentro } = celulaMedico(c.medico, t);
                        if (ag && !ehInicio(ag, t)) return <div key={c.key} className="border-l border-navy-100/60" />;
                        if (ag) return <div key={c.key} className="relative border-l border-navy-100/60 p-0.5">{blocoOcupado(ag, spanDe(ag))}</div>;
                        // dentro da janela → LIVRE (verde, clicável); fora → BLOQUEADO (hachura)
                        return dentro
                          ? <CelulaLivre key={c.key} onClick={() => abrir({ medico: c.medico.id }, t)} titulo={`Agendar com ${c.medico.nome} às ${minToHHMM(t)}`} />
                          : <div key={c.key} className="slot-bloqueado border-l border-navy-100/60" title="Fora do horário de atendimento" />;
                      }
                      // aparelho: horário fixo válido → LIVRE; senão → BLOQUEADO
                      if (!c.slots.has(t)) return <div key={c.key} className="slot-bloqueado border-l border-navy-100/60" title="Sem coleta neste horário" />;
                      const ag = apptAparelho(c.aparelho, t);
                      if (ag) return <div key={c.key} className="relative border-l border-navy-100/60 p-0.5">{blocoOcupado(ag, 1)}</div>;
                      return <CelulaLivre key={c.key} onClick={() => abrir({ aparelho: c.aparelho }, t)} titulo={`Agendar ${c.nome} às ${minToHHMM(t)}`} />;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {acaoAg && <PopoverAcao ag={acaoAg} nomeExame={nomeExame} onFechar={() => setAcaoAg(null)} onStatus={mudarStatus} onFicha={() => router.push(`/pacientes/${acaoAg.pacienteId}`)} />}
    </div>
  );
}

// célula de horário LIVRE: faixa verde sempre visível + "+" ao passar o mouse
function CelulaLivre({ onClick, titulo }: { onClick: () => void; titulo: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className="slot-livre group relative border-l border-navy-100/60 transition-colors"
    >
      <span className="pointer-events-none absolute inset-1 rounded-md opacity-0 ring-1 ring-inset ring-success/50 transition-opacity group-hover:opacity-100" />
      <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-bold text-success opacity-0 transition-opacity group-hover:opacity-100">+</span>
    </button>
  );
}

function PopoverAcao({ ag, nomeExame, onFechar, onStatus, onFicha }: {
  ag: Agendamento; nomeExame: (id: string) => string; onFechar: () => void;
  onStatus: (id: string, s: StatusAgendamento) => void; onFicha: () => void;
}) {
  const acoes: Array<{ label: string; status?: StatusAgendamento; cls: string }> = [
    { label: 'Confirmar presença', status: 'confirmado', cls: 'text-info' },
    { label: 'Marcar como realizado', status: 'realizado', cls: 'text-success' },
    { label: 'Marcar falta', status: 'faltou', cls: 'text-warning' },
    { label: 'Cancelar (libera o horário)', status: 'cancelado', cls: 'text-brand-red' },
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-900/40 p-4" onClick={onFechar}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-bold text-navy-900">{ag.pacienteNome}</div>
        <div className="text-xs text-muted">
          {nomeExame(ag.exameId)} · {ag.inicio.slice(11, 16)}–{ag.fim.slice(11, 16)}
        </div>
        <span className="badge mt-2 bg-navy-50 text-navy-700 capitalize">{ag.status}</span>

        <div className="mt-4 space-y-1.5">
          <button onClick={onFicha} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-navy-700 hover:bg-navy-50">
            Ver ficha do paciente →
          </button>
          {acoes.map((a) => (
            <button
              key={a.label}
              disabled={ag.status === a.status}
              onClick={() => a.status && onStatus(ag.id, a.status)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-navy-50 disabled:opacity-40 ${a.cls}`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button onClick={onFechar} className="mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold text-muted hover:bg-navy-50">Fechar</button>
      </div>
    </div>
  );
}

function shift(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
