'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { APARELHOS, CONVENIOS, EXAMES, MEDICOS } from '@/lib/seed-data';
import type { Paciente, SlotDisponivel, TipoAparelho } from '@/lib/types';
import type { ItemProposta, Proposta } from '@/lib/scheduling/engine';
import { fmtData, fmtHora } from '@/lib/format';
import { hhmmToMin, toISO } from '@/lib/scheduling/time';

type Passo = 1 | 2 | 3;

function hojeJF(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const examesMedico = EXAMES.filter((e) => e.ativo && !e.aparelho);
const examesAparelho = EXAMES.filter((e) => e.ativo && e.aparelho);

export default function AgendarPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center text-sm text-muted">Carregando…</div>}>
      <AgendarConteudo />
    </Suspense>
  );
}

function AgendarConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const medicoForcadoId = searchParams.get('medico') || '';
  const aparelhoForcado = (searchParams.get('aparelho') || '') as TipoAparelho | '';
  const dataForcada = searchParams.get('data') || '';
  const horaForcada = searchParams.get('hora') || '';
  const slotForcado = !!((medicoForcadoId || aparelhoForcado) && dataForcada && horaForcada);
  const medicoForcado = MEDICOS.find((m) => m.id === medicoForcadoId);
  const aparelhoCfg = aparelhoForcado ? APARELHOS[aparelhoForcado] : null;
  const prestadorForcado = medicoForcado?.nome ?? aparelhoCfg?.nome ?? '';

  const [passo, setPasso] = useState<Passo>(1);
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Paciente[]>([]);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [exames, setExames] = useState<string[]>(aparelhoCfg ? [aparelhoCfg.exameId] : []);
  const [convenioId, setConvenioId] = useState('particular');
  const [medicoPref, setMedicoPref] = useState(medicoForcadoId);
  const [dataBusca, setDataBusca] = useState(hojeJF());
  const [slots, setSlots] = useState<SlotDisponivel[]>([]);
  const [proposta, setProposta] = useState<Proposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [avisoExame, setAvisoExame] = useState('');
  const [pendente, setPendente] = useState<Array<{ exameId: string; medicoId: string; inicio: string; fim: string }> | null>(null);
  const [modoPaciente, setModoPaciente] = useState<'buscar' | 'cadastrar'>('buscar');
  const [novoPaciente, setNovoPaciente] = useState({
    nome: '', telefone: '', dataNascimento: '', convenioId: 'particular', cpf: '', sexo: '',
  });
  const [erroCadastro, setErroCadastro] = useState('');

  const modoAparelho = !!aparelhoCfg || exames.some((id) => EXAMES.find((e) => e.id === id)?.aparelho);

  useEffect(() => {
    if (busca.trim().length < 2) { setResultados([]); return; }
    const id = setTimeout(async () => {
      const res = await fetch(`/api/pacientes?q=${encodeURIComponent(busca)}`);
      setResultados((await res.json()).pacientes ?? []);
    }, 250);
    return () => clearTimeout(id);
  }, [busca]);

  async function cadastrarPacienteRapido() {
    setErroCadastro('');
    setCarregando(true);
    try {
      const res = await fetch('/api/pacientes?rapido=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoPaciente.nome,
          telefone: novoPaciente.telefone,
          dataNascimento: novoPaciente.dataNascimento,
          convenioId: novoPaciente.convenioId,
          cpf: novoPaciente.cpf || undefined,
          sexo: novoPaciente.sexo || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErroCadastro(json.erro ?? 'Não foi possível cadastrar o paciente.');
        return;
      }
      setPaciente(json.paciente);
      setConvenioId(json.paciente.convenioId ?? 'particular');
      setPasso(2);
    } catch {
      setErroCadastro('Falha ao conectar com o servidor.');
    } finally {
      setCarregando(false);
    }
  }

  function addExame(id: string) {
    setAvisoExame('');
    const exame = EXAMES.find((e) => e.id === id);
    if (!exame) return;

    if (exame.aparelho) {
      if (exames.some((eid) => !EXAMES.find((e) => e.id === eid)?.aparelho)) {
        setAvisoExame('MAPA e Holter não podem ser combinados com exames de médico na mesma marcação. Remova os exames de médico primeiro.');
        return;
      }
      if (exames.length >= 1) {
        setAvisoExame('Marque apenas um exame de aparelho (MAPA ou Holter) por vez.');
        return;
      }
      setExames([id]);
      return;
    }

    if (exames.some((eid) => EXAMES.find((e) => e.id === eid)?.aparelho)) {
      setAvisoExame('Remova o exame de aparelho (MAPA/Holter) antes de adicionar exames com médico.');
      return;
    }
    setExames((e) => [...e, id]);
  }

  function removeExame(idx: number) {
    setAvisoExame('');
    setExames((e) => e.filter((_, i) => i !== idx));
  }

  function duracaoNoSlot(exameId: string): number {
    const exame = EXAMES.find((e) => e.id === exameId)!;
    if (aparelhoCfg) return aparelhoCfg.duracaoMin;
    return medicoForcado?.duracoes?.[exameId] ?? exame.duracaoMin;
  }

  function montarPropostaDoSlot() {
    if (!medicoForcado && !aparelhoCfg) return;
    const prestadorId = medicoForcado?.id ?? aparelhoForcado;
    const prestadorNome = prestadorForcado;
    let cursor = hhmmToMin(horaForcada);
    const itens: ItemProposta[] = exames.map((id) => {
      const exame = EXAMES.find((e) => e.id === id)!;
      const dur = duracaoNoSlot(id);
      const item: ItemProposta = {
        exameId: exame.id,
        exameNome: exame.nome,
        medicoId: prestadorId,
        medicoNome: prestadorNome,
        inicio: toISO(dataForcada, cursor),
        fim: toISO(dataForcada, cursor + dur),
      };
      cursor += dur;
      return item;
    });
    setProposta({ mesmoMedico: true, itens });
    setSlots([]);
    setPasso(3);
  }

  async function buscarDisponibilidade(dataOverride?: string) {
    if (slotForcado) return montarPropostaDoSlot();
    const data = dataOverride ?? dataBusca;
    setDataBusca(data);
    setErro('');
    setCarregando(true);
    setSlots([]);
    setProposta(null);

    const params = new URLSearchParams({ exames: exames.join(','), data, dias: modoAparelho ? '42' : '28' });
    if (medicoPref && !modoAparelho) params.set('medico', medicoPref);

    try {
      const res = await fetch(`/api/disponibilidade?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setErro(json.erro ?? 'Não foi possível buscar horários.');
        return;
      }
      if (exames.length === 1) setSlots(json.slots ?? []);
      else setProposta(json.proposta ?? null);
      setPasso(3);
    } catch {
      setErro('Falha ao conectar com o servidor.');
    } finally {
      setCarregando(false);
    }
  }

  function selecionarSlot(slot: SlotDisponivel) {
    setErro('');
    setPendente([{ exameId: exames[0], medicoId: slot.medicoId, inicio: slot.inicio, fim: slot.fim }]);
  }

  function solicitarConfirmacaoProposta() {
    if (!proposta) return;
    setErro('');
    setPendente(proposta.itens.map((i) => ({ exameId: i.exameId, medicoId: i.medicoId, inicio: i.inicio, fim: i.fim })));
  }

  async function confirmarAgendamento() {
    if (!pendente?.length) return;
    await confirmar(pendente);
  }

  async function confirmar(itens: Array<{ exameId: string; medicoId: string; inicio: string; fim: string }>) {
    if (!paciente) return;
    setErro('');
    setCarregando(true);
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
    if (res.ok) {
      const j = await res.json();
      const primeiro = j.agendamentos?.[0];
      const dataAg = primeiro?.inicio?.slice(0, 10) ?? itens[0].inicio.slice(0, 10);
      const params = new URLSearchParams({ data: dataAg });
      if (primeiro?.id) params.set('novo', primeiro.id);
      setPendente(null);
      router.push(`/agenda?${params}`);
    } else {
      const j = await res.json();
      setErro(j.erro ?? 'Falha ao agendar.');
      if (res.status === 409 && slotForcado) setPasso(2);
    }
  }

  const nomeMedico = (id: string) =>
    MEDICOS.find((m) => m.id === id)?.nome ??
    (id === 'mapa' || id === 'holter' ? APARELHOS[id].nome : id);
  const nomeExame = (id: string) => EXAMES.find((e) => e.id === id)?.nome ?? id;

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Novo agendamento</h1>
      <Stepper passo={passo} />

      {slotForcado && passo !== 3 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-cardio/30 bg-cardio/5 px-4 py-3 text-sm">
          <div className="text-navy-900">
            Horário selecionado: <strong>{fmtData(dataForcada + 'T00:00')} às {horaForcada}</strong> — {prestadorForcado}
          </div>
          <button className="text-xs font-semibold text-brand-red hover:underline" onClick={() => router.push('/agenda')}>
            Trocar horário
          </button>
        </div>
      )}

      {passo === 1 && (
        <div className="mt-4 card p-5">
          <div className="flex gap-2 rounded-xl bg-navy-50 p-1">
            <button
              type="button"
              onClick={() => setModoPaciente('buscar')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${modoPaciente === 'buscar' ? 'bg-white text-navy-900 shadow-sm' : 'text-muted'}`}
            >
              Buscar paciente
            </button>
            <button
              type="button"
              onClick={() => setModoPaciente('cadastrar')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${modoPaciente === 'cadastrar' ? 'bg-white text-navy-900 shadow-sm' : 'text-muted'}`}
            >
              Cadastro rápido
            </button>
          </div>

          {modoPaciente === 'buscar' ? (
            <>
              <label className="label mt-4">Buscar paciente (nome, CPF ou telefone)</label>
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
              {busca.trim().length >= 2 && resultados.length === 0 && (
                <p className="mt-3 text-sm text-muted">Nenhum paciente encontrado. Use o cadastro rápido ao lado.</p>
              )}
            </>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted">
                Dados mínimos para agendar. A ficha médica completa será preenchida pelo médico na primeira consulta.
              </p>
              {erroCadastro && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-brand-red">{erroCadastro}</p>
              )}
              <div>
                <label className="label">Nome completo *</label>
                <input className="input" value={novoPaciente.nome} onChange={(e) => setNovoPaciente((v) => ({ ...v, nome: e.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Telefone *</label>
                  <input className="input" type="tel" value={novoPaciente.telefone} onChange={(e) => setNovoPaciente((v) => ({ ...v, telefone: e.target.value }))} placeholder="(32) 99999-0000" />
                </div>
                <div>
                  <label className="label">Data de nascimento *</label>
                  <input className="input" type="date" value={novoPaciente.dataNascimento} onChange={(e) => setNovoPaciente((v) => ({ ...v, dataNascimento: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Convênio *</label>
                  <select className="input" value={novoPaciente.convenioId} onChange={(e) => setNovoPaciente((v) => ({ ...v, convenioId: e.target.value }))}>
                    {CONVENIOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Sexo (opcional)</label>
                  <select className="input" value={novoPaciente.sexo} onChange={(e) => setNovoPaciente((v) => ({ ...v, sexo: e.target.value }))}>
                    <option value="">Não informado</option>
                    <option value="F">Feminino</option>
                    <option value="M">Masculino</option>
                    <option value="O">Outro</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">CPF (opcional)</label>
                <input className="input" value={novoPaciente.cpf} onChange={(e) => setNovoPaciente((v) => ({ ...v, cpf: e.target.value }))} />
              </div>
              <button
                type="button"
                className="btn-red w-full"
                disabled={carregando || !novoPaciente.nome.trim() || !novoPaciente.telefone.trim() || !novoPaciente.dataNascimento}
                onClick={cadastrarPacienteRapido}
              >
                {carregando ? 'Cadastrando…' : 'Cadastrar e continuar'}
              </button>
            </div>
          )}
        </div>
      )}

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
            {aparelhoCfg ? (
              <div className="rounded-2xl border border-navy-100 bg-navy-50/60 p-4 text-sm">
                <div className="font-semibold text-navy-900">{aparelhoCfg.nome}</div>
                <div className="mt-1 text-xs text-muted">
                  Exame de aparelho — o paciente coloca no horário marcado e retorna em 24h para retirar.
                </div>
              </div>
            ) : (
              <>
                <label className="label">Exames com médico (clique para empilhar consecutivos)</label>
                <div className="flex flex-wrap gap-2">
                  {examesMedico
                    .filter((e) => !slotForcado || medicoForcado?.examesHabilitados.includes(e.id))
                    .map((e) => (
                      <button key={e.id} type="button" onClick={() => addExame(e.id)}
                        className="rounded-xl border border-navy-100 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-50">
                        + {e.nome} <span className="text-muted">({slotForcado ? duracaoNoSlot(e.id) : e.duracaoMin}min)</span>
                      </button>
                    ))}
                </div>

                <label className="label mt-5">Exames de aparelho 24h (horários fixos)</label>
                <div className="flex flex-wrap gap-2">
                  {examesAparelho.map((e) => (
                    <button key={e.id} type="button" onClick={() => addExame(e.id)}
                      className="rounded-xl border border-cardio/30 bg-cardio/5 px-3 py-1.5 text-xs font-medium text-navy-800 hover:bg-cardio/10">
                      + {e.nome} <span className="text-muted">({e.duracaoMin}min · retorno 24h)</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">
                  MAPA e Holter usam horários fixos de colocação do aparelho. Não disponíveis às sextas.
                </p>
              </>
            )}

            {avisoExame && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{avisoExame}</p>
            )}

            {exames.length > 0 && !aparelhoCfg && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-muted mb-2">
                  Sessão ({exames.length} exame{exames.length > 1 ? 's' : ''} ·{' '}
                  {exames.reduce((s, id) => s + (slotForcado ? duracaoNoSlot(id) : EXAMES.find((e) => e.id === id)?.duracaoMin ?? 0), 0)}min)
                </div>
                <ul className="space-y-1.5">
                  {exames.map((id, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2 text-sm">
                      <span className="font-medium text-ink">{i + 1}. {nomeExame(id)}</span>
                      <button type="button" onClick={() => removeExame(i)} className="text-brand-red text-xs hover:underline">remover</button>
                    </li>
                  ))}
                </ul>
                {exames.length > 1 && !slotForcado && !modoAparelho && (
                  <p className="mt-2 text-xs text-navy-600">⚡ O sistema prioriza marcar todos com o <strong>mesmo médico</strong>, em sequência.</p>
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
                <label className="label">
                  {aparelhoCfg || modoAparelho ? 'Aparelho' : `Médico de preferência ${slotForcado ? '' : '(opcional)'}`}
                </label>
                {slotForcado ? (
                  <div className="input flex items-center bg-navy-50 text-navy-800">{prestadorForcado}</div>
                ) : modoAparelho ? (
                  <div className="input flex items-center bg-navy-50 text-navy-800">
                    {nomeExame(exames[0])}
                  </div>
                ) : (
                  <select className="input" value={medicoPref} onChange={(e) => setMedicoPref(e.target.value)}>
                    <option value="">Sem preferência (sistema decide)</option>
                    {MEDICOS.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                )}
              </div>
            </div>

            {!slotForcado && (
              <div className="mt-5">
                <label className="label">Buscar horários a partir de</label>
                <input
                  type="date"
                  className="input"
                  value={dataBusca}
                  min={hojeJF()}
                  onChange={(e) => setDataBusca(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Você pode escolher qualquer data futura — não fica limitado às sugestões automáticas.
                </p>
              </div>
            )}

            <button type="button" className="btn-red mt-5 w-full" disabled={exames.length === 0 || carregando} onClick={() => buscarDisponibilidade()}>
              {slotForcado ? 'Confirmar neste horário' : 'Ver horários disponíveis'}
            </button>
          </div>
        </div>
      )}

      {passo === 3 && (
        <div className="mt-4 space-y-4">
          <button type="button" className="btn-ghost" onClick={() => setPasso(2)}>← Ajustar exames</button>
          {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-brand-red">{erro}</p>}

          {!slotForcado && !proposta && (
            <div className="card p-5">
              <label className="label">Data de início da busca</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <input
                  type="date"
                  className="input flex-1"
                  value={dataBusca}
                  min={hojeJF()}
                  onChange={(e) => setDataBusca(e.target.value)}
                />
                <button type="button" className="btn-primary shrink-0" disabled={carregando} onClick={() => buscarDisponibilidade(dataBusca)}>
                  {carregando ? 'Buscando…' : 'Buscar nesta data'}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                Mostrando horários a partir de <strong>{fmtData(dataBusca + 'T12:00')}</strong>
                {modoAparelho ? ' (até 42 dias à frente)' : ' (até 28 dias à frente)'}.
              </p>
            </div>
          )}

          {carregando && <div className="card p-8 text-center text-sm text-muted">Calculando horários…</div>}

          {!carregando && proposta && (
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-navy-900">{slotForcado ? 'Confirmar horário' : 'Proposta de horário'}</h3>
                {!aparelhoCfg && !modoAparelho && proposta.itens.length > 1 && (
                  proposta.mesmoMedico
                    ? <span className="badge bg-green-50 text-green-700">Mesmo médico ✓</span>
                    : <span className="badge bg-amber-50 text-amber-700">Médicos diferentes</span>
                )}
              </div>
              <ul className="mt-4 space-y-2">
                {proposta.itens.map((it, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl border border-navy-100 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{it.exameNome}</div>
                      <div className="text-xs text-muted">{it.medicoNome}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-navy-700">{fmtHora(it.inicio)}–{fmtHora(it.fim)}</div>
                      <div className="text-xs text-muted">{fmtData(it.inicio)}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn-red mt-5 w-full" disabled={carregando} onClick={solicitarConfirmacaoProposta}>
                Revisar e confirmar
              </button>
            </div>
          )}

          {!carregando && proposta === null && exames.length > 1 && !slotForcado && (
            <div className="card p-8 text-center text-sm text-muted">
              Não foi possível encontrar horários consecutivos a partir desta data. Tente outra data ou reduza os exames.
            </div>
          )}

          {!carregando && !slotForcado && exames.length === 1 && (
            slots.length === 0
              ? (
                <div className="card p-8 text-center text-sm text-muted">
                  Sem horários disponíveis a partir de {fmtData(dataBusca + 'T12:00')}.
                  <button type="button" className="mt-3 block w-full text-brand-red font-semibold hover:underline" onClick={() => setPasso(2)}>
                    Escolher outra data
                  </button>
                </div>
              )
              : <SlotsPorDia slots={slots} onPick={selecionarSlot} nomeMedico={nomeMedico} dataBusca={dataBusca} />
          )}

          {pendente && paciente && (
            <ModalConfirmacao
              paciente={paciente}
              itens={pendente}
              convenioNome={CONVENIOS.find((c) => c.id === convenioId)?.nome ?? convenioId}
              nomeExame={nomeExame}
              nomeMedico={nomeMedico}
              carregando={carregando}
              onConfirmar={confirmarAgendamento}
              onCancelar={() => setPendente(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ModalConfirmacao({ paciente, itens, convenioNome, nomeExame, nomeMedico, carregando, onConfirmar, onCancelar }: {
  paciente: Paciente;
  itens: Array<{ exameId: string; medicoId: string; inicio: string; fim: string }>;
  convenioNome: string;
  nomeExame: (id: string) => string;
  nomeMedico: (id: string) => string;
  carregando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-900/40 p-4" onClick={onCancelar}>
      <div className="card w-full max-w-md p-6 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-xl font-bold text-navy-900">Confirmar agendamento</h3>
        <p className="mt-1 text-sm text-muted">Revise os dados antes de marcar na agenda.</p>

        <div className="mt-5 rounded-2xl bg-navy-50/80 p-4">
          <div className="text-sm font-bold text-ink">{paciente.nome}</div>
          <div className="text-xs text-muted">{paciente.telefone} · {convenioNome}</div>
        </div>

        <ul className="mt-4 space-y-2">
          {itens.map((it, i) => (
            <li key={i} className="flex items-center justify-between rounded-xl border border-navy-100 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-ink">{nomeExame(it.exameId)}</div>
                <div className="text-xs text-muted">{nomeMedico(it.medicoId)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-navy-700">{fmtHora(it.inicio)}–{fmtHora(it.fim)}</div>
                <div className="text-xs text-muted">{fmtData(it.inicio)}</div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex gap-3">
          <button type="button" className="btn-ghost flex-1" disabled={carregando} onClick={onCancelar}>
            Voltar
          </button>
          <button type="button" className="btn-red flex-1" disabled={carregando} onClick={onConfirmar}>
            {carregando ? 'Agendando…' : 'Confirmar agendamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SlotsPorDia({ slots, onPick, nomeMedico, dataBusca }: {
  slots: SlotDisponivel[];
  onPick: (s: SlotDisponivel) => void;
  nomeMedico: (id: string) => string;
  dataBusca: string;
}) {
  const porDia = slots.reduce<Record<string, SlotDisponivel[]>>((acc, s) => {
    const d = s.inicio.slice(0, 10);
    (acc[d] ??= []).push(s);
    return acc;
  }, {});

  const dias = Object.keys(porDia).sort();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {dias.length} dia{dias.length !== 1 ? 's' : ''} com horários a partir de{' '}
        <strong className="text-navy-800">{fmtData(dataBusca + 'T12:00')}</strong>
      </p>
      {dias.map((dia) => (
        <div key={dia} className="card p-5">
          <div className="text-sm font-bold text-navy-900">{fmtData(dia + 'T00:00')}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {porDia[dia].map((s, i) => (
              <button key={i} type="button" onClick={() => onPick(s)}
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
