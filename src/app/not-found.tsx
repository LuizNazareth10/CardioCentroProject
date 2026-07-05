import Link from 'next/link';
import { HeartPulse } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-navyblue-50 text-navyblue-700">
          <HeartPulse className="h-8 w-8" aria-hidden />
        </span>
        <p className="mt-6 font-serif text-6xl font-bold text-navyblue-900">404</p>
        <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight text-navyblue-900">
          Página não encontrada
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          O endereço que você acessou não existe ou foi movido. Que tal voltar
          para a página inicial e agendar seu exame?
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="cta-primary">
            Ir para o início
          </Link>
          <Link href="/#agendamento" className="cta-ghost">
            Agendar exame
          </Link>
        </div>
      </div>
    </div>
  );
}
