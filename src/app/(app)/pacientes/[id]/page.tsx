'use client';

import { use, useEffect, useState } from 'react';
import type { Agendamento, Paciente, Triagem } from '@/lib/types';
import { CONVENIOS, EXAMES, MEDICOS } from '@/lib/seed-data';
import { fmtData, fmtHora, idade, iniciais } from '@/lib/format';

type Aba = 'ficha' | 'historico' | 'triagens';

export default function PacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [historico, setHistorico] = useState<Agendamento[]>([]);
  const [triagens, setTriagens] = useState<Triagem[]>([]);
  const [aba, setAba] = useState<Aba>('ficha');
  const [triando, setTriando] = useState(false);

  async function carregar() {
    const res = await fetch(`/api/pacientes/${id}`);
    const json = await res.json();
    setPaciente(json.paciente); setHistorico(json.historico ?? []); setTriagens(json.triagens ?? []);
  }
  useEffect(() => { carregar(); }, [id]);

  if (!paciente) return <div className="card p-8 text-center text-sm text-muted">Carregando…</div>;

  const conv = CONVENIOS.find((c) => c.id === paciente.convenioId)?.nome ?? 'Particular';
  const nomeExame = (i: string) => EXAMES.find((e) => e.id === i)?.nome ?? i;
  const nomeMedico = (i: string) => MEDICOS.find((m) => m.id === i)?.nome ?? i;

  return (
    <div>
      {/* cabeçalho do paciente */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-navy-700 text-lg font-bold text-white">{iniciais(paciente.nome)}</div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-navy-900">{paciente.nome}</h1>
            <div className="text-sm text-muted">{paciente.telefone} · {idade(paciente.dataNascimento)} · {paciente.sexo === 'F' ? 'Feminino' : paciente.sexo === 'M' ? 'Masculino' : '—'}</div>
          </div>
          <div className="text-right">
            <span className="badge bg-navy-50 text-navy-700">{conv}</span>
            {paciente.carteirinha && <div className="mt-1 text-xs text-muted">Carteirinha: {paciente.carteirinha}</div>}
          </div>
          <button className="btn-red" onClick={() => setTriando(true)}>+ Nova triagem</button>
        </div>
      </div>

      {/* abas */}
      <div className="mt-4 flex gap-1 border-b border-navy-100">
        {(['ficha', 'historico', 'triagens'] as Aba[]).map((a) => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize transition ${aba === a ? 'border-b-2 border-brand-red text-navy-900' : 'text-muted hover:text-navy-700'}`}>
            {a === 'ficha' ? 'Ficha médica' : a === 'historico' ? `Histórico (${historico.length})` : `Triagens (${triagens.length})`}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {aba === 'ficha' && <FichaView paciente={paciente} />}
        {aba === 'historico' && (
          <div className="card divide-y divide-navy-100/70">
            {historico.length === 0 ? <div className="p-8 text-center text-sm text-muted">Nenhuma visita registrada.</div> :
              [...historico].reverse().map((h) => (
                <div key={h.id} className="flex items-center gap-4 p-4">
                  <div className="text-center">
                    <div className="text-sm font-bold text-navy-700">{fmtHora(h.inicio)}</div>
                    <div className="text-[11px] text-muted">{fmtData(h.inicio)}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-ink">{nomeExame(h.exameId)}</div>
                    <div className="text-xs text-muted">{nomeMedico(h.medicoId)}</div>
                  </div>
                  <span className={`badge ${statusCor(h.status)}`}>{h.status}</span>
                </div>
              ))}
          </div>
        )}
        {aba === 'triagens' && (
          <div className="space-y-3">
            {triagens.length === 0 ? <div className="card p-8 text-center text-sm text-muted">Nenhuma triagem registrada.</div> :
              triagens.map((t) => <TriagemCard key={t.id} t={t} nomeExame={nomeExame} />)}
          </div>
        )}
      </div>

      {triando && (
        <ModalTriagem pacienteId={id} historico={historico}
          onClose={() => setTriando(false)}
          onSalvo={() => { setTriando(false); carregar(); setAba('triagens'); }} />
      )}
    </div>
  );
}

function FichaView({ paciente }: { paciente: Paciente }) {
  const fm = paciente.fichaMedica;
  const fatores = [
    ['Hipertensão', fm.hipertensao], ['Diabetes', fm.diabetes], ['Dislipidemia', fm.dislipidemia],
    ['Tabagismo', fm.tabagismo], ['Etilismo', fm.etilismo], ['Sedentarismo', fm.sedentarismo],
    ['IAM prévio', fm.iamPrevio], ['AVC prévio', fm.avcPrevio], ['Doença renal', fm.doencaRenal],
    ['Marca-passo', fm.marcapasso], ['Hist. fam. DAC', fm.histFamiliarDac], ['Hist. fam. morte súbita', fm.histFamiliarMorteSubita],
  ].filter(([, v]) => v) as [string, boolean][];

  const imc = fm.pesoKg && fm.alturaCm ? (fm.pesoKg / Math.pow(fm.alturaCm / 100, 2)).toFixed(1) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-5">
        <h3 className="font-bold text-navy-900">Antropometria</h3>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <Metric label="Peso" valor={fm.pesoKg ? `${fm.pesoKg} kg` : '—'} />
          <Metric label="Altura" valor={fm.alturaCm ? `${fm.alturaCm} cm` : '—'} />
          <Metric label="IMC" valor={imc ?? '—'} />
        </div>
        <h3 className="mt-5 font-bold text-navy-900">Fatores de risco</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {fatores.length === 0 ? <span className="text-sm text-muted">Nenhum registrado.</span> :
            fatores.map(([l]) => <span key={l} className="badge bg-brand-red/10 text-brand-red-600">{l}</span>)}
        </div>
      </div>
      <div className="card p-5 space-y-3">
        <Bloco titulo="Queixa principal" texto={fm.queixaPrincipal} />
        <Bloco titulo="Medicações em uso" texto={fm.medicacoesEmUso} />
        <Bloco titulo="Alergias" texto={fm.alergias} />
        <Bloco titulo="Cirurgias prévias" texto={fm.cirurgiasPrevias} />
        <Bloco titulo="Observações" texto={fm.observacoesGerais} />
      </div>
    </div>
  );
}

function TriagemCard({ t, nomeExame }: { t: Triagem; nomeExame: (i: string) => string }) {
  const risco = { verde: 'bg-green-50 text-green-700', amarelo: 'bg-amber-50 text-amber-700', vermelho: 'bg-red-50 text-brand-red' };
  const sintomas = [
    ['Dor torácica', t.dorToracica], ['Dispneia', t.dispneia], ['Palpitação', t.palpitacao],
    ['Síncope', t.sincope], ['Edema', t.edema],
  ].filter(([, v]) => v).map(([l]) => l as string);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-navy-900">{nomeExame(t.exameId)}</div>
          <div className="text-xs text-muted">{fmtData(t.data)} · {fmtHora(t.data)} · {t.responsavel}</div>
        </div>
        {t.classificacaoRisco && <span className={`badge ${risco[t.classificacaoRisco]}`}>Risco {t.classificacaoRisco}</span>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="PA" valor={t.paSistolica ? `${t.paSistolica}/${t.paDiastolica}` : '—'} />
        <Metric label="FC" valor={t.frequenciaCardiaca ? `${t.frequenciaCardiaca} bpm` : '—'} />
        <Metric label="SatO₂" valor={t.saturacao ? `${t.saturacao}%` : '—'} />
        <Metric label="Peso" valor={t.pesoKg ? `${t.pesoKg} kg` : '—'} />
      </div>
      {sintomas.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{sintomas.map((s) => <span key={s} className="badge bg-amber-50 text-amber-700">{s}</span>)}</div>}
      {t.observacoes && <p className="mt-3 text-sm text-ink/80">{t.observacoes}</p>}
    </div>
  );
}

function ModalTriagem({ pacienteId, historico, onClose, onSalvo }: {
  pacienteId: string; historico: Agendamento[]; onClose: () => void; onSalvo: () => void;
}) {
  const [d, setD] = useState<Record<string, string>>({});
  const [sint, setSint] = useState<Record<string, boolean>>({});
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setD((x) => ({ ...x, [k]: v }));

  const exameOptions = historico.length > 0
    ? historico.map((h) => ({ id: h.exameId, ag: h.id, label: EXAMES.find((e) => e.id === h.exameId)?.nome ?? h.exameId, when: fmtData(h.inicio) }))
    : EXAMES.filter((e) => e.ativo).map((e) => ({ id: e.id, ag: '', label: e.nome, when: '' }));

  async function salvar() {
    setSalvando(true);
    const sel = exameOptions.find((o) => `${o.id}|${o.ag}` === d.exameSel) ?? exameOptions[0];
    const body: Record<string, unknown> = {
      exameId: sel?.id, agendamentoId: sel?.ag || '',
      dorToracica: !!sint.dorToracica, dispneia: !!sint.dispneia, palpitacao: !!sint.palpitacao,
      sincope: !!sint.sincope, edema: !!sint.edema,
      classificacaoRisco: d.risco || undefined, jejum: d.jejum === 'sim',
      medicacaoTomadaHoje: d.medicacaoTomadaHoje, observacoes: d.observacoes,
    };
    ['paSistolica', 'paDiastolica', 'frequenciaCardiaca', 'saturacao', 'pesoKg'].forEach((k) => { if (d[k]) body[k] = Number(d[k]); });
    await fetch(`/api/pacientes/${pacienteId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSalvando(false); onSalvo();
  }

  const SINTOMAS = [['dorToracica', 'Dor torácica'], ['dispneia', 'Dispneia'], ['palpitacao', 'Palpitação'], ['sincope', 'Síncope'], ['edema', 'Edema']];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-navy-900">Nova triagem</h2>
        <p className="text-sm text-muted">Aferição feita no momento do exame.</p>

        <div className="mt-4 space-y-4">
          <div><label className="label">Exame</label>
            <select className="input" value={d.exameSel ?? ''} onChange={(e) => set('exameSel', e.target.value)}>
              {exameOptions.map((o, i) => <option key={i} value={`${o.id}|${o.ag}`}>{o.label}{o.when ? ` — ${o.when}` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><label className="label">PA sist.</label><input className="input" inputMode="numeric" value={d.paSistolica ?? ''} onChange={(e) => set('paSistolica', e.target.value)} placeholder="120" /></div>
            <div><label className="label">PA diast.</label><input className="input" inputMode="numeric" value={d.paDiastolica ?? ''} onChange={(e) => set('paDiastolica', e.target.value)} placeholder="80" /></div>
            <div><label className="label">FC (bpm)</label><input className="input" inputMode="numeric" value={d.frequenciaCardiaca ?? ''} onChange={(e) => set('frequenciaCardiaca', e.target.value)} /></div>
            <div><label className="label">SatO₂ (%)</label><input className="input" inputMode="numeric" value={d.saturacao ?? ''} onChange={(e) => set('saturacao', e.target.value)} /></div>
          </div>
          <div>
            <label className="label">Sintomas atuais</label>
            <div className="flex flex-wrap gap-2">
              {SINTOMAS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => setSint((x) => ({ ...x, [k]: !x[k] }))}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium ${sint[k] ? 'border-brand-red bg-brand-red/5 text-navy-900' : 'border-navy-100 text-ink/70'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Jejum</label>
              <select className="input" value={d.jejum ?? ''} onChange={(e) => set('jejum', e.target.value)}>
                <option value="">N/A</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </div>
            <div><label className="label">Classificação de risco</label>
              <select className="input" value={d.risco ?? ''} onChange={(e) => set('risco', e.target.value)}>
                <option value="">—</option><option value="verde">Verde</option><option value="amarelo">Amarelo</option><option value="vermelho">Vermelho</option>
              </select>
            </div>
          </div>
          <div><label className="label">Medicação tomada hoje</label><input className="input" value={d.medicacaoTomadaHoje ?? ''} onChange={(e) => set('medicacaoTomadaHoje', e.target.value)} /></div>
          <div><label className="label">Observações</label><textarea className="input min-h-[60px]" value={d.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></div>
        </div>

        <div className="mt-5 flex gap-2">
          <button className="btn-red" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar triagem'}</button>
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, valor }: { label: string; valor: string }) {
  return <div className="rounded-xl bg-navy-50 px-2 py-2.5"><div className="text-sm font-bold text-navy-900">{valor}</div><div className="text-[10px] uppercase tracking-wide text-muted">{label}</div></div>;
}
function Bloco({ titulo, texto }: { titulo: string; texto?: string }) {
  return <div><div className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</div><div className="text-sm text-ink/85">{texto || '—'}</div></div>;
}
function statusCor(s: string) {
  return { agendado: 'bg-navy-50 text-navy-700', confirmado: 'bg-blue-50 text-blue-700', realizado: 'bg-green-50 text-green-700', cancelado: 'bg-gray-100 text-gray-500', faltou: 'bg-red-50 text-brand-red' }[s] ?? 'bg-navy-50 text-navy-700';
}
