'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Paciente } from '@/lib/types';
import { CONVENIOS } from '@/lib/seed-data';
import { idade, iniciais } from '@/lib/format';

export default function PacientesPage() {
  const [q, setQ] = useState('');
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState('');

  // Busca (e recarga ao limpar) — sempre começa da 1ª página. O `controlador`
  // descarta respostas fora de ordem quando o usuário digita rápido.
  // try/finally garante que o spinner SEMPRE termina, mesmo se a API falhar
  // (antes, um erro deixava a tela presa em "Carregando…" para sempre).
  useEffect(() => {
    const controlador = { atual: true };
    const id = setTimeout(async () => {
      setCarregando(true);
      setErro('');
      try {
        const res = await fetch(`/api/pacientes?q=${encodeURIComponent(q)}`);
        const json = await res.json().catch(() => ({}));
        if (!controlador.atual) return;
        if (!res.ok) throw new Error(json.erro || `Falha ao buscar (HTTP ${res.status}).`);
        setPacientes(json.pacientes ?? []);
        setCursor(json.proximoCursor ?? null);
      } catch (e) {
        if (!controlador.atual) return;
        setPacientes([]);
        setCursor(null);
        setErro(e instanceof Error ? e.message : 'Falha ao carregar pacientes.');
      } finally {
        if (controlador.atual) setCarregando(false);
      }
    }, 250);
    return () => { controlador.atual = false; clearTimeout(id); };
  }, [q]);

  async function carregarMais() {
    if (!cursor || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const res = await fetch(`/api/pacientes?q=${encodeURIComponent(q)}&cursor=${encodeURIComponent(cursor)}`);
      const json = await res.json().catch(() => ({}));
      setPacientes((atual) => [...atual, ...(json.pacientes ?? [])]);
      setCursor(json.proximoCursor ?? null);
    } finally {
      setCarregandoMais(false);
    }
  }

  const conv = (id?: string) => CONVENIOS.find((c) => c.id === id)?.nome ?? 'Particular';
  const buscaNumerica = /^\s*\d/.test(q);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Pacientes</h1>
        <Link href="/pacientes/novo" className="btn-red">+ Novo paciente</Link>
      </header>

      <div className="mt-5">
        <input className="input max-w-md" placeholder="Buscar por nome (início), CPF ou telefone…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        {q && !buscaNumerica && (
          <p className="mt-1.5 text-xs text-muted">
            A busca por nome é pelo começo do nome (ex.: “ana”, “josé s”). Para telefone ou CPF, digite os números.
          </p>
        )}
      </div>

      {erro && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-brand-red">{erro}</p>
      )}

      <div className="mt-5 card divide-y divide-navy-100/70">
        {carregando ? (
          <div className="p-8 text-center text-sm text-muted">Carregando…</div>
        ) : pacientes.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">Nenhum paciente encontrado.</div>
        ) : (
          pacientes.map((p) => (
            <Link key={p.id} href={`/pacientes/${p.id}`}
              className="flex items-center gap-4 p-4 hover:bg-navy-50/50">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-700 text-sm font-bold text-white">
                {iniciais(p.nome)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">{p.nome}</div>
                <div className="text-xs text-muted">{p.telefone} · {idade(p.dataNascimento)}</div>
              </div>
              <span className="badge bg-navy-50 text-navy-700">{conv(p.convenioId)}</span>
            </Link>
          ))
        )}
      </div>

      {!carregando && cursor && (
        <div className="mt-4 text-center">
          <button className="btn-outline" disabled={carregandoMais} onClick={carregarMais}>
            {carregandoMais ? 'Carregando…' : 'Carregar mais'}
          </button>
        </div>
      )}
    </div>
  );
}
