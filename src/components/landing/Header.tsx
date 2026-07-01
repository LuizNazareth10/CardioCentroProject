'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, CalendarCheck, LogIn, MessageCircle } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { nav, whatsappLink } from './content';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'header-glass shadow-soft' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-3.5 lg:px-8">
        <Link href="/" aria-label="Cardiocentro — início">
          <BrandLogo tone="light" size={38} />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Navegação principal">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-navyblue-700/90 transition-colors hover:text-cardio"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className="cta-ghost">
            <LogIn className="h-4 w-4" aria-hidden />
            Área da equipe
          </Link>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-navy"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            WhatsApp
          </a>
          <a href="#agendamento" className="cta-primary">
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Agendar consulta
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-11 w-11 place-items-center rounded-full border border-navyblue-100 bg-white/70 text-navyblue-700 lg:hidden"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* menu mobile */}
      {open && (
        <div className="lg:hidden">
          <div className="mx-4 mb-4 rounded-3xl border border-navyblue-100 bg-white p-5 shadow-lift">
            <nav className="flex flex-col gap-1" aria-label="Navegação mobile">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-navyblue-700 hover:bg-navyblue-50"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/login" className="cta-ghost w-full" onClick={() => setOpen(false)}>
                <LogIn className="h-4 w-4" aria-hidden />
                Área da equipe
              </Link>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-navy w-full"
                onClick={() => setOpen(false)}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                WhatsApp
              </a>
              <a href="#agendamento" className="cta-primary w-full" onClick={() => setOpen(false)}>
                <CalendarCheck className="h-4 w-4" aria-hidden />
                Agendar consulta
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
