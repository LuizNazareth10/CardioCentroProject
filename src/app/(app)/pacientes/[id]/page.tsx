'use client';

import { useEffect, useState } from 'react';
import type { Agendamento, Paciente, Triagem } from '@/lib/types';
import { CONVENIOS, EXAMES, MEDICOS } from '@/lib/seed-data';
import { STATUS_AGENDAMENTO_BADGE, STATUS_AGENDAMENTO_LABEL } from '@/lib/status-agendamento';
import { fmtData, fmtHora, idade, iniciais } from '@/lib/format';
import { FichaIdentidadePrint } from '@/components/FichaIdentidadePrint';
import {
  corpoDoFormulario,
  exameMaisRecente,
  medicoExecutanteDoExame,
  montarFichaIdentidade,
  valoresIniciais,
  type CampoFicha,
  type ChaveEditavel,
  type ExameMaisRecente,
} from '@/lib/ficha-identidade';
import { Printer } from 'lucide-react';
import { DataPagina } from '@/components/DataPagina';

type Aba = 'identidade' | 'historico' | 'triagens';

export default function PacientePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [historico, setHistorico] = useState<Agendamento[]>([]);
  const [triagens, setTriagens] = useState<Triagem[]>([]);
  const [aba, setAba] = useState<Aba>('identidade');
  const [triando, setTriando] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setErro('');
    try {
      const res = await fetch(`/api/pacientes/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.erro || `Falha ao carregar (HTTP ${res.status}).`);
      setPaciente(json.paciente); setHistorico(json.historico ?? []); setTriagens(json.triagens ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o paciente.');
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (erro && !paciente) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm font-medium text-brand-red">{erro}</p>
        <button className="btn-outline mt-4" onClick={() => { setCarregando(true); carregar(); }}>Tentar novamente</button>
      </div>
    );
  }
  if (carregando || !paciente) return <div className="card p-8 text-center text-sm text-muted">Carregando…</div>;

  const conv = CONVENIOS.find((c) => c.id === paciente.convenioId)?.nome ?? 'Particular';
  const nomeExame = (i: string) => EXAMES.find((e) => e.id === i)?.nome ?? i;
  const nomeMedico = (i: string) => MEDICOS.find((m) => m.id === i)?.nome ?? i;

  const exameRecente = exameMaisRecente(historico, nomeExame);
  const medicoExec = medicoExecutanteDoExame(historico, nomeMedico);

  return (
    <div>
      <DataPagina />
      <FichaIdentidadePrint
        paciente={paciente}
        convenio={conv}
        medicoExecutante={medicoExec}
        exameRecente={exameRecente}
      />

      {/* cabeçalho do paciente */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-navy-700 text-lg font-bold text-white">{iniciais(paciente.nome)}</div>
          <div className="flex-1">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-navy-900">{paciente.nome}</h1>
            <div className="text-sm text-muted">
              {paciente.telefone} · {idade(paciente.dataNascimento)} ·{' '}
              {paciente.sexo === 'F' ? 'Feminino' : paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'O' ? 'Outro' : '—'}
            </div>
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
        {(['identidade', 'historico', 'triagens'] as Aba[]).map((a) => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize transition ${aba === a ? 'border-b-2 border-brand-red text-navy-900' : 'text-muted hover:text-navy-700'}`}>
            {a === 'identidade' ? 'Ficha de identidade' : a === 'historico' ? `Histórico (${historico.length})` : `Triagens (${triagens.length})`}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {aba === 'identidade' && (
          <IdentidadeView
            paciente={paciente}
            convenio={conv}
            medicoExecutante={medicoExec}
            exameRecente={exameRecente}
            onAtualizado={carregar}
          />
        )}
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
                  <span className={`badge ${STATUS_AGENDAMENTO_BADGE[h.status]}`}>{STATUS_AGENDAMENTO_LABEL[h.status]}</span>
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

/**
 * Ficha de identidade: leitura, edição e impressão mostram EXATAMENTE os
 * mesmos campos, na mesma ordem — todos vêm de `montarFichaIdentidade`
 * (lib/ficha-identidade.ts). Campos derivados do histórico (idade, data de
 * cadastro, médico executante, exame em destaque, registro) não têm editor e
 * seguem em leitura mesmo com a ficha aberta para edição.
 */
function IdentidadeView({ paciente, convenio, medicoExecutante, exameRecente, onAtualizado }: {
  paciente: Paciente;
  convenio: string;
  medicoExecutante: string;
  exameRecente: ExameMaisRecente | null;
  onAtualizado: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(() => valoresIniciais(paciente));

  useEffect(() => { setDados(valoresIniciais(paciente)); }, [paciente]);

  const secoes = montarFichaIdentidade(paciente, { convenio, medicoExecutante, exameRecente });
  const set = (chave: ChaveEditavel, v: string) => setDados((d) => ({ ...d, [chave]: v }));

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      const res = await fetch(`/api/pacientes/${paciente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoDoFormulario(dados)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof json.erro === 'string' ? json.erro : 'Erro ao salvar a ficha.');
        return;
      }
      setEditando(false);
      onAtualizado();
    } catch {
      setErro('Falha ao conectar com o servidor.');
    } finally {
      setSalvando(false);
    }
  }

  function cancelar() {
    setDados(valoresIniciais(paciente));
    setEditando(false);
    setErro('');
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Dados cadastrais para identificação do paciente. Informações clínicas ficam nas triagens.
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-outline inline-flex items-center gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden />
            Imprimir ficha
          </button>
          {!editando ? (
            <button type="button" className="btn-primary" onClick={() => setEditando(true)}>Editar dados</button>
          ) : (
            <>
              <button type="button" className="btn-ghost" onClick={cancelar}>Cancelar</button>
              <button type="button" className="btn-red" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </>
          )}
        </div>
      </div>
      {erro && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-brand-red">{erro}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {secoes.map((secao) => (
          <div key={secao.titulo} className="card p-5 space-y-4">
            <h3 className="font-bold text-navy-900">{secao.titulo}</h3>
            {secao.campos.map((campo) =>
              editando && campo.editor ? (
                <CampoEdicao key={campo.chave} campo={campo} valor={dados[campo.chave as ChaveEditavel] ?? ''} onChange={set} />
              ) : (
                <Bloco key={campo.chave} titulo={campo.label} texto={campo.valor} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** input da ficha, escolhido pelo `editor` do campo (uma só definição p/ todas as telas) */
function CampoEdicao({ campo, valor, onChange }: {
  campo: CampoFicha;
  valor: string;
  onChange: (chave: ChaveEditavel, v: string) => void;
}) {
  const chave = campo.chave as ChaveEditavel;
  const label = campo.label + (campo.obrigatorio ? ' *' : '');
  const comum = {
    className: 'input',
    value: valor,
    placeholder: campo.placeholder,
    required: campo.obrigatorio,
  };
  return (
    <div>
      <label className="label">{label}</label>
      {campo.editor === 'textarea' ? (
        <textarea {...comum} className="input min-h-[100px] resize-y" onChange={(e) => onChange(chave, e.target.value)} />
      ) : campo.editor === 'sexo' ? (
        <select className="input" value={valor} onChange={(e) => onChange(chave, e.target.value)}>
          <option value="">Não informado</option>
          <option value="F">Feminino</option>
          <option value="M">Masculino</option>
          <option value="O">Outro</option>
        </select>
      ) : campo.editor === 'convenio' ? (
        <select className="input" value={valor} onChange={(e) => onChange(chave, e.target.value)}>
          {CONVENIOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      ) : (
        <input
          {...comum}
          type={campo.editor === 'data' ? 'date' : campo.editor === 'numero' ? 'number' : campo.editor === 'email' ? 'email' : campo.editor === 'telefone' ? 'tel' : 'text'}
          step={campo.chave === 'pesoKg' ? '0.1' : undefined}
          onChange={(e) => onChange(chave, e.target.value)}
        />
      )}
    </div>
  );
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
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</div>
      {/* pre-wrap para a observação manter as quebras de linha digitadas */}
      <div className="whitespace-pre-wrap text-sm text-ink/85">{texto?.trim() || '—'}</div>
    </div>
  );
}
