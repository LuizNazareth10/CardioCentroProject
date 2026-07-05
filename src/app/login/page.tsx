'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogoLockup } from '@/components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, senha }),
      });
      if (res.ok) {
        // navegação completa garante que o cookie recém-criado seja enviado ao servidor
        window.location.href = '/dashboard';
        return;
      }
      const corpo = await res.json().catch(() => null);
      setErro(corpo?.erro ?? 'Falha ao entrar. Tente novamente.');
    } catch {
      setErro('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setCarregando(false);
    }
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
          <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight">
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
          <Link href="/" className="mb-6 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-navy-700">
            ← Voltar ao site
          </Link>
          <div className="lg:hidden mb-8"><LogoLockup /></div>
          <h2 className="font-serif text-3xl font-bold tracking-tight text-navy-900">Bem-vindo de volta</h2>
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
            <button type="submit" className="btn-primary w-full" disabled={carregando}>
              {carregando ? 'Entrando…' : 'Entrar'}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            Não tem acesso? Fale com a administração da clínica.
          </p>
        </form>
      </div>
    </div>
  );
}
