'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Lead, StatusLead, TemperaturaLead } from '@/lib/types';

// =============================================================
// Painel de Leads (CRM básico).
// Reúne contatos do formulário da landing page e do WhatsApp,
// com temperatura (🔥/🌡️/❄️), status de follow-up e exportação CSV.
// =============================================================

const TEMPERATURAS: Array<{ id: TemperaturaLead; rotulo: string; emoji: string; cor: string }> = [
  { id: 'quente', rotulo: 'Quentes', emoji: '🔥', cor: 'bg-red-50 text-red-700' },
  { id: 'morno', rotulo: 'Mornos', emoji: '🌡️', cor: 'bg-amber-50 text-amber-700' },
  { id: 'frio', rotulo: 'Frios', emoji: '❄️', cor: 'bg-sky-50 text-sky-700' },
];

const STATUS: Array<{ id: StatusLead; rotulo: string; cor: string }> = [
  { id: 'novo', rotulo: 'Novo', cor: 'bg-navy-50 text-navy-700' },
  { id: 'contatado', rotulo: 'Contatado', cor: 'bg-blue-50 text-blue-700' },
  { id: 'agendado', rotulo: 'Agendado', cor: 'bg-green-50 text-green-700' },
  { id: 'arquivado', rotulo: 'Arquivado', cor: 'bg-gray-100 text-gray-500' },
];

const ORIGENS: Record<string, string> = {
  formulario: 'Formulário do site',
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
};

const TURNOS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', indiferente: 'Sem preferência' };

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function linkWhats(telefone: string): string {
  const dig = telefone.replace(/\D/g, '');
  return `https://wa.me/${dig.length <= 11 ? '55' + dig : dig}`;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('ativos');
  const [filtroTemp, setFiltroTemp] = useState<string>('todas');
  const [busca, setBusca] = useState('');

  async function carregar() {
    const res = await fetch('/api/leads');
    if (res.ok) {
      const j = await res.json();
      setLeads(j.leads ?? []);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function patch(id: string, dados: Partial<Pick<Lead, 'status' | 'temperatura'>>) {
    // atualização otimista
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...dados } : l)));
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...dados }),
    });
  }

  const filtrados = useMemo(() => {
    let arr = leads;
    if (filtroStatus === 'ativos') arr = arr.filter((l) => l.status !== 'arquivado');
    else if (filtroStatus !== 'todos') arr = arr.filter((l) => l.status === filtroStatus);
    if (filtroTemp !== 'todas') arr = arr.filter((l) => l.temperatura === filtroTemp);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter(
        (l) => l.nome.toLowerCase().includes(q) || l.telefone.includes(busca) || (l.exameInteresse ?? '').toLowerCase().includes(q),
      );
    }
    return arr;
  }, [leads, filtroStatus, filtroTemp, busca]);

  const contagem = useMemo(() => {
    const ativos = leads.filter((l) => l.status !== 'arquivado');
    return {
      quente: ativos.filter((l) => l.temperatura === 'quente').length,
      morno: ativos.filter((l) => l.temperatura === 'morno').length,
      frio: ativos.filter((l) => l.temperatura === 'frio').length,
    };
  }, [leads]);

  function exportarCsv() {
    const cab = ['Nome', 'Telefone', 'E-mail', 'Exame de interesse', 'Origem', 'Status', 'Temperatura', 'Data preferencial', 'Turno', 'Mensagem', 'Criado em'];
    const linhas = filtrados.map((l) => [
      l.nome, l.telefone, l.email ?? '', l.exameInteresse ?? '', ORIGENS[l.origem] ?? l.origem,
      l.status, l.temperatura, l.dataPreferencial ?? '', l.turnoPreferencial ? TURNOS[l.turnoPreferencial] : '',
      (l.mensagem ?? '').replace(/\r?\n/g, ' '), l.criadoEm,
    ]);
    const csv = [cab, ...linhas]
      .map((linha) => linha.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    // BOM para o Excel abrir acentos corretamente
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-cardiocentro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (carregando) {
    return <div className="card p-8 text-center text-sm text-muted">Carregando leads…</div>;
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Leads</h1>
          <p className="text-sm text-muted">
            Contatos do formulário do site e do WhatsApp — faça o follow-up e não perca nenhum paciente.
          </p>
        </div>
        <button type="button" className="btn-outline" onClick={exportarCsv}>
          Exportar CSV ({filtrados.length})
        </button>
      </header>

      {/* contadores por temperatura */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {TEMPERATURAS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFiltroTemp(filtroTemp === t.id ? 'todas' : t.id)}
            className={`card p-5 text-left transition ${filtroTemp === t.id ? 'ring-2 ring-navyblue/40' : ''}`}
          >
            <div className="text-3xl font-extrabold text-navy-700">
              {t.emoji} {contagem[t.id]}
            </div>
            <div className="mt-1 text-sm text-muted">{t.rotulo}</div>
          </button>
        ))}
      </div>

      {/* filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Buscar por nome, telefone ou exame…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select className="input w-auto" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="ativos">Ativos (sem arquivados)</option>
          <option value="todos">Todos</option>
          {STATUS.map((s) => (
            <option key={s.id} value={s.id}>{s.rotulo}</option>
          ))}
        </select>
        {filtroTemp !== 'todas' && (
          <button type="button" className="btn-ghost text-xs" onClick={() => setFiltroTemp('todas')}>
            Limpar filtro de temperatura ✕
          </button>
        )}
      </div>

      {/* lista */}
      {filtrados.length === 0 ? (
        <div className="mt-6 card p-10 text-center text-sm text-muted">
          Nenhum lead encontrado com esses filtros.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {filtrados.map((l) => {
            const st = STATUS.find((s) => s.id === l.status)!;
            const temp = TEMPERATURAS.find((t) => t.id === l.temperatura)!;
            return (
              <div key={l.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-ink">{l.nome}</span>
                      <span className={`badge ${temp.cor}`}>{temp.emoji} {l.temperatura}</span>
                      <span className={`badge ${st.cor}`}>{st.rotulo}</span>
                      <span className="badge bg-navy-50 text-navy-700">{ORIGENS[l.origem] ?? l.origem}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {l.telefone}
                      {l.email && <> · {l.email}</>}
                      {l.exameInteresse && <> · <strong className="text-navy-700">{l.exameInteresse}</strong></>}
                      {' '}· {fmtDataHora(l.criadoEm)}
                    </div>
                    {(l.dataPreferencial || l.turnoPreferencial) && (
                      <div className="mt-1 text-xs text-muted">
                        Preferência:{' '}
                        {l.dataPreferencial && <strong className="text-ink">{l.dataPreferencial.split('-').reverse().join('/')}</strong>}
                        {l.dataPreferencial && l.turnoPreferencial ? ' · ' : ''}
                        {l.turnoPreferencial && TURNOS[l.turnoPreferencial]}
                      </div>
                    )}
                    {l.mensagem && <p className="mt-2 text-sm text-gray-600">“{l.mensagem}”</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={linkWhats(l.telefone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline px-3 py-1.5 text-xs"
                    >
                      Abrir WhatsApp
                    </a>
                    {l.status === 'novo' && (
                      <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => patch(l.id, { status: 'contatado' })}>
                        Marcar contatado
                      </button>
                    )}
                    {l.status !== 'agendado' && l.status !== 'arquivado' && (
                      <button
                        type="button"
                        className="btn-red px-3 py-1.5 text-xs"
                        onClick={() => patch(l.id, { status: 'agendado', temperatura: 'quente' })}
                      >
                        Agendou ✓
                      </button>
                    )}
                    {l.status !== 'arquivado' ? (
                      <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => patch(l.id, { status: 'arquivado' })}>
                        Arquivar
                      </button>
                    ) : (
                      <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => patch(l.id, { status: 'novo' })}>
                        Restaurar
                      </button>
                    )}
                    <select
                      className="input w-auto px-2 py-1.5 text-xs"
                      value={l.temperatura}
                      onChange={(e) => patch(l.id, { temperatura: e.target.value as TemperaturaLead })}
                      aria-label={`Temperatura do lead ${l.nome}`}
                    >
                      <option value="quente">🔥 Quente</option>
                      <option value="morno">🌡️ Morno</option>
                      <option value="frio">❄️ Frio</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
