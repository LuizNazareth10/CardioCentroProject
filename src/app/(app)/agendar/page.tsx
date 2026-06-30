'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONVENIOS, EXAMES, MEDICOS } from '@/lib/seed-data';
import type { Paciente, SlotDisponivel } from '@/lib/types';
import type { Proposta } from '@/lib/scheduling/engine';
import { fmtData, fmtHora } from '@/lib/format';

type Passo = 1 | 2 | 3;

export default function AgendarPage() {
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>(1);

  // passo 1
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Paciente[]>([]);
  const [paciente, setPaciente] = useState<Paciente | null>(null);

  // passo 2
  const [exames, setExames] = useState<string[]>([]); // pode repetir (sessão)
  const [convenioId, setConvenioId] = useState('particular');
  const [medicoPref, setMedicoPref] = useState('');

  // passo 3
  const [slots, setSlots] = useState<SlotDisponivel[]>([]);
  const [proposta, setProposta] = useState<Proposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  // ---- busca de paciente ----
  useEffect(() => {
    if (busca.trim().length < 2) { setResultados([]); return; }
    const id = setTimeout(async () => {
      const res = await fetch(`/api/pacientes?q=${encodeURIComponent(busca)}`);
      setResultados((await res.json()).pacientes ?? []);
    }, 250);
    return () => clearTimeout(id);
  }, [busca]);

  function addExame(id: string) { setExames((e) => [...e, id]); }
  function removeExame(idx: number) { setExames((e) => e.filter((_, i) => i !== idx)); }

  async function buscarDisponibilidade() {
    setErro(''); setCarregando(true); setSlots([]); setProposta(null);
    const params = new URLSearchParams({ exames: exames.join(',') });
    if (medicoPref) params.set('medico', medicoPref);
    const res = await fetch(`/api/disponibilidade?${params}`);
    const json = await res.json();
    if (exames.length === 1) setSlots(json.slots ?? []);
    else setProposta(json.proposta ?? null);
    setCarregando(false);
    setPasso(3);
  }

  async function confirmarSlot(slot: SlotDisponivel) {
    await confirmar([{ exameId: exames[0], medicoId: slot.medicoId, inicio: slot.inicio, fim: slot.fim }]);
  }
  async function confirmarProposta() {
    if (!proposta) return;
    await confirmar(proposta.itens.map((i) => ({ exameId: i.exameId, medicoId: i.medicoId, inicio: i.inicio, fim: i.fim })));
  }

  async function confirmar(itens: Array<{ exameId: string; medicoId: string; inicio: string; fim: string }>) {
    if (!paciente) return;
    setErro(''); setCarregando(true);
    const payload = itens.map((i) => ({
      pacienteId: paciente.id, pacienteNome: paciente.nome,
      medicoId: i.medicoId, exameId: i.exameId, convenioId,
      inicio: i.inicio, fim: i.fim, status: 'agendado', origem: 'sistema',
    }));
    const res = await fetch('/api/agendamentos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itens: payload }),
    });
    setCarregando(false);
    if (res.ok) router.push('/agenda');
    else setErro((await res.json()).erro ?? 'Falha ao agendar.');
  }

  const nomeMedico = (id: string) => MEDICOS.find((m) => m.id === id)?.nome ?? id;
  const nomeExame = (id: string) => EXAMES.find((e) => e.id === id)?.nome ?? id;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-navy-900">Novo agendamento</h1>
      <Stepper passo={passo} />

      {/* PASSO 1 — paciente */}
      {passo === 1 && (
        <div className="mt-4 card p-5">
          <label className="label">Buscar paciente (nome, CPF ou telefone)</label>
          <input className="input" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite para buscar…" />
          <div className="mt-3 divide-y divide-navy-100/70">
            {resultados.map((p) => (
              <button key={p.id} onClick={() => { setPaciente(p); setConvenioId(p.convenioId ?? 'particular'); setPasso(2); }}
                className="flex w-full items-center justify-between py-3 text-left hover:bg-navy-50/50 rounded-lg px-2">
                <div>
                  <div className="text-sm font-semibold text-ink">{p.nome}</div>
                  <div className="text-xs text-muted">{p.telefone}</div>
                </div>
                <span className="text-sm text-navy-700">Selecionar →</span>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-navy-50 p-3 text-sm text-muted">
            Não encontrou? <a href="/pacientes/novo" className="font-semibold text-navy-700 hover:underline">Cadastrar novo paciente</a>
          </div>
        </div>
      )}

      {/* PASSO 2 — exames */}
      {passo === 2 && paciente && (
        <div className="mt-4 space-y-4">
          <div className="card p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-ink">{paciente.nome}</div>
              <div className="text-xs text-muted">{paciente.telefone}</div>
            </div>
            <button className="btn-ghost" onClick={() => setPasso(1)}>Trocar</button>
          </div>

          <div className="card p-5">
            <label className="label">Adicionar exames (clique para empilhar exames consecutivos)</label>
            <div className="flex flex-wrap gap-2">
              {EXAMES.filter((e) => e.ativo).map((e) => (
                <button key={e.id} onClick={() => addExame(e.id)}
                  className="rounded-xl border border-navy-100 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-50">
                  + {e.nome} <span className="text-muted">({e.duracaoMin}min)</span>
                </button>
              ))}
            </div>

            {exames.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-muted mb-2">Sessão ({exames.length} exame{exames.length > 1 ? 's' : ''} · {exames.reduce((s, id) => s + (EXAMES.find((e) => e.id === id)?.duracaoMin ?? 0), 0)}min)</div>
                <ul className="space-y-1.5">
                  {exames.map((id, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2 text-sm">
                      <span className="font-medium text-ink">{i + 1}. {nomeExame(id)}</span>
                      <button onClick={() => removeExame(i)} className="text-brand-red text-xs hover:underline">remover</button>
                    </li>
                  ))}
                </ul>
                {exames.length > 1 && (
                  <p className="mt-2 text-xs text-navy-600">⚡ O sistema vai priorizar marcar todos com o <strong>mesmo médico</strong>, em sequência.</p>
                )}
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Convênio</label>
                <select className="input" value={convenioId} onChange={(e) => setConvenioId(e.target.value)}>
                  {CONVENIOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Médico de preferência (opcional)</label>
                <select className="input" value={medicoPref} onChange={(e) => setMedicoPref(e.target.value)}>
                  <option value="">Sem preferência (sistema decide)</option>
                  {MEDICOS.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
            </div>

            <button className="btn-red mt-5 w-full" disabled={exames.length === 0} onClick={buscarDisponibilidade}>
              Ver horários disponíveis
            </button>
          </div>
        </div>
      )}

      {/* PASSO 3 — disponibilidade */}
      {passo === 3 && (
        <div className="mt-4 space-y-4">
          <button className="btn-ghost" onClick={() => setPasso(2)}>← Ajustar exames</button>
          {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-brand-red">{erro}</p>}

          {carregando && <div className="card p-8 text-center text-sm text-muted">Calculando horários…</div>}

          {/* sessão (vários exames) */}
          {!carregando && proposta && (
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-navy-900">Proposta de horário</h3>
                {proposta.mesmoMedico
                  ? <span className="badge bg-green-50 text-green-700">Mesmo médico ✓</span>
                  : <span className="badge bg-amber-50 text-amber-700">Médicos diferentes</span>}
              </div>
              <ul className="mt-4 space-y-2">
                {proposta.itens.map((it, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl border border-navy-100 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{it.exameNome}</div>
                      <div className="text-xs text-muted">{nomeMedico(it.medicoId)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-navy-700">{fmtHora(it.inicio)}–{fmtHora(it.fim)}</div>
                      <div className="text-xs text-muted">{fmtData(it.inicio)}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <button className="btn-red mt-5 w-full" disabled={carregando} onClick={confirmarProposta}>Confirmar agendamento</button>
            </div>
          )}
          {!carregando && proposta === null && exames.length > 1 && (
            <div className="card p-8 text-center text-sm text-muted">Não foi possível encontrar horários consecutivos. Tente reduzir os exames ou outra data.</div>
          )}

          {/* exame único — lista de slots */}
          {!carregando && exames.length === 1 && (
            slots.length === 0
              ? <div className="card p-8 text-center text-sm text-muted">Sem horários disponíveis nos próximos dias.</div>
              : <SlotsPorDia slots={slots} onPick={confirmarSlot} nomeMedico={nomeMedico} />
          )}
        </div>
      )}
    </div>
  );
}

function SlotsPorDia({ slots, onPick, nomeMedico }: {
  slots: SlotDisponivel[]; onPick: (s: SlotDisponivel) => void; nomeMedico: (id: string) => string;
}) {
  const porDia = slots.reduce<Record<string, SlotDisponivel[]>>((acc, s) => {
    const d = s.inicio.slice(0, 10);
    (acc[d] ??= []).push(s);
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      {Object.entries(porDia).map(([dia, ss]) => (
        <div key={dia} className="card p-5">
          <div className="text-sm font-bold text-navy-900">{fmtData(dia + 'T00:00')}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ss.map((s, i) => (
              <button key={i} onClick={() => onPick(s)}
                className="rounded-xl border border-navy-100 px-3 py-2 text-left hover:border-brand-red hover:bg-brand-red/5">
                <div className="text-sm font-bold text-navy-700">{fmtHora(s.inicio)}</div>
                <div className="text-[11px] text-muted">{nomeMedico(s.medicoId)}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stepper({ passo }: { passo: number }) {
  const labels = ['Paciente', 'Exames', 'Horário'];
  return (
    <div className="mt-4 flex items-center gap-2">
      {labels.map((l, i) => {
        const n = i + 1;
        const ativo = passo >= n;
        return (
          <div key={l} className="flex items-center gap-2">
            <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${ativo ? 'bg-navy-700 text-white' : 'bg-navy-100 text-muted'}`}>{n}</span>
            <span className={`text-xs font-semibold ${ativo ? 'text-navy-900' : 'text-muted'}`}>{l}</span>
            {n < 3 && <span className="mx-1 h-px w-6 bg-navy-100" />}
          </div>
        );
      })}
    </div>
  );
}
