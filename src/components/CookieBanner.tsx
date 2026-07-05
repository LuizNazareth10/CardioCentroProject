'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// =============================================================
// Banner de cookies (LGPD) — opt-in para analytics.
// Sem consentimento, NENHUM script de medição é carregado.
// O Google Analytics só é injetado se NEXT_PUBLIC_GA_ID existir
// E o visitante aceitar. A escolha fica em localStorage.
// =============================================================

const CHAVE = 'cc-consent'; // 'accepted' | 'rejected'
const ROTAS_INTERNAS = [
  '/dashboard', '/agenda', '/agendar', '/pacientes', '/atendimentos',
  '/simulador', '/configuracoes', '/login',
];

function carregarAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id || document.getElementById('ga-script')) return;
  const s = document.createElement('script');
  s.id = 'ga-script';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  const inline = document.createElement('script');
  inline.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${id}', { anonymize_ip: true });
  `;
  document.head.appendChild(inline);
}

export function CookieBanner() {
  const pathname = usePathname();
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const escolha = localStorage.getItem(CHAVE);
    if (escolha === 'accepted') carregarAnalytics();
    else if (!escolha) setVisivel(true);
  }, []);

  // área restrita/login não exibem o banner (uso interno da equipe)
  if (ROTAS_INTERNAS.some((r) => pathname?.startsWith(r))) return null;
  if (!visivel) return null;

  function decidir(aceita: boolean) {
    localStorage.setItem(CHAVE, aceita ? 'accepted' : 'rejected');
    setVisivel(false);
    if (aceita) carregarAnalytics();
  }

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-navyblue-100 bg-white p-5 shadow-lift sm:inset-x-6"
    >
      <p className="text-sm leading-relaxed text-gray-700">
        Usamos cookies essenciais para o funcionamento do site e, com a sua
        permissão, cookies de medição de audiência para melhorar sua experiência.
        Saiba mais na nossa{' '}
        <Link href="/privacidade" className="font-semibold text-navyblue-700 underline">
          Política de Privacidade
        </Link>.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button type="button" onClick={() => decidir(true)} className="cta-primary px-5 py-2.5 text-sm">
          Aceitar cookies
        </button>
        <button type="button" onClick={() => decidir(false)} className="cta-ghost px-5 py-2.5 text-sm">
          Somente essenciais
        </button>
      </div>
    </div>
  );
}
