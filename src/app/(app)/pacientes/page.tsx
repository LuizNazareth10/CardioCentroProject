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

  useEffect(() => {
    const id = setTimeout(async () => {
      setCarregando(true);
      const res = await fetch(`/api/pacientes?q=${encodeURIComponent(q)}`);
      setPacientes((await res.json()).pacientes ?? []);
      setCarregando(false);
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  const conv = (id?: string) => CONVENIOS.find((c) => c.id === id)?.nome ?? 'Particular';

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Pacientes</h1>
        <Link href="/pacientes/novo" className="btn-red">+ Novo paciente</Link>
      </header>

      <div className="mt-5">
        <input className="input max-w-md" placeholder="Buscar por nome, CPF ou telefone…"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

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
    </div>
  );
}
