'use client';

import { useEffect } from 'react';
import { HeartCrack } from 'lucide-react';

// Error Boundary global — captura erros de renderização/dados e
// oferece recuperação sem derrubar a página inteira.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // log no console do navegador/servidor; integrar Sentry aqui no futuro
    console.error('[erro global]', error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-cardio/10 text-cardio">
          <HeartCrack className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="mt-6 font-serif text-3xl font-bold tracking-tight text-navyblue-900">
          Algo não saiu como esperado
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Ocorreu um erro inesperado. Tente novamente — se o problema persistir,
          fale conosco pelo telefone (32) 3215-8744.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="cta-primary">
            Tentar novamente
          </button>
          <a href="/" className="cta-ghost">
            Ir para o início
          </a>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-gray-400">Código do erro: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
