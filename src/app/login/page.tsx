'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogoLockup } from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@cardiocentro.com');
  const [senha, setSenha] = useState('cardio123');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    setCarregando(false);
    if (res.ok) router.push('/dashboard');
    else setErro((await res.json()).erro ?? 'Falha ao entrar.');
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* painel da marca */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-navy-700 p-12 text-white">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="rounded-2xl bg-white/95 px-4 py-3"><LogoLockup /></div>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold leading-tight">
            Agenda inteligente para<br />sua clínica de cardiologia.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Agendamentos, fichas médicas e triagens em um só lugar — rápido,
            sem conflito de horários e integrado ao WhatsApp.
          </p>
          <div className="mt-8 flex gap-2">
            <span className="h-2.5 w-10 rounded-full bg-brand-red" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
          </div>
        </div>
        <div className="relative z-10 text-sm text-white/50">CardioCentro · Juiz de Fora — MG</div>
      </div>

      {/* formulário */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={entrar} className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><LogoLockup /></div>
          <h2 className="text-2xl font-bold text-navy-900">Bem-vindo de volta</h2>
          <p className="mt-1 text-sm text-muted">Acesso restrito à equipe da clínica.</p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input className="input" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Senha</label>
              <input className="input" type="password" value={senha}
                onChange={(e) => setSenha(e.target.value)} required />
            </div>
            {erro && <p className="text-sm font-medium text-brand-red">{erro}</p>}
            <button className="btn-primary w-full" disabled={carregando}>
              {carregando ? 'Entrando…' : 'Entrar'}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            Acesso demo: <strong>admin@cardiocentro.com</strong> / <strong>cardio123</strong>
          </p>
        </form>
      </div>
    </div>
  );
}
