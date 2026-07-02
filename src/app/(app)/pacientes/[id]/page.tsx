'use client';

import { useEffect, useState } from 'react';
import type { Agendamento, FichaMedica, Paciente, Triagem } from '@/lib/types';
import { CONVENIOS, EXAMES, MEDICOS } from '@/lib/seed-data';
import { fmtData, fmtHora, idade, iniciais } from '@/lib/format';

type Aba = 'ficha' | 'historico' | 'triagens';

export default function PacientePage({ params }: { params: { id: string } }) {
  const { id } = params;
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
            <h1 className="font-serif text-2xl font-bold tracking-tight text-navy-900">{paciente.nome}</h1>
            <div className="text-sm text-muted">{paciente.telefone} · {idade(paciente.dataNascimento)} · {paciente.sexo === 'F' ? 'Feminino' : paciente.sexo === 'M' ? 'Masculino' : '—'}</div>
          </div>
          <div className="text-right">
            <span className="badge bg-navy-50 text-navy-700">{conv}</span>
            {paciente.carteirinha && <div className="mt-1 text-xs text-muted">Carteirinha: {paciente.carteirinha}</div>}
          </div>
          <button className="btn-red" onClick={() => setTriando(true)}>+ Nova triagem</button>
        </div>
      </div>

      {/* alerta de fatores críticos + alergias (destaque de segurança) */}
      <AlertasCriticos paciente={paciente} />

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
        {aba === 'ficha' && <FichaView paciente={paciente} onAtualizado={carregar} />}
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
              triagens.map((t, i) => <TriagemCard key={t.id} t={t} anterior={triagens[i + 1]} nomeExame={nomeExame} />)}
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

function FichaView({ paciente, onAtualizado }: { paciente: Paciente; onAtualizado: () => void }) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [fm, setFm] = useState<FichaMedica>(paciente.fichaMedica);

  useEffect(() => { setFm(paciente.fichaMedica); }, [paciente]);

  const fatoresKeys: Array<[keyof FichaMedica, string]> = [
    ['hipertensao', 'Hipertensão'], ['diabetes', 'Diabetes'], ['dislipidemia', 'Dislipidemia'],
    ['tabagismo', 'Tabagismo'], ['etilismo', 'Etilismo'], ['sedentarismo', 'Sedentarismo'],
    ['iamPrevio', 'IAM prévio'], ['avcPrevio', 'AVC prévio'], ['doencaRenal', 'Doença renal'],
    ['marcapasso', 'Marca-passo'], ['histFamiliarDac', 'Hist. fam. DAC'], ['histFamiliarMorteSubita', 'Hist. fam. morte súbita'],
  ];
  const fatores = fatoresKeys.filter(([k]) => fm[k]).map(([, l]) => l);

  const imcInfo = classificarIMC(fm.pesoKg, fm.alturaCm);

  async function salvar() {
    setSalvando(true);
    setErro('');
    const res = await fetch(`/api/pacientes/${paciente.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fichaMedica: fm }),
    });
    setSalvando(false);
    if (!res.ok) {
      const j = await res.json();
      setErro(j.erro ?? 'Erro ao salvar ficha.');
      return;
    }
    setEditando(false);
    onAtualizado();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {fichaVazia(fm)
            ? 'Ficha ainda não preenchida — o médico pode completar na primeira consulta.'
            : 'Ficha médica do paciente.'}
        </p>
        {!editando ? (
          <button type="button" className="btn-primary" onClick={() => setEditando(true)}>Editar ficha</button>
        ) : (
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => { setEditando(false); setFm(paciente.fichaMedica); }}>Cancelar</button>
            <button type="button" className="btn-red" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar ficha'}</button>
          </div>
        )}
      </div>
      {erro && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-brand-red">{erro}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-bold text-navy-900">Antropometria</h3>
          {editando ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="label">Peso (kg)</label>
                <input className="input" type="number" value={fm.pesoKg ?? ''} onChange={(e) => setFm({ ...fm, pesoKg: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <label className="label">Altura (cm)</label>
                <input className="input" type="number" value={fm.alturaCm ?? ''} onChange={(e) => setFm({ ...fm, alturaCm: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <Metric label="Peso" valor={fm.pesoKg ? `${fm.pesoKg} kg` : '—'} />
              <Metric label="Altura" valor={fm.alturaCm ? `${fm.alturaCm} cm` : '—'} />
              <Metric label="IMC" valor={imcInfo ? imcInfo.valor : '—'} />
            </div>
          )}
          {imcInfo && !editando && (
            <div className="mt-2 flex justify-center">
              <span className={`badge ${imcInfo.cls}`}>{imcInfo.label}</span>
            </div>
          )}
          <h3 className="mt-5 font-bold text-navy-900">Fatores de risco</h3>
          {editando ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {fatoresKeys.map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!fm[k]} onChange={(e) => setFm({ ...fm, [k]: e.target.checked })} />
                  {l}
                </label>
              ))}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fatores.length === 0 ? <span className="text-sm text-muted">Nenhum registrado.</span> :
                fatores.map((l) => <span key={l} className={`badge ${FATORES_CRITICOS.includes(l) ? 'bg-brand-red text-white' : 'bg-brand-red/10 text-brand-red-600'}`}>{l}</span>)}
            </div>
          )}
        </div>
        <div className="card p-5 space-y-3">
          {editando ? (
            <>
              <CampoFicha label="Queixa principal" value={fm.queixaPrincipal ?? ''} onChange={(v) => setFm({ ...fm, queixaPrincipal: v })} />
              <CampoFicha label="Medicações em uso" value={fm.medicacoesEmUso ?? ''} onChange={(v) => setFm({ ...fm, medicacoesEmUso: v })} />
              <CampoFicha label="Alergias" value={fm.alergias ?? ''} onChange={(v) => setFm({ ...fm, alergias: v })} />
              <CampoFicha label="Cirurgias prévias" value={fm.cirurgiasPrevias ?? ''} onChange={(v) => setFm({ ...fm, cirurgiasPrevias: v })} />
              <CampoFicha label="Observações" value={fm.observacoesGerais ?? ''} onChange={(v) => setFm({ ...fm, observacoesGerais: v })} />
            </>
          ) : (
            <>
              <Bloco titulo="Queixa principal" texto={fm.queixaPrincipal} />
              <Bloco titulo="Medicações em uso" texto={fm.medicacoesEmUso} />
              <Bloco titulo="Alergias" texto={fm.alergias} />
              <Bloco titulo="Cirurgias prévias" texto={fm.cirurgiasPrevias} />
              <Bloco titulo="Observações" texto={fm.observacoesGerais} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CampoFicha({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea className="input min-h-[72px] resize-none text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function fichaVazia(fm: FichaMedica): boolean {
  const temBool = ['hipertensao', 'diabetes', 'dislipidemia', 'tabagismo', 'etilismo', 'sedentarismo',
    'iamPrevio', 'avcPrevio', 'doencaRenal', 'marcapasso', 'histFamiliarDac', 'histFamiliarMorteSubita']
    .some((k) => fm[k as keyof FichaMedica]);
  const temTexto = fm.queixaPrincipal || fm.medicacoesEmUso || fm.alergias || fm.cirurgiasPrevias || fm.observacoesGerais;
  return !fm.pesoKg && !fm.alturaCm && !temBool && !temTexto;
}

function TriagemCard({ t, anterior, nomeExame }: { t: Triagem; anterior?: Triagem; nomeExame: (i: string) => string }) {
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
        <Metric label="PA" valor={t.paSistolica ? `${t.paSistolica}/${t.paDiastolica}` : '—'} trend={tendencia(t.paSistolica, anterior?.paSistolica)} />
        <Metric label="FC" valor={t.frequenciaCardiaca ? `${t.frequenciaCardiaca} bpm` : '—'} trend={tendencia(t.frequenciaCardiaca, anterior?.frequenciaCardiaca)} />
        <Metric label="SatO₂" valor={t.saturacao ? `${t.saturacao}%` : '—'} />
        <Metric label="Peso" valor={t.pesoKg ? `${t.pesoKg} kg` : '—'} trend={tendencia(t.pesoKg, anterior?.pesoKg)} />
      </div>
      {sintomas.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{sintomas.map((s) => <span key={s} className="badge bg-amber-50 text-amber-700">{s}</span>)}</div>}
      {t.observacoes && <p className="mt-3 text-sm text-ink/80">{t.observacoes}</p>}
    </div>
  );
}

/** compara com a triagem anterior e devolve ↑/↓/→ com cor */
function tendencia(atual?: number, anterior?: number): { seta: string; cls: string } | undefined {
  if (typeof atual !== 'number' || typeof anterior !== 'number' || atual === anterior) {
    return typeof atual === 'number' && typeof anterior === 'number' ? { seta: '→', cls: 'text-muted' } : undefined;
  }
  return atual > anterior ? { seta: '↑', cls: 'text-brand-red' } : { seta: '↓', cls: 'text-success' };
}

function ModalTriagem({ pacienteId, historico, onClose, onSalvo }: {
  pacienteId: string; historico: Agendamento[]; onClose: () => void; onSalvo: () => void;
}) {
  const [d, setD] = useState<Record<string, string>>({});
  const [sint, setSint] = useState<Record<string, boolean>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
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
    setErro('');
    const res = await fetch(`/api/pacientes/${pacienteId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSalvando(false);
    if (!res.ok) { setErro((await res.json()).erro ?? 'Falha ao salvar a triagem.'); return; }
    onSalvo();
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

        {erro && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-brand-red">{erro}</p>}
        <div className="mt-5 flex gap-2">
          <button className="btn-red" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar triagem'}</button>
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, valor, trend }: { label: string; valor: string; trend?: { seta: string; cls: string } }) {
  return (
    <div className="rounded-xl bg-navy-50 px-2 py-2.5">
      <div className="flex items-center justify-center gap-1 text-sm font-bold text-navy-900">
        {valor}
        {trend && <span className={`text-xs ${trend.cls}`}>{trend.seta}</span>}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
function Bloco({ titulo, texto }: { titulo: string; texto?: string }) {
  return <div><div className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</div><div className="text-sm text-ink/85">{texto || '—'}</div></div>;
}
function statusCor(s: string) {
  return { agendado: 'bg-navy-50 text-navy-700', confirmado: 'bg-blue-50 text-blue-700', realizado: 'bg-green-50 text-green-700', cancelado: 'bg-gray-100 text-gray-500', faltou: 'bg-red-50 text-brand-red' }[s] ?? 'bg-navy-50 text-navy-700';
}

// fatores de risco que ganham destaque máximo no prontuário
const FATORES_CRITICOS = ['IAM prévio', 'AVC prévio', 'Marca-passo', 'Doença renal'];

/** classificação de IMC (OMS) com cor */
function classificarIMC(pesoKg?: number, alturaCm?: number): { valor: string; label: string; cls: string } | null {
  if (!pesoKg || !alturaCm) return null;
  const imc = pesoKg / Math.pow(alturaCm / 100, 2);
  const valor = imc.toFixed(1);
  if (imc < 18.5) return { valor, label: 'Baixo peso', cls: 'bg-amber-50 text-amber-700' };
  if (imc < 25) return { valor, label: 'Peso normal', cls: 'bg-green-50 text-green-700' };
  if (imc < 30) return { valor, label: 'Sobrepeso', cls: 'bg-amber-50 text-amber-700' };
  if (imc < 35) return { valor, label: 'Obesidade grau I', cls: 'bg-brand-red/10 text-brand-red-600' };
  if (imc < 40) return { valor, label: 'Obesidade grau II', cls: 'bg-brand-red/10 text-brand-red-600' };
  return { valor, label: 'Obesidade grau III', cls: 'bg-brand-red text-white' };
}

/** banner de alerta com fatores críticos + alergias (segurança do paciente) */
function AlertasCriticos({ paciente }: { paciente: Paciente }) {
  const fm = paciente.fichaMedica;
  const criticos: string[] = [];
  if (fm.iamPrevio) criticos.push('IAM prévio');
  if (fm.avcPrevio) criticos.push('AVC prévio');
  if (fm.marcapasso) criticos.push('Marca-passo');
  if (fm.doencaRenal) criticos.push('Doença renal');
  const temAlergia = fm.alergias && fm.alergias.trim() && !/^(não|nao|nega|nenhuma)/i.test(fm.alergias.trim());
  if (criticos.length === 0 && !temAlergia) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-red/30 bg-brand-red/5 px-4 py-3">
      <span className="text-sm font-bold text-brand-red-600">⚠ Atenção clínica:</span>
      {criticos.map((c) => <span key={c} className="badge bg-brand-red text-white">{c}</span>)}
      {temAlergia && <span className="badge bg-warning/20 text-amber-700">Alergia: {fm.alergias}</span>}
    </div>
  );
}
