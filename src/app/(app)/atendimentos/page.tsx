'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Conversa, StatusAtendimento } from '@/lib/types';

const STATUS_META: Record<StatusAtendimento, { label: string; cls: string }> = {
  aguardando: { label: 'Aguardando', cls: 'bg-amber-50 text-amber-700' },
  em_atendimento: { label: 'Em atendimento', cls: 'bg-blue-50 text-blue-700' },
  resolvido: { label: 'Resolvido', cls: 'bg-green-50 text-green-700' },
};

export default function AtendimentosPage() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    const res = await fetch('/api/atendimentos');
    if (!res.ok) return;
    const json = await res.json();
    setConversas(json.conversas ?? []);
  }

  // polling leve (a fila muda quando chegam mensagens do WhatsApp)
  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 5000);
    return () => clearInterval(id);
  }, []);

  const conversa = useMemo(() => conversas.find((c) => c.telefone === sel) ?? null, [conversas, sel]);
  const aguardando = conversas.filter((c) => c.status === 'aguardando').length;

  async function acao(a: 'responder' | 'assumir' | 'resolver') {
    if (!conversa) return;
    setEnviando(true);
    await fetch(`/api/atendimentos/${encodeURIComponent(conversa.telefone)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: a, texto: a === 'responder' ? texto : undefined }),
    });
    if (a === 'responder') setTexto('');
    setEnviando(false);
    carregar();
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Atendimentos</h1>
          <p className="text-sm text-muted">
            Conversas do WhatsApp transferidas para a recepção
            {aguardando > 0 && <span className="ml-2 badge bg-amber-50 text-amber-700">{aguardando} aguardando</span>}
          </p>
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* fila */}
        <div className="card divide-y divide-navy-100/70 self-start">
          {conversas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">Nenhuma conversa na fila.</div>
          ) : (
            conversas.map((c) => {
              const ultima = c.mensagens[c.mensagens.length - 1];
              const meta = STATUS_META[c.status];
              return (
                <button
                  key={c.telefone}
                  onClick={() => setSel(c.telefone)}
                  className={`flex w-full flex-col items-start gap-1 p-4 text-left transition hover:bg-navy-50/50 ${sel === c.telefone ? 'bg-navy-50/70' : ''}`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{c.nome ?? c.telefone}</span>
                    <span className={`badge ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <span className="text-xs text-muted">{c.telefone}</span>
                  {ultima && <span className="line-clamp-1 text-xs text-muted">{ultima.texto}</span>}
                </button>
              );
            })
          )}
        </div>

        {/* conversa selecionada */}
        {conversa ? (
          <div className="card flex max-h-[70vh] flex-col p-0">
            <div className="flex items-center justify-between border-b border-navy-100 p-4">
              <div>
                <div className="text-sm font-bold text-navy-900">{conversa.nome ?? conversa.telefone}</div>
                <div className="text-xs text-muted">{conversa.telefone}</div>
              </div>
              <div className="flex gap-2">
                {conversa.status === 'aguardando' && (
                  <button className="btn-outline" disabled={enviando} onClick={() => acao('assumir')}>Assumir</button>
                )}
                {conversa.status !== 'resolvido' && (
                  <button className="btn-primary" disabled={enviando} onClick={() => acao('resolver')}>Marcar resolvido</button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {conversa.mensagens.map((m, i) => {
                const mine = m.de === 'recepcao';
                const isAgente = m.de === 'agente';
                // nota INTERNA: contexto do agente para a equipe, nunca foi
                // enviada ao paciente — destacada para não haver confusão.
                if (m.interna) {
                  return (
                    <div key={i} className="flex justify-center">
                      <div className="max-w-[92%] rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
                        <div className="mb-1 flex items-center gap-1 font-semibold uppercase tracking-wide text-amber-700">
                          🔒 Nota interna · não enviada ao paciente
                        </div>
                        <div className="whitespace-pre-wrap">{m.texto}</div>
                        <div className="mt-1 text-[10px] text-amber-700/70">{m.ts.slice(11, 16)}</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                        mine ? 'bg-navyblue text-white' : isAgente ? 'bg-navy-50 text-muted italic' : 'bg-white border border-navy-100 text-ink'
                      }`}
                    >
                      {m.texto}
                      <div className={`mt-0.5 text-[10px] ${mine ? 'text-white/60' : 'text-muted'}`}>
                        {m.de === 'recepcao' ? 'Recepção' : m.de === 'agente' ? 'Agente' : 'Paciente'} · {m.ts.slice(11, 16)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {conversa.status !== 'resolvido' ? (
              <form
                onSubmit={(e) => { e.preventDefault(); if (texto.trim()) acao('responder'); }}
                className="flex items-center gap-2 border-t border-navy-100 p-3"
              >
                <input
                  className="input flex-1"
                  placeholder="Responder ao paciente pelo WhatsApp…"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
                <button className="btn-red" disabled={enviando || !texto.trim()}>Enviar</button>
              </form>
            ) : (
              <div className="border-t border-navy-100 p-3 text-center text-xs text-muted">
                Atendimento resolvido — o assistente volta a responder este paciente automaticamente.
              </div>
            )}
          </div>
        ) : (
          <div className="card grid place-items-center p-10 text-center text-sm text-muted">
            Selecione uma conversa na fila para ver o histórico e responder.
          </div>
        )}
      </div>
    </div>
  );
}
