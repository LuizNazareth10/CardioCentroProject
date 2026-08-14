'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { APARELHOS, MEDICOS, EXAMES } from '@/lib/seed-data';
import type { Agendamento, Medico, StatusAgendamento, TipoAparelho, Weekday } from '@/lib/types';
import { hhmmToMin, minToHHMM, toISO, weekdayOf } from '@/lib/scheduling/time';
import { janelasDoDia } from '@/lib/scheduling/engine';
import { fmtData, fmtHora, hojeJF } from '@/lib/format';
import { DataPagina } from '@/components/DataPagina';
import { STATUS_AGENDAMENTO_COR, STATUS_AGENDAMENTO_LABEL } from '@/lib/status-agendamento';

// Grade de 5 em 5 minutos (não 15): alguns médicos começam o turno em
// horários que não são múltiplos de 15 (ex.: Dr. Daher às sextas, 13:40 —
// ver seed-data.ts). Com passo de 15, esse horário nunca cai numa linha da
// grade e o bloco do agendamento não tem onde "ancorar" (ehInicio nunca
// bate) — ele simplesmente some da tela mesmo existindo no banco. Todos os
// horários usados hoje são múltiplos de 5, então esse passo cobre 100% dos
// casos. ROW_H foi dividido por 3 (54→18) para manter a MESMA altura visual
// por hora — um bloco de 15min continua ocupando 54px (3 linhas de 18px).
const GRID = 5;
const ROW_H = 18;
// Tamanho do "quadrado" de marcação: livre/bloqueado só é clicável de 15 em
// 15 minutos (regra de negócio — não dá pra marcar de 5 em 5). A grade fina
// (GRID) serve só para os agendamentos JÁ existentes conseguirem ancorar em
// horários quebrados; construção de novo agendamento continua em blocos de
// 15min, do mesmo tamanho visual de antes.
const GRID_CLIQUE = 15;
const LINHAS_POR_CLIQUE = GRID_CLIQUE / GRID; // 3
const COL_HORA = 72;
const COL_LARGURA = 158;

function gridCols(n: number) {
  return `${COL_HORA}px repeat(${n}, ${COL_LARGURA}px)`;
}
function gridLargura(n: number) {
  return COL_HORA + n * COL_LARGURA;
}

/** Exibe o registro do paciente de forma compacta na agenda. */
function rotuloPaciente(pacienteId: string): string {
  return pacienteId.replace(/^pac_/, 'P-').toUpperCase();
}

type Coluna =
  | { key: string; tipo: 'medico'; nome: string; sub: string; medico: Medico; atende: boolean }
  | { key: string; tipo: 'aparelho'; nome: string; sub: string; aparelho: TipoAparelho; slots: Set<number>; atende: boolean };

function nowMinJF(): number {
  const s = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false });
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/** "1h05" / "38min" — permanência do paciente entre chegada e finalização */
function duracaoLegivel(de: string, ate: string): string {
  const min = Math.max(0, Math.round((new Date(ate).getTime() - new Date(de).getTime()) / 60_000));
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

/** plano devolvido por /api/agendamentos/remarcar antes de confirmar */
interface PlanoRemarcacaoUI {
  sessao: boolean;
  itens: Array<{ id: string; exameId: string; medicoId: string; inicio: string; fim: string; inicioAnterior: string }>;
}

/**
 * Um quadrado ocupado da agenda. Normalmente é UM agendamento, mas pode ser
 * mais de um quando o médico executa os exames JUNTOS, no mesmo horário
 * (regra do Dr. Daher: eco + carótida em 15min). Nesse caso os registros são
 * separados no banco — a agenda é que os mostra como um bloco só, senão eles
 * ficariam desenhados um por cima do outro.
 */
interface BlocoAgenda {
  chave: string;
  ags: Agendamento[];
}

export default function AgendaPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center text-sm text-muted">Carregando agenda…</div>}>
      <AgendaConteudo />
    </Suspense>
  );
}

function AgendaConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dataParam = searchParams.get('data');
  const novoId = searchParams.get('novo');

  const [data, setData] = useState(dataParam || hojeJF());
  const [ags, setAgs] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [acaoBloco, setAcaoBloco] = useState<BlocoAgenda | null>(null);
  const [destaqueId, setDestaqueId] = useState<string | null>(novoId);
  const [msgSucesso, setMsgSucesso] = useState('');
  const [tick, setTick] = useState(0); // move a linha de "agora"

  // ---- modo REMARCAR ----
  // Mantido só em estado (não na URL): é uma interação curta — escolher o
  // agendamento, navegar pelos dias e clicar no novo horário. O agendamento
  // que está sendo movido pode estar num DIA diferente do que está na tela,
  // por isso guardamos o objeto inteiro, não só o id.
  const [remarcando, setRemarcando] = useState<Agendamento | null>(null);
  const [planoRemarcacao, setPlanoRemarcacao] = useState<PlanoRemarcacaoUI | null>(null);
  const [erroRemarcar, setErroRemarcar] = useState('');
  const [salvandoRemarcacao, setSalvandoRemarcacao] = useState(false);

  useEffect(() => {
    if (dataParam) setData(dataParam);
  }, [dataParam]);

  useEffect(() => {
    if (novoId) setDestaqueId(novoId);
  }, [novoId]);

  const carregar = useCallback(async (d: string) => {
    setCarregando(true);
    const res = await fetch(`/api/agendamentos?de=${d}T00:00:00-03:00&ate=${d}T23:59:00-03:00`);
    const json = await res.json();
    setAgs(json.agendamentos ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(data); }, [data, carregar]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 60_000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (!novoId || carregando) return;
    const ag = ags.find((a) => a.id === novoId);
    if (!ag) return;
    // exames marcados no MESMO horário entram todos na mensagem (o Dr. Daher
    // faz eco + carótida juntos — avisar só de um confundiria a recepção)
    const exameNome = ags
      .filter((a) => a.pacienteId === ag.pacienteId && a.medicoId === ag.medicoId && a.inicio === ag.inicio)
      .map((a) => EXAMES.find((e) => e.id === a.exameId)?.nome ?? a.exameId)
      .join(' + ');
    setMsgSucesso(`Agendamento criado: ${ag.pacienteNome} — ${exameNome} às ${ag.inicio.slice(11, 16)}`);
    const t = setTimeout(() => {
      router.replace(`/agenda?data=${data}`, { scroll: false });
      setDestaqueId(ag.id);
    }, 100);
    const fade = setTimeout(() => setMsgSucesso(''), 8000);
    return () => { clearTimeout(t); clearTimeout(fade); };
  }, [novoId, carregando, ags, data, router]);

  const wd = weekdayOf(data);
  const ehHoje = data === hojeJF();

  const janelasDia = useCallback((m: Medico) => janelasDoDia(m, data), [data]);

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

  // agendamentos do mesmo paciente, prestador e horário viram UM bloco
  const blocos: BlocoAgenda[] = useMemo(() => {
    const porChave = new Map<string, Agendamento[]>();
    for (const a of ags) {
      if (a.status === 'cancelado') continue;
      const chave = `${a.medicoId}|${a.pacienteId}|${a.inicio}|${a.fim}`;
      const atual = porChave.get(chave);
      if (atual) atual.push(a);
      else porChave.set(chave, [a]);
    }
    return [...porChave.entries()].map(([chave, lista]) => ({ chave, ags: lista }));
  }, [ags]);

  const inicioDoBloco = (b: BlocoAgenda) => hhmmToMin(b.ags[0].inicio.slice(11, 16));
  const fimDoBloco = (b: BlocoAgenda) => hhmmToMin(b.ags[0].fim.slice(11, 16));
  const cobre = (b: BlocoAgenda, t: number) => inicioDoBloco(b) <= t && t < fimDoBloco(b);

  function celulaMedico(m: Medico, t: number): { bloco?: BlocoAgenda; dentro: boolean } {
    const dentro = janelasDia(m).some((j) => hhmmToMin(j.inicio) <= t && t < hhmmToMin(j.fim));
    return { bloco: blocos.find((b) => b.ags[0].medicoId === m.id && cobre(b, t)), dentro };
  }
  /** bloco de aparelho que COBRE o minuto t (início pode não ser exatamente t) */
  const blocoAparelhoContendo = (tipo: TipoAparelho, t: number) =>
    blocos.find((b) => b.ags[0].exameId === tipo && cobre(b, t));

  const ehInicio = (b: BlocoAgenda, t: number) => inicioDoBloco(b) === t;
  const spanDe = (b: BlocoAgenda) => Math.max(1, (fimDoBloco(b) - inicioDoBloco(b)) / GRID);

  // -------- segmentação livre/bloqueado em blocos de 15min --------
  // Com a grade fina (5min) para ancorar horários quebrados, uma célula
  // livre/bloqueada "normal" (múltiplo de 15) viraria 3 sub-linhas
  // independentes — cada uma clicável, quebrando a regra de só marcar de 15
  // em 15 e deixando o "+" minúsculo. Aqui a gente re-agrupa: percorre as
  // linhas da coluna e funde sequências do MESMO estado em blocos de até
  // LINHAS_POR_CLIQUE linhas (o que sobrar antes de um agendamento "torto"
  // vira um bloco menor, do tamanho que couber — nunca maior que 15min).
  type EstadoCelula = 'ag' | 'livre' | 'bloqueado' | 'off-dia';

  function estadoLinha(c: Coluna, t: number): EstadoCelula {
    if (c.tipo === 'medico') {
      if (!c.atende) return 'off-dia';
      const { bloco, dentro } = celulaMedico(c.medico, t);
      if (bloco) return 'ag';
      return dentro ? 'livre' : 'bloqueado';
    }
    if (blocoAparelhoContendo(c.aparelho, t)) return 'ag';
    return c.slots.has(t) ? 'livre' : 'bloqueado';
  }

  function segmentarLivreBloqueado(c: Coluna): Map<number, { estado: EstadoCelula; span: number }> {
    const segs = new Map<number, { estado: EstadoCelula; span: number }>();
    let i = 0;
    while (i < linhas.length) {
      const e = estadoLinha(c, linhas[i]);
      if (e === 'ag') { i++; continue; }
      let span = 1;
      while (span < LINHAS_POR_CLIQUE && i + span < linhas.length && estadoLinha(c, linhas[i + span]) === e) span++;
      segs.set(linhas[i], { estado: e, span });
      i += span;
    }
    return segs;
  }

  const segmentosPorColuna = useMemo(
    () => new Map(colunas.map((c) => [c.key, segmentarLivreBloqueado(c)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colunas, blocos, data],
  );

  /**
   * Clique num horário vago. Em operação normal abre o fluxo de novo
   * agendamento; no modo REMARCAR, o mesmo clique vira o destino do
   * agendamento que está sendo movido — a agenda inteira já é o seletor de
   * horário, não precisamos de uma segunda tela.
   */
  function abrir(medicoOuAparelho: { medico?: string; aparelho?: TipoAparelho }, t: number, excecao = false) {
    if (remarcando) return simularRemarcacao(medicoOuAparelho, t);
    const p = new URLSearchParams({ data, hora: minToHHMM(t) });
    if (medicoOuAparelho.medico) p.set('medico', medicoOuAparelho.medico);
    if (medicoOuAparelho.aparelho) p.set('aparelho', medicoOuAparelho.aparelho);
    if (excecao) p.set('excecao', '1');
    router.push(`/agendar?${p.toString()}`);
  }

  function iniciarRemarcacao(ag: Agendamento) {
    setRemarcando(ag);
    setAcaoBloco(null);
    setErroRemarcar('');
    setMsgSucesso('');
  }

  function cancelarRemarcacao() {
    setRemarcando(null);
    setPlanoRemarcacao(null);
    setErroRemarcar('');
  }

  /** pede o plano ao servidor (sem gravar) para mostrar na confirmação */
  async function simularRemarcacao(destino: { medico?: string; aparelho?: TipoAparelho }, t: number) {
    if (!remarcando) return;
    setErroRemarcar('');
    const res = await fetch('/api/agendamentos/remarcar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: remarcando.id,
        inicio: toISO(data, t),
        medicoId: destino.medico ?? destino.aparelho,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setErroRemarcar(json.erro ?? 'Não foi possível remarcar.'); return; }
    setPlanoRemarcacao({ sessao: json.sessao, itens: json.itens ?? [] });
  }

  async function confirmarRemarcacao() {
    if (!remarcando || !planoRemarcacao) return;
    const alvo = planoRemarcacao.itens.find((i) => i.id === remarcando.id) ?? planoRemarcacao.itens[0];
    setSalvandoRemarcacao(true);
    const res = await fetch('/api/agendamentos/remarcar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: remarcando.id, inicio: alvo.inicio, medicoId: alvo.medicoId, aplicar: true }),
    });
    const json = await res.json();
    setSalvandoRemarcacao(false);
    if (!res.ok) { setErroRemarcar(json.erro ?? 'Não foi possível remarcar.'); setPlanoRemarcacao(null); return; }

    const paciente = remarcando.pacienteNome;
    const destinoData = alvo.inicio.slice(0, 10);
    setPlanoRemarcacao(null);
    setRemarcando(null);
    setDestaqueId(alvo.id);
    setMsgSucesso(`Remarcado: ${paciente} — ${fmtData(alvo.inicio)} às ${fmtHora(alvo.inicio)}`);
    setTimeout(() => setMsgSucesso(''), 8000);
    // leva a agenda para o dia de destino (pode ser outro dia)
    if (destinoData !== data) setData(destinoData);
    else carregar(data);
  }

  /** aplica o status a TODOS os exames do bloco (eles acontecem juntos) */
  async function mudarStatus(ids: string[], status: StatusAgendamento) {
    for (const id of ids) {
      await fetch('/api/agendamentos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
    }
    setAcaoBloco(null);
    carregar(data);
  }

  const blocoOcupado = (b: BlocoAgenda, span: number) => {
    const principal = b.ags[0];
    const exames = b.ags.map((a) => nomeExame(a.exameId)).join(' + ');
    const observacao = [...new Set(b.ags.map((a) => a.observacao).filter(Boolean))].join(' · ');
    // no modo remarcar, os demais blocos ficam inertes (não há para onde
    // mover em cima de alguém); só o que está sendo movido segue destacado
    const movendoEste = !!remarcando && b.ags.some((a) => a.id === remarcando.id);
    const inerte = !!remarcando && !movendoEste;
    const destacado = !!destaqueId && b.ags.some((a) => a.id === destaqueId);
    return (
      <button
        type="button"
        disabled={inerte}
        onClick={() => (movendoEste ? cancelarRemarcacao() : setAcaoBloco(b))}
        className={`absolute inset-x-0.5 overflow-hidden rounded-lg px-2 py-2 text-left text-white shadow-soft transition hover:brightness-110 ${STATUS_AGENDAMENTO_COR[principal.status]} ${destacado ? 'ring-2 ring-cardio ring-offset-2 animate-pulse' : ''} ${movendoEste ? 'ring-2 ring-brand-red ring-offset-2' : ''} ${inerte ? 'opacity-40' : ''}`}
        style={{ height: `calc(${span * ROW_H}px - 4px)` }}
        title={
          inerte
            ? 'Horário ocupado — escolha um horário livre para remarcar'
            : `${rotuloPaciente(principal.pacienteId)} · ${principal.pacienteNome} · ${exames}${observacao ? ` · Obs.: ${observacao}` : ''} (${STATUS_AGENDAMENTO_LABEL[principal.status]})`
        }
      >
        <div className="truncate text-[11px] font-bold leading-snug">{principal.pacienteNome}</div>
        <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-white/80">
          {rotuloPaciente(principal.pacienteId)}
          {/* dois exames no mesmo horário: avisa que o bloco tem mais de um */}
          {b.ags.length > 1 && ` · ${b.ags.length} exames`}
        </div>
        <div className={`text-[10px] leading-snug text-white/75 ${span >= 2 ? 'line-clamp-2' : 'truncate'}`}>{exames}</div>
        {observacao && (
          <div className={`mt-0.5 text-[10px] font-semibold leading-snug text-amber-100 ${span >= 2 ? 'line-clamp-2' : 'truncate'}`}>
            Obs.: {observacao}
          </div>
        )}
        {/* chegada → finalização direto no bloco, assim que o exame acaba */}
        {principal.chegouEm && principal.finalizadoEm && (
          <div className="mt-0.5 truncate text-[10px] font-semibold leading-snug text-white/90">
            ⏱ {fmtHora(principal.chegouEm)} → {fmtHora(principal.finalizadoEm)}
          </div>
        )}
      </button>
    );
  };

  const nowMin = nowMinJF();
  const mostraAgora = ehHoje && nowMin >= minDia && nowMin < maxDia;
  const topoAgora = ((nowMin - minDia) / GRID) * ROW_H;
  void tick; // dependência que reposiciona a linha a cada minuto

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Agenda</h1>
          <DataPagina data={data} />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-outline" aria-label="Dia anterior" onClick={() => setData(shift(data, -1))}>←</button>
          <input type="date" className="input w-auto" value={data} onChange={(e) => setData(e.target.value)} />
          <button className="btn-outline" aria-label="Próximo dia" onClick={() => setData(shift(data, 1))}>→</button>
          <button className="btn-ghost" onClick={() => setData(hojeJF())}>Hoje</button>
        </div>
      </header>

      {msgSucesso && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
          <span>✓ {msgSucesso}</span>
          <button type="button" className="text-xs font-semibold text-success/80 hover:underline" onClick={() => setMsgSucesso('')}>
            Fechar
          </button>
        </div>
      )}

      {remarcando && (
        <div className="mt-4 rounded-2xl border border-brand-red/30 bg-brand-red/5 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-navy-900">
              <strong className="text-brand-red">Remarcando</strong> · {remarcando.pacienteNome} —{' '}
              {nomeExame(remarcando.exameId)}
              <div className="text-xs text-muted">
                Hoje em {fmtData(remarcando.inicio)} às {fmtHora(remarcando.inicio)}. Navegue pelos dias e
                clique em um <strong>horário livre</strong> para mover.
              </div>
            </div>
            <button type="button" className="btn-ghost shrink-0" onClick={cancelarRemarcacao}>
              Cancelar remarcação
            </button>
          </div>
          {erroRemarcar && (
            <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-brand-red">{erroRemarcar}</p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="slot-livre h-3.5 w-3.5 rounded ring-1 ring-inset ring-success/30" /> Livre · clique para {remarcando ? 'mover para cá' : 'agendar'}</span>
        <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-navyblue" /> Agendado</span>
        <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-success" /> Confirmado</span>
        <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-danger" /> Chegou</span>
        <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-warning" /> Em atendimento</span>
        <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-info" /> Realizado</span>
        <span className="flex items-center gap-1.5"><i className="slot-bloqueado h-3.5 w-3.5 rounded ring-1 ring-inset ring-navy-100" /> Bloqueado · clique p/ liberar exceção</span>
        <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-cardio" /> Agora</span>
      </div>

      <div className="mt-4 max-w-full overflow-x-auto">
        <div
          className="card overflow-hidden"
          style={{ width: gridLargura(colunas.length) }}
        >
            {/* cabeçalho */}
            <div
              className="sticky top-0 z-20 grid border-b border-navy-200 bg-white/95 backdrop-blur-sm"
              style={{ gridTemplateColumns: gridCols(colunas.length) }}
            >
              <div className="px-2 py-3" />
              {colunas.map((c) => {
                const horario = c.tipo === 'medico' && c.atende ? resumoJanelas(c.medico) : '';
                return (
                  <div
                    key={c.key}
                    className={`min-w-0 border-l px-2 py-2.5 ${c.tipo === 'aparelho' ? 'border-navy-200 bg-cardio/5' : 'border-navy-100'} ${!c.atende ? 'bg-navy-50/40' : ''}`}
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
                <div
                  className="pointer-events-none absolute z-20 flex items-center"
                  style={{ top: topoAgora, left: COL_HORA, width: gridLargura(colunas.length) - COL_HORA }}
                >
                  <span className="h-2 w-2 flex-none rounded-full bg-cardio" />
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
                    style={{ gridTemplateColumns: gridCols(colunas.length), height: ROW_H }}
                  >
                    <div className={`min-w-0 px-2 py-1 text-right text-[11px] ${hora ? 'font-bold text-navy-800' : 'text-muted'}`}>
                      {hora || meia ? minToHHMM(t) : ''}
                    </div>

                    {colunas.map((c) => {
                      const cellCls = `min-w-0 border-l border-navy-100/60`;
                      const seg = segmentosPorColuna.get(c.key)?.get(t);

                      if (c.tipo === 'medico') {
                        const { bloco, dentro } = c.atende ? celulaMedico(c.medico, t) : { bloco: undefined, dentro: false };
                        if (bloco && !ehInicio(bloco, t)) return <div key={c.key} className={cellCls} />;
                        if (bloco) return <div key={c.key} className={`relative ${cellCls} p-0.5`}>{blocoOcupado(bloco, spanDe(bloco))}</div>;
                        if (!seg) return <div key={c.key} className={cellCls} />; // absorvido por um bloco de 15min anterior
                        if (!c.atende) {
                          return (
                            <CelulaExcecao
                              key={c.key}
                              span={seg.span}
                              className="slot-off-dia"
                              onClick={() => abrir({ medico: c.medico.id }, t, true)}
                              titulo={`Liberar horário com ${c.medico.nome} às ${minToHHMM(t)} (médico sem atendimento neste dia)`}
                            />
                          );
                        }
                        return dentro
                          ? <CelulaLivre key={c.key} span={seg.span} onClick={() => abrir({ medico: c.medico.id }, t)} titulo={`Agendar com ${c.medico.nome} às ${minToHHMM(t)}`} />
                          : (
                            <CelulaExcecao
                              key={c.key}
                              span={seg.span}
                              className="slot-bloqueado"
                              onClick={() => abrir({ medico: c.medico.id }, t, true)}
                              titulo={`Liberar horário com ${c.medico.nome} às ${minToHHMM(t)} (fora da janela)`}
                            />
                          );
                      }

                      const blocoAparelho = blocoAparelhoContendo(c.aparelho, t);
                      if (blocoAparelho && !ehInicio(blocoAparelho, t)) return <div key={c.key} className={cellCls} />;
                      if (blocoAparelho) return <div key={c.key} className={`relative ${cellCls} p-0.5`}>{blocoOcupado(blocoAparelho, spanDe(blocoAparelho))}</div>;
                      if (!seg) return <div key={c.key} className={cellCls} />;
                      return seg.estado === 'livre'
                        ? <CelulaLivre key={c.key} span={seg.span} onClick={() => abrir({ aparelho: c.aparelho }, t)} titulo={`Agendar ${c.nome} às ${minToHHMM(t)}`} />
                        : (
                          <CelulaExcecao
                            key={c.key}
                            span={seg.span}
                            className="slot-bloqueado"
                            onClick={() => abrir({ aparelho: c.aparelho }, t, true)}
                            titulo={`Liberar coleta ${c.nome} às ${minToHHMM(t)} (fora dos horários fixos)`}
                          />
                        );
                    })}
                  </div>
                );
              })}
            </div>
        </div>
      </div>

      {acaoBloco && (
        <PopoverAcao
          bloco={acaoBloco}
          nomeExame={nomeExame}
          onFechar={() => setAcaoBloco(null)}
          onStatus={mudarStatus}
          onFicha={() => router.push(`/pacientes/${acaoBloco.ags[0].pacienteId}`)}
          onRemarcar={() => iniciarRemarcacao(acaoBloco.ags[0])}
        />
      )}

      {planoRemarcacao && remarcando && (
        <ModalRemarcacao
          ag={remarcando}
          plano={planoRemarcacao}
          nomeExame={nomeExame}
          nomePrestador={nomePrestador}
          salvando={salvandoRemarcacao}
          onConfirmar={confirmarRemarcacao}
          onCancelar={() => setPlanoRemarcacao(null)}
        />
      )}
    </div>
  );
}

/** nome do médico OU do aparelho (MAPA/Holter usam o tipo como "prestador") */
function nomePrestador(id: string): string {
  const m = MEDICOS.find((x) => x.id === id);
  if (m) return m.nome;
  if (id === 'mapa' || id === 'holter') return APARELHOS[id].nome;
  return id;
}

// célula de horário LIVRE: faixa verde sempre visível + "+" ao passar o mouse
/**
 * `span` = quantas linhas da grade fina (5min) esse quadrado cobre — normalmente
 * LINHAS_POR_CLIQUE (15min inteiros), ou menos quando um agendamento em
 * horário quebrado corta o espaço disponível antes de completar 15min. O
 * wrapper ocupa só a linha em que começa; o botão estica por cima via
 * position:absolute, igual ao bloco de agendamento ocupado.
 */
function CelulaLivre({ onClick, titulo, span = 1 }: { onClick: () => void; titulo: string; span?: number }) {
  return (
    <div className="relative min-w-0 border-l border-navy-100/60">
      <button
        type="button"
        onClick={onClick}
        title={titulo}
        style={{ height: span * ROW_H }}
        className="slot-livre group absolute inset-x-0 top-0 transition-colors"
      >
        <span className="pointer-events-none absolute inset-1 rounded-md opacity-0 ring-1 ring-inset ring-success/50 transition-opacity group-hover:opacity-100" />
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-bold text-success opacity-0 transition-opacity group-hover:opacity-100">+</span>
      </button>
    </div>
  );
}

/** Horário rachurado / fora da janela — clique libera exceção sem mudar o visual padrão. */
function CelulaExcecao({ onClick, titulo, className, span = 1 }: { onClick: () => void; titulo: string; className: string; span?: number }) {
  return (
    <div className="relative min-w-0 border-l border-navy-100/60">
      <button
        type="button"
        onClick={onClick}
        title={titulo}
        style={{ height: span * ROW_H }}
        className={`group absolute inset-x-0 top-0 transition-colors hover:brightness-[0.97] ${className}`}
      >
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-bold text-navy-500 opacity-0 transition-opacity group-hover:opacity-100">+</span>
      </button>
    </div>
  );
}

function PopoverAcao({ bloco, nomeExame, onFechar, onStatus, onFicha, onRemarcar }: {
  bloco: BlocoAgenda; nomeExame: (id: string) => string; onFechar: () => void;
  onStatus: (ids: string[], s: StatusAgendamento) => void; onFicha: () => void; onRemarcar: () => void;
}) {
  const ag = bloco.ags[0];
  const ids = bloco.ags.map((a) => a.id);
  const observacoes = [...new Set(bloco.ags.map((a) => a.observacao).filter(Boolean))];
  const acoes: Array<{ label: string; status?: StatusAgendamento; cls: string }> = [
    { label: 'Confirmar presença (verde)', status: 'confirmado', cls: 'text-success' },
    { label: 'Paciente chegou (vermelho)', status: 'chegou', cls: 'text-danger' },
    { label: 'Em atendimento (laranja)', status: 'em_atendimento', cls: 'text-warning' },
    { label: 'Finalizar atendimento (azul)', status: 'realizado', cls: 'text-info' },
    { label: 'Marcar falta', status: 'faltou', cls: 'text-gray-600' },
    { label: 'Cancelar (libera o horário)', status: 'cancelado', cls: 'text-brand-red' },
  ];
  // remarcar só faz sentido enquanto o atendimento não aconteceu
  const podeRemarcar = ag.status !== 'realizado' && ag.status !== 'cancelado';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-900/40 p-4" onClick={onFechar}>
      <div className="card max-h-[90vh] w-full max-w-sm overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-bold text-navy-900">{ag.pacienteNome}</div>
        <div className="text-xs font-semibold text-navy-700">{rotuloPaciente(ag.pacienteId)}</div>
        <div className="text-xs text-muted">
          {bloco.ags.map((a) => nomeExame(a.exameId)).join(' + ')} · {ag.inicio.slice(11, 16)}–{ag.fim.slice(11, 16)}
        </div>
        {bloco.ags.length > 1 && (
          <div className="mt-2 rounded-xl bg-cardio/10 px-3 py-2 text-xs font-medium text-navy-800">
            {bloco.ags.length} exames no mesmo horário — as ações abaixo valem para todos.
          </div>
        )}
        {observacoes.length > 0 && (
          <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            Obs.: {observacoes.join(' · ')}
          </div>
        )}
        <span className="badge mt-2 bg-navy-50 text-navy-700">{STATUS_AGENDAMENTO_LABEL[ag.status]}</span>

        <MarcosDoAtendimento ag={ag} />

        <div className="mt-4 space-y-1.5">
          <button onClick={onFicha} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-navy-700 hover:bg-navy-50">
            Ver ficha de identidade →
          </button>
          {acoes.map((a) => (
            <button
              key={a.label}
              disabled={bloco.ags.every((x) => x.status === a.status)}
              onClick={() => a.status && onStatus(ids, a.status)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-navy-50 disabled:opacity-40 ${a.cls}`}
            >
              {a.label}
            </button>
          ))}
          {podeRemarcar && (
            <button
              onClick={onRemarcar}
              className="flex w-full items-center gap-2 rounded-xl border border-navy-100 px-3 py-2.5 text-left text-sm font-semibold text-navy-800 hover:bg-navy-50"
            >
              🔁 Remarcar (escolher outro horário)
            </button>
          )}
        </div>
        <button onClick={onFechar} className="mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold text-muted hover:bg-navy-50">Fechar</button>
      </div>
    </div>
  );
}

/**
 * Marcos do dia do exame: hora exata em que a recepção marcou "chegou" e
 * "finalizado", com a permanência total. Só aparece depois do primeiro
 * clique — antes disso não há o que mostrar.
 */
function MarcosDoAtendimento({ ag }: { ag: Agendamento }) {
  if (!ag.chegouEm && !ag.finalizadoEm && !ag.remarcadoEm) return null;
  return (
    <div className="mt-3 space-y-1.5 rounded-xl border border-navy-100 bg-navy-50/60 px-3 py-2.5">
      {(ag.chegouEm || ag.finalizadoEm) && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Chegou</div>
            <div className={`text-sm font-bold ${ag.chegouEm ? 'text-danger' : 'text-muted'}`}>
              {ag.chegouEm ? fmtHora(ag.chegouEm) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Finalizou</div>
            <div className={`text-sm font-bold ${ag.finalizadoEm ? 'text-info' : 'text-muted'}`}>
              {ag.finalizadoEm ? fmtHora(ag.finalizadoEm) : '—'}
            </div>
          </div>
        </div>
      )}
      {ag.chegouEm && ag.finalizadoEm && (
        <div className="border-t border-navy-100 pt-1.5 text-[11px] font-semibold text-navy-700">
          Permanência: {duracaoLegivel(ag.chegouEm, ag.finalizadoEm)}
        </div>
      )}
      {ag.remarcadoEm && ag.inicioAnterior && (
        <div className="border-t border-navy-100 pt-1.5 text-[11px] text-muted">
          🔁 Remarcado — antes era {fmtData(ag.inicioAnterior)} às {fmtHora(ag.inicioAnterior)}
        </div>
      )}
    </div>
  );
}

/** confirmação da remarcação: mostra exatamente o que vai ser movido */
function ModalRemarcacao({ ag, plano, nomeExame, nomePrestador, salvando, onConfirmar, onCancelar }: {
  ag: Agendamento;
  plano: PlanoRemarcacaoUI;
  nomeExame: (id: string) => string;
  nomePrestador: (id: string) => string;
  salvando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-900/40 p-4" onClick={onCancelar}>
      <div className="card w-full max-w-md p-6 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-xl font-bold text-navy-900">Confirmar remarcação</h3>
        <p className="mt-1 text-sm text-muted">{ag.pacienteNome} · {rotuloPaciente(ag.pacienteId)}</p>

        {plano.sessao && (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            Este exame foi marcado junto com outros na mesma sessão. Os {plano.itens.length} exames serão
            movidos juntos, mantendo a sequência e cada um com o seu médico.
          </p>
        )}

        <ul className="mt-4 space-y-2">
          {/* exames que vão para o MESMO horário aparecem numa linha só */}
          {[...new Map(plano.itens.map((it) => [`${it.medicoId}|${it.inicio}`, it])).values()].map((it) => {
            const juntos = plano.itens.filter((x) => x.medicoId === it.medicoId && x.inicio === it.inicio);
            return (
              <li key={it.id} className="rounded-xl border border-navy-100 px-4 py-3">
                <div className="text-sm font-semibold text-ink">{juntos.map((x) => nomeExame(x.exameId)).join(' + ')}</div>
                <div className="text-xs text-muted">{nomePrestador(it.medicoId)}</div>
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  <span className="text-muted line-through">
                    {fmtData(it.inicioAnterior)} {fmtHora(it.inicioAnterior)}
                  </span>
                  <span className="text-navy-400">→</span>
                  <span className="font-bold text-brand-red">
                    {fmtData(it.inicio)} {fmtHora(it.inicio)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-[11px] text-muted">
          O agendamento é movido (não duplicado). O status volta para <strong>Agendado</strong> e o lembrete
          de confirmação será reenviado para a nova data.
        </p>

        <div className="mt-6 flex gap-3">
          <button type="button" className="btn-ghost flex-1" disabled={salvando} onClick={onCancelar}>
            Voltar
          </button>
          <button type="button" className="btn-red flex-1" disabled={salvando} onClick={onConfirmar}>
            {salvando ? 'Remarcando…' : 'Confirmar remarcação'}
          </button>
        </div>
      </div>
    </div>
  );
}

function shift(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
