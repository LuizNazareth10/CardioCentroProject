'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONVENIOS } from '@/lib/seed-data';
import { DataPagina } from '@/components/DataPagina';
import {
  CAMPOS_EDITAVEIS,
  SECOES_FICHA,
  camposEditaveisDaSecao,
  corpoDoFormulario,
  valoresIniciais,
  type CampoEditavel,
  type ChaveEditavel,
} from '@/lib/ficha-identidade';

/**
 * Cadastro de paciente.
 *
 * Os campos são EXATAMENTE os da ficha de identidade (edição e impressão) —
 * a lista vem de lib/ficha-identidade.ts, não daqui. Antes esta tela pedia
 * fatores de risco e histórico clínico que nenhuma das outras telas mostrava;
 * o que é clínico agora é registrado nas triagens, a cada atendimento.
 */
export default function NovoPaciente() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState<Record<ChaveEditavel, string>>(() => valoresIniciais({}));

  const set = (chave: ChaveEditavel, v: string) => setDados((d) => ({ ...d, [chave]: v }));
  const faltando = CAMPOS_EDITAVEIS.filter((c) => c.obrigatorio && !dados[c.chave].trim());

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoDoFormulario(dados)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof json.erro === 'string' ? json.erro : 'Falha ao salvar.');
        return;
      }
      router.push(`/pacientes/${json.paciente.id}`);
    } catch {
      setErro('Falha ao conectar com o servidor.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="max-w-3xl">
      <h1 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Novo paciente</h1>
      <DataPagina />
      <p className="mt-1 text-sm text-muted">
        Ficha de identidade do paciente. Sinais vitais e sintomas são registrados nas triagens, a cada exame.
      </p>

      {SECOES_FICHA.map((secao) => {
        const campos = camposEditaveisDaSecao(secao.titulo);
        if (campos.length === 0) return null;
        return (
          <section key={secao.titulo} className="mt-4 card p-5">
            <h2 className="mb-4 font-bold text-navy-900">{secao.titulo}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {campos.map((campo) => (
                <Campo key={campo.chave} campo={campo} valor={dados[campo.chave]} onChange={set} />
              ))}
            </div>
          </section>
        );
      })}

      {erro && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-brand-red">{erro}</p>}
      <div className="mt-5 flex gap-2">
        <button className="btn-red" disabled={salvando || faltando.length > 0}>
          {salvando ? 'Salvando…' : 'Salvar ficha'}
        </button>
        <button type="button" className="btn-outline" onClick={() => router.back()}>Cancelar</button>
      </div>
    </form>
  );
}

function Campo({ campo, valor, onChange }: {
  campo: CampoEditavel;
  valor: string;
  onChange: (chave: ChaveEditavel, v: string) => void;
}) {
  const mudou = (v: string) => onChange(campo.chave, v);
  return (
    <div className={campo.linhaInteira ? 'sm:col-span-2' : ''}>
      <label className="label">{campo.label}{campo.obrigatorio ? ' *' : ''}</label>
      {campo.editor === 'textarea' ? (
        <textarea
          className="input min-h-[80px] resize-y"
          value={valor}
          placeholder={campo.placeholder}
          onChange={(e) => mudou(e.target.value)}
        />
      ) : campo.editor === 'sexo' ? (
        <select className="input" value={valor} onChange={(e) => mudou(e.target.value)}>
          <option value="">—</option>
          <option value="F">Feminino</option>
          <option value="M">Masculino</option>
          <option value="O">Outro</option>
        </select>
      ) : campo.editor === 'convenio' ? (
        <select className="input" value={valor} onChange={(e) => mudou(e.target.value)}>
          {CONVENIOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      ) : (
        <input
          className="input"
          type={campo.editor === 'data' ? 'date' : campo.editor === 'numero' ? 'number' : campo.editor === 'email' ? 'email' : campo.editor === 'telefone' ? 'tel' : 'text'}
          step={campo.chave === 'pesoKg' ? '0.1' : undefined}
          required={campo.obrigatorio}
          value={valor}
          placeholder={campo.placeholder}
          onChange={(e) => mudou(e.target.value)}
        />
      )}
    </div>
  );
}
