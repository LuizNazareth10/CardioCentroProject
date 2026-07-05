'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from './Logo';

const links = [
  { href: '/dashboard', label: 'Painel', icon: 'grid' },
  { href: '/agenda', label: 'Agenda', icon: 'calendar' },
  { href: '/agendar', label: 'Novo agendamento', icon: 'plus' },
  { href: '/pacientes', label: 'Pacientes', icon: 'user' },
  { href: '/leads', label: 'Leads', icon: 'target' },
  { href: '/atendimentos', label: 'Atendimentos', icon: 'chat' },
  { href: '/metricas', label: 'Métricas', icon: 'chart' },
  { href: '/simulador', label: 'Simulador WhatsApp', icon: 'phone' },
  { href: '/configuracoes', label: 'Configurações', icon: 'gear' },
];

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
    plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
    chat: <><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    chart: <><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></>,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export function Sidebar({ nome }: { nome: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-navy-100/70 bg-white/70 px-4 py-6 backdrop-blur-sm">
      <div className="flex items-center gap-2.5 px-2 pb-7">
        <Logo size={36} />
        <div className="leading-tight">
          <div className="font-serif text-[17px] font-bold tracking-tight text-navy-900">
            Cardio<span className="text-brand-red">centro</span>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Área da equipe</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5">
        {links.map((l) => {
          const ativo = pathname === l.href || pathname.startsWith(l.href + '/');
          return (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200
                ${ativo
                  ? 'bg-navyblue text-white shadow-soft'
                  : 'text-ink/70 hover:-translate-y-0.5 hover:bg-navy-50 hover:text-navy-900'}`}>
              <Icon name={l.icon} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 rounded-2xl border border-navy-100/70 bg-white/70 p-4 shadow-card">
        <div className="text-xs font-semibold text-navy-900">{nome}</div>
        <button onClick={sair} className="mt-2 text-xs font-semibold text-brand-red hover:underline">
          Sair
        </button>
      </div>
    </aside>
  );
}
