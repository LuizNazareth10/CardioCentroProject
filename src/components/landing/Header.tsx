'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, CalendarCheck, LogIn, MessageCircle } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { nav, whatsappLink } from './content';

const navLinkCls =
  'whitespace-nowrap text-[13px] font-semibold text-navyblue-700/90 transition-colors hover:text-cardio xl:text-sm';

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
      <div className="mx-auto flex max-w-[90rem] items-center gap-3 px-4 py-3.5 sm:px-5 lg:gap-4 lg:px-6 lg:py-4 xl:gap-6 xl:px-8">
        <Link href="/" className="shrink-0" aria-label="Cardiocentro — início">
          <BrandLogo tone="light" size={68} emphasis="header" />
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-x-5 lg:flex xl:gap-x-7"
          aria-label="Navegação principal"
        >
          {nav.map((item) => (
            <a key={item.href} href={item.href} className={navLinkCls}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex xl:gap-2.5">
          <Link href="/login" className="header-cta-ghost">
            <LogIn className="h-4 w-4 shrink-0" aria-hidden />
            Área da equipe
          </Link>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="header-cta-navy"
          >
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
            WhatsApp
          </a>
          <a href="#agendamento" className="header-cta-primary">
            <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden />
            Agendar agora
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full border border-navyblue-100 bg-white/80 text-navyblue-700 shadow-sm lg:hidden"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden">
          <div className="mx-4 mb-4 rounded-3xl border border-navyblue-100 bg-white p-5 shadow-lift">
            <nav className="flex flex-col gap-1" aria-label="Navegação mobile">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold text-navyblue-700 hover:bg-navyblue-50"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2.5">
              <Link
                href="/login"
                className="header-cta-ghost w-full"
                onClick={() => setOpen(false)}
              >
                <LogIn className="h-4 w-4 shrink-0" aria-hidden />
                Área da equipe
              </Link>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="header-cta-navy w-full"
                onClick={() => setOpen(false)}
              >
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                WhatsApp
              </a>
              <a
                href="#agendamento"
                className="header-cta-primary w-full"
                onClick={() => setOpen(false)}
              >
                <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden />
                Agendar agora
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
