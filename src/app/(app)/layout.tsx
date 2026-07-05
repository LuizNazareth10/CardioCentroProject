import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Área da equipe',
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <Sidebar nome={sessao.nome} />
      <main className="wave-top flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-7">{children}</div>
      </main>
    </div>
  );
}
