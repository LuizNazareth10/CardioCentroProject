'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONVENIOS } from '@/lib/seed-data';

const FATORES: Array<{ key: string; label: string }> = [
  { key: 'hipertensao', label: 'Hipertensão (HAS)' },
  { key: 'diabetes', label: 'Diabetes (DM)' },
  { key: 'dislipidemia', label: 'Dislipidemia' },
  { key: 'tabagismo', label: 'Tabagismo' },
  { key: 'etilismo', label: 'Etilismo' },
  { key: 'sedentarismo', label: 'Sedentarismo' },
  { key: 'iamPrevio', label: 'IAM prévio' },
  { key: 'avcPrevio', label: 'AVC prévio' },
  { key: 'doencaRenal', label: 'Doença renal' },
  { key: 'marcapasso', label: 'Marca-passo' },
  { key: 'histFamiliarDac', label: 'Hist. familiar de DAC' },
  { key: 'histFamiliarMorteSubita', label: 'Hist. familiar de morte súbita' },
];

export default function NovoPaciente() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [f, setF] = useState<Record<string, boolean>>({});
  const [dados, setDados] = useState<Record<string, string>>({ convenioId: 'particular' });

  const set = (k: string, v: string) => setDados((d) => ({ ...d, [k]: v }));
  const toggle = (k: string) => setF((x) => ({ ...x, [k]: !x[k] }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setSalvando(true);
    const ficha: Record<string, unknown> = { ...FATORES.reduce((a, x) => ({ ...a, [x.key]: !!f[x.key] }), {}) };
    ['pesoKg', 'alturaCm'].forEach((k) => { if (dados[k]) ficha[k] = Number(dados[k]); });
    ['medicacoesEmUso', 'alergias', 'cirurgiasPrevias', 'queixaPrincipal', 'observacoesGerais'].forEach((k) => {
      if (dados[k]) ficha[k] = dados[k];
    });

    const body = {
      nome: dados.nome, cpf: dados.cpf, dataNascimento: dados.dataNascimento || undefined,
      sexo: dados.sexo || undefined, telefone: dados.telefone, email: dados.email || undefined,
      endereco: dados.endereco || undefined, convenioId: dados.convenioId,
      carteirinha: dados.carteirinha || undefined, fichaMedica: ficha,
    };
    const res = await fetch('/api/pacientes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setSalvando(false);
    if (res.ok) router.push(`/pacientes/${(await res.json()).paciente.id}`);
    else setErro((await res.json()).erro ?? 'Falha ao salvar.');
  }

  return (
    <form onSubmit={salvar} className="max-w-3xl">
      <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Novo paciente</h1>
      <p className="text-sm text-muted">Ficha médica inicial — padrão cardiologia.</p>

      <section className="mt-5 card p-5">
        <h2 className="mb-4 font-bold text-navy-900">Dados pessoais</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome completo *" span><input className="input" required value={dados.nome ?? ''} onChange={(e) => set('nome', e.target.value)} /></Campo>
          <Campo label="Telefone / WhatsApp *"><input className="input" required value={dados.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} placeholder="(32) 9 ..." /></Campo>
          <Campo label="CPF"><input className="input" value={dados.cpf ?? ''} onChange={(e) => set('cpf', e.target.value)} /></Campo>
          <Campo label="Data de nascimento"><input type="date" className="input" value={dados.dataNascimento ?? ''} onChange={(e) => set('dataNascimento', e.target.value)} /></Campo>
          <Campo label="Sexo">
            <select className="input" value={dados.sexo ?? ''} onChange={(e) => set('sexo', e.target.value)}>
              <option value="">—</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="O">Outro</option>
            </select>
          </Campo>
          <Campo label="E-mail"><input type="email" className="input" value={dados.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Campo>
          <Campo label="Endereço" span><input className="input" value={dados.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} /></Campo>
          <Campo label="Convênio">
            <select className="input" value={dados.convenioId} onChange={(e) => set('convenioId', e.target.value)}>
              {CONVENIOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Nº da carteirinha"><input className="input" value={dados.carteirinha ?? ''} onChange={(e) => set('carteirinha', e.target.value)} /></Campo>
        </div>
      </section>

      <section className="mt-4 card p-5">
        <h2 className="mb-4 font-bold text-navy-900">Antecedentes e fatores de risco</h2>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {FATORES.map((x) => (
            <label key={x.key} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${f[x.key] ? 'border-brand-red bg-brand-red/5 text-navy-900' : 'border-navy-100 text-ink/80'}`}>
              <input type="checkbox" className="accent-brand-red" checked={!!f[x.key]} onChange={() => toggle(x.key)} />
              {x.label}
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo label="Peso (kg)"><input type="number" step="0.1" className="input" value={dados.pesoKg ?? ''} onChange={(e) => set('pesoKg', e.target.value)} /></Campo>
          <Campo label="Altura (cm)"><input type="number" className="input" value={dados.alturaCm ?? ''} onChange={(e) => set('alturaCm', e.target.value)} /></Campo>
        </div>
      </section>

      <section className="mt-4 card p-5">
        <h2 className="mb-4 font-bold text-navy-900">Histórico clínico</h2>
        <div className="space-y-4">
          <Campo label="Queixa principal"><textarea className="input min-h-[60px]" value={dados.queixaPrincipal ?? ''} onChange={(e) => set('queixaPrincipal', e.target.value)} /></Campo>
          <Campo label="Medicações em uso"><textarea className="input min-h-[60px]" value={dados.medicacoesEmUso ?? ''} onChange={(e) => set('medicacoesEmUso', e.target.value)} /></Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Alergias"><input className="input" value={dados.alergias ?? ''} onChange={(e) => set('alergias', e.target.value)} /></Campo>
            <Campo label="Cirurgias prévias"><input className="input" value={dados.cirurgiasPrevias ?? ''} onChange={(e) => set('cirurgiasPrevias', e.target.value)} /></Campo>
          </div>
          <Campo label="Observações gerais"><textarea className="input min-h-[60px]" value={dados.observacoesGerais ?? ''} onChange={(e) => set('observacoesGerais', e.target.value)} /></Campo>
        </div>
      </section>

      {erro && <p className="mt-4 text-sm font-medium text-brand-red">{erro}</p>}
      <div className="mt-5 flex gap-2">
        <button className="btn-red" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar ficha'}</button>
        <button type="button" className="btn-outline" onClick={() => router.back()}>Cancelar</button>
      </div>
    </form>
  );
}

function Campo({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return <div className={span ? 'sm:col-span-2' : ''}><label className="label">{label}</label>{children}</div>;
}
