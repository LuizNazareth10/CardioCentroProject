'use client';

import { useEffect, useState } from 'react';
import type { ClinicConfig, ExameOverride } from '@/lib/clinic-config';
import type { Exame } from '@/lib/types';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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
        <h2 className="mb-3 font-bold text-navy-900">Médicos</h2>
        <p className="mb-3 text-xs text-muted">Horários de atendimento — alteração sob demanda com suporte técnico.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {config.medicos.map((m) => (
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
