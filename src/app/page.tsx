import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/auth';

export default async function Home() {
  const sessao = await lerSessao();
  redirect(sessao ? '/dashboard' : '/login');
}
