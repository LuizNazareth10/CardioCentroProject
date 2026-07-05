'use client';

import { MessageCircle } from 'lucide-react';
import { whatsappLink } from './content';

/**
 * Botão flutuante de WhatsApp — sempre visível (desktop e mobile),
 * com anel de pulso sutil (desativado automaticamente para quem
 * prefere menos movimento, via prefers-reduced-motion no CSS global).
 */
export function FloatingWhatsApp() {
  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Agendar pelo WhatsApp — abre conversa em nova aba"
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 sm:bottom-7 sm:right-7"
    >
      <span className="pointer-events-none hidden rounded-full bg-navyblue-900 px-4 py-2 text-sm font-semibold text-white opacity-0 shadow-soft transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:block">
        Falar pelo WhatsApp
      </span>
      <span className="relative grid h-14 w-14 place-items-center">
        <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-40 animate-pulse-ring" aria-hidden />
        <span className="relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lift transition-transform duration-200 group-hover:scale-105">
          <MessageCircle className="h-7 w-7" aria-hidden />
        </span>
      </span>
    </a>
  );
}
