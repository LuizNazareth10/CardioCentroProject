'use client';

import { useEffect, useState } from 'react';
import type { ClinicConfig, ExameOverride, ModoAgente } from '@/lib/clinic-config';
import type { Exame } from '@/lib/types';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MODOS: Array<{ id: ModoAgente; nome: string; desc: string; cor: string }> = [
  { id: 'full', nome: 'Full — atende todos', desc: 'Comportamento padrão: a IA responde a todas as leads.', cor: 'text-navy-700' },
  { id: 'shadow', nome: 'Shadow — só rascunho', desc: 'A IA rascunha a resposta mas NÃO envia ao paciente; o rascunho vai para o Slack/Discord. Risco zero — ideal para a fase 0.', cor: 'text-blue-700' },
  { id: 'canary', nome: 'Canary — fração das leads', desc: 'A IA atende só uma % das leads (fixa por número); o restante segue com a recepção. Suba aos poucos.', cor: 'text-amber-700' },
  { id: 'paused', nome: 'Pausado — kill-switch', desc: 'A IA não atende ninguém. Tudo volta para a recepção humana.', cor: 'text-brand-red' },
];

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<ClinicConfig | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((j) => setConfig(j.config))
      .finally(() => setCarregando(false));
  }, []);

  function patchExame(id: string, patch: ExameOverride) {
    if (!config) return;
    setConfig({
      ...config,
      exames: config.exames.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }

  async function salvar() {
    if (!config) return;
    setSalvando(true);
    setErro('');
    setMsg('');
    const exames: Record<string, ExameOverride> = {};
    config.exames.forEach((e) => {
      exames[e.id] = { nome: e.nome, duracaoMin: e.duracaoMin, preparo: e.preparo, ativo: e.ativo };
    });
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exames,
        convenios: config.convenios,
        contato: config.contato,
        agente: config.agente,
      }),
    });
    const j = await res.json();
    setSalvando(false);
    if (!res.ok) {
      setErro(j.erro ?? 'Erro ao salvar.');
      return;
    }
    setConfig(j.config);
    setMsg('Configurações salvas com sucesso.');
  }

  if (carregando || !config) {
    return <div className="card p-8 text-center text-sm text-muted">Carregando configurações…</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Configurações</h1>
          <p className="text-sm text-muted">Médicos, exames, convênios e contato da clínica.</p>
        </div>
        <button type="button" className="btn-red" disabled={salvando || !config.editavel} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>

      {!config.editavel && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Edição persistente disponível apenas com <strong>DATA_BACKEND=firestore</strong> em produção.
          No modo local (memory), as alterações não são gravadas.
        </div>
      )}

      {config.editavel && (
        <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Modo Firestore ativo — alterações em exames e contato são salvas na nuvem.
          {config.atualizadoEm && <> Última atualização: {new Date(config.atualizadoEm).toLocaleString('pt-BR')}.</>}
        </div>
      )}

      {msg && <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-success">{msg}</p>}
      {erro && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-brand-red">{erro}</p>}

      <section className="mt-6">
        <h2 className="mb-3 font-bold text-navy-900">Agente de WhatsApp</h2>
        <div className="card p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={config.agente.ativo}
              disabled={!config.editavel}
              onChange={(e) => setConfig({ ...config, agente: { ...config.agente, ativo: e.target.checked } })}
            />
            <span>
              <span className="block text-sm font-semibold text-ink">
                Agente automático {config.agente.ativo ? 'ligado' : 'desligado'}
              </span>
              <span className="block text-xs text-muted">
                Desligado = modo manual: todas as mensagens do WhatsApp vão direto para a fila de{' '}
                <strong>Atendimentos</strong> e o paciente recebe a resposta automática abaixo.
              </span>
            </span>
          </label>
          {!config.agente.ativo && (
            <div className="mt-4">
              <div className="label">Resposta automática (agente desligado)</div>
              {config.editavel ? (
                <textarea
                  className="input min-h-[70px] text-sm"
                  value={config.agente.mensagemForaDoAr}
                  onChange={(e) =>
                    setConfig({ ...config, agente: { ...config.agente, mensagemForaDoAr: e.target.value } })
                  }
                />
              ) : (
                <p className="text-sm text-ink">{config.agente.mensagemForaDoAr}</p>
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            Para testar o comportamento do agente sem WhatsApp real, use o{' '}
            <a href="/simulador" className="font-semibold text-navy-700 underline">Simulador</a>.
          </p>
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 font-bold text-navy-900">Rollout do agente (teste em produção)</h2>
        <p className="mb-3 text-xs text-muted">
          Controla <strong>quem</strong> a IA atende, ajustável aqui mesmo sem novo deploy. Use para testar com
          clientes reais em fração pequena e crescente, sem risco de perder leads.
        </p>
        <div className="card p-5 space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {MODOS.map((m) => {
              const ativo = config.agente.modo === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!config.editavel}
                  onClick={() => setConfig({ ...config, agente: { ...config.agente, modo: m.id } })}
                  className={`rounded-2xl border p-3 text-left transition ${ativo ? 'border-brand-red bg-brand-red/5' : 'border-navy-100 hover:bg-navy-50'} disabled:opacity-60`}
                >
                  <div className={`text-sm font-bold ${m.cor}`}>{ativo ? '● ' : ''}{m.nome}</div>
                  <div className="mt-0.5 text-xs text-muted">{m.desc}</div>
                </button>
              );
            })}
          </div>

          {config.agente.modo === 'canary' && (
            <div className="rounded-xl bg-amber-50 p-4">
              <label className="label">Porcentagem de leads atendidas pela IA</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={0} max={100} step={1}
                  disabled={!config.editavel}
                  value={config.agente.canaryPct}
                  onChange={(e) => setConfig({ ...config, agente: { ...config.agente, canaryPct: Number(e.target.value) } })}
                  className="flex-1"
                />
                <input
                  type="number" min={0} max={100}
                  disabled={!config.editavel}
                  value={config.agente.canaryPct}
                  onChange={(e) => setConfig({ ...config, agente: { ...config.agente, canaryPct: Math.max(0, Math.min(100, Number(e.target.value))) } })}
                  className="input w-20 text-center"
                />
                <span className="text-sm font-bold text-amber-800">%</span>
              </div>
              <p className="mt-2 text-xs text-amber-800">
                A seleção é <strong>fixa por número</strong>: o mesmo paciente é sempre IA ou sempre humano — nunca
                alterna no meio da conversa. Seus números de teste (allowlist) são sempre atendidos.
              </p>
            </div>
          )}

          {config.agente.modo === 'shadow' && (
            <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
              Defina <code>SHADOW_WEBHOOK_URL</code> (Slack ou Discord) nas variáveis de ambiente para receber os
              rascunhos. Sem ela, os rascunhos apenas aparecem nos logs do servidor.
            </p>
          )}

          <p className="text-xs text-muted">
            Lembre-se de <strong>salvar</strong> para aplicar. A mudança passa a valer nas próximas mensagens, sem redeploy.
          </p>

          <MonitorAgente />
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 font-bold text-navy-900">Confirmação de presença</h2>
        <div className="card p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={config.agente.confirmacaoAntecedenciaAtiva}
              disabled={!config.editavel}
              onChange={(e) =>
                setConfig({ ...config, agente: { ...config.agente, confirmacaoAntecedenciaAtiva: e.target.checked } })
              }
            />
            <span>
              <span className="block text-sm font-semibold text-ink">
                Lembrete automático 1 dia antes {config.agente.confirmacaoAntecedenciaAtiva ? 'ligado' : 'desligado'}
              </span>
              <span className="block text-xs text-muted">
                Ligado = o agente manda uma mensagem no WhatsApp um dia antes do horário marcado, pedindo para o
                paciente confirmar presença. Quando o paciente responde (texto ou botão), o agendamento fica{' '}
                <strong className="text-success">verde</strong> na Agenda automaticamente.
              </span>
            </span>
          </label>
          <p className="mt-3 text-xs text-muted">
            As demais cores da Agenda (paciente chegou · em atendimento · finalizado) são sempre marcadas
            manualmente pela recepção — o agente nunca altera essas etapas.
          </p>
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 font-bold text-navy-900">Médicos</h2>
        <p className="mb-3 text-xs text-muted">Horários de atendimento — alteração sob demanda com suporte técnico.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {config.medicos.filter((m) => m.ativo).map((m) => (
            <div key={m.id} className="card p-4">
              <div className="text-sm font-bold text-navy-900">{m.nome}</div>
              <div className="text-xs text-muted">{m.crm}</div>
              <div className="mt-3 text-xs text-muted">Atendimento:</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {Array.from(new Set(m.disponibilidade.map((j) => `${DIAS[j.weekday]} ${j.inicio}–${j.fim}`))).map((s) => (
                  <span key={s} className="badge bg-navy-50 text-navy-700">{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 font-bold text-navy-900">Exames</h2>
        <div className="card divide-y divide-navy-100/70">
          {config.exames.map((e) => (
            <ExameRow key={e.id} exame={e} editavel={config.editavel} onChange={(p) => patchExame(e.id, p)} />
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 font-bold text-navy-900">Convênios aceitos</h2>
        <div className="card p-4 flex flex-wrap gap-1.5">
          {config.convenios.map((c) => <span key={c.id} className="badge bg-navy-50 text-navy-700">{c.nome}</span>)}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 font-bold text-navy-900">Contato</h2>
        <div className="card p-5 space-y-4">
          <Campo label="E-mail" value={config.contato.email} editavel={config.editavel}
            onChange={(v) => setConfig({ ...config, contato: { ...config.contato, email: v } })} />
          <Campo label="Telefone fixo" value={config.contato.telefoneFixo} editavel={config.editavel}
            onChange={(v) => setConfig({ ...config, contato: { ...config.contato, telefoneFixo: v, telefone: v } })} />
          <Campo label="WhatsApp (mensagens)" value={config.contato.whatsapp} editavel={config.editavel}
            onChange={(v) => setConfig({ ...config, contato: { ...config.contato, whatsapp: v } })} />
          <div className="text-sm text-muted">
            Endereço: <strong className="text-ink">{config.contato.enderecoCompleto}</strong>
          </div>
          <ul className="text-sm text-muted space-y-1">
            {config.contato.horarios.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}

interface EventoAgente {
  ts: string; numero: string; bucket: number; modo: string; desfecho: string; motivo: string; ms?: number; erro?: string;
}
const DESFECHO_META: Record<string, { label: string; cls: string }> = {
  atendido: { label: 'Atendido pela IA', cls: 'bg-green-50 text-green-700' },
  shadow: { label: 'Rascunho (shadow)', cls: 'bg-blue-50 text-blue-700' },
  humano: { label: 'Para recepção', cls: 'bg-navy-50 text-navy-700' },
  pausado: { label: 'Pausado', cls: 'bg-navy-50 text-muted' },
  erro: { label: 'Erro', cls: 'bg-red-50 text-brand-red' },
};

/** Painel leve de monitoramento do rollout: contadores + últimos eventos. */
function MonitorAgente() {
  const [dados, setDados] = useState<{ porDesfecho: Record<string, number>; ultimos: EventoAgente[] } | null>(null);
  const [aberto, setAberto] = useState(false);

  async function carregar() {
    const res = await fetch('/api/agente/monitor');
    if (!res.ok) return;
    const j = await res.json();
    setDados(j.monitor);
  }
  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 10000);
    return () => clearInterval(id);
  }, []);

  const contadores = dados?.porDesfecho ?? {};
  const chaves = ['atendido', 'shadow', 'erro', 'pausado'];

  return (
    <div className="rounded-xl border border-navy-100 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-navy-900">Monitoramento (últimos 100 eventos)</span>
        <button type="button" className="text-xs font-semibold text-navy-700 hover:underline" onClick={() => setAberto((v) => !v)}>
          {aberto ? 'Ocultar detalhes' : 'Ver detalhes'}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {chaves.map((k) => (
          <span key={k} className={`badge ${DESFECHO_META[k]?.cls ?? 'bg-navy-50 text-navy-700'}`}>
            {DESFECHO_META[k]?.label ?? k}: <strong className="ml-1">{contadores[k] ?? 0}</strong>
          </span>
        ))}
      </div>
      {aberto && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-navy-100">
          {(dados?.ultimos ?? []).length === 0 ? (
            <div className="p-4 text-center text-xs text-muted">Nenhum evento registrado ainda.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-navy-50 text-muted">
                <tr>
                  <th className="p-2">Horário</th><th className="p-2">Número</th>
                  <th className="p-2">Desfecho</th><th className="p-2">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100/70">
                {(dados?.ultimos ?? []).map((e, i) => (
                  <tr key={i}>
                    <td className="p-2 text-muted">{e.ts.slice(5, 16).replace('T', ' ')}</td>
                    <td className="p-2 font-mono">{e.numero}</td>
                    <td className="p-2"><span className={`badge ${DESFECHO_META[e.desfecho]?.cls ?? ''}`}>{DESFECHO_META[e.desfecho]?.label ?? e.desfecho}</span></td>
                    <td className="p-2 text-muted">{e.erro ? `⚠️ ${e.erro}` : e.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted">
        Só são registrados eventos das leads que a IA <strong>tocou</strong> (atendidas, rascunhos, erros) — é a
        superfície de risco do teste. As leads que foram direto para a recepção seguem o fluxo normal da clínica.
      </p>
    </div>
  );
}

function ExameRow({ exame, editavel, onChange }: { exame: Exame; editavel: boolean; onChange: (p: ExameOverride) => void }) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
      <div>
        <div className="text-sm font-semibold text-ink">{exame.nome}</div>
        {editavel ? (
          <textarea
            className="input mt-2 min-h-[60px] text-xs"
            value={exame.preparo ?? ''}
            onChange={(e) => onChange({ preparo: e.target.value })}
            placeholder="Instruções de preparo"
          />
        ) : (
          exame.preparo && <div className="mt-1 text-xs text-muted">{exame.preparo}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {editavel ? (
          <>
            <input
              type="number"
              min={5}
              max={120}
              className="input w-20 text-center text-sm"
              value={exame.duracaoMin}
              onChange={(e) => onChange({ duracaoMin: Number(e.target.value) })}
            />
            <span className="text-xs text-muted">min</span>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={exame.ativo} onChange={(e) => onChange({ ativo: e.target.checked })} />
              Ativo
            </label>
          </>
        ) : (
          <span className="badge bg-brand-red/10 text-brand-red-600">{exame.duracaoMin} min</span>
        )}
      </div>
    </div>
  );
}

function Campo({ label, value, editavel, onChange }: { label: string; value: string; editavel: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="label">{label}</div>
      {editavel ? (
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className="text-sm font-semibold text-ink">{value}</div>
      )}
    </div>
  );
}
