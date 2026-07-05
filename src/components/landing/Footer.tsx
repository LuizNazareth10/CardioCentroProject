import Link from 'next/link';
import { Phone, Mail, MapPin, ShieldCheck, MessageCircle } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { nav, contato, whatsappLink } from './content';

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-navyblue-900 text-white/70">
      <div className="dotgrid pointer-events-none absolute inset-0 opacity-[0.08]" />
      <div className="relative mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <BrandLogo tone="dark" size={40} />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">
              Centro especializado em diagnóstico cardiológico em Juiz de Fora,
              com mais de 45 anos de tradição.
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href={contato.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram da Cardiocentro"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-cardio"
              >
                <InstagramIcon className="h-5 w-5 text-white" aria-hidden />
              </a>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp da Cardiocentro"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-cardio"
              >
                <MessageCircle className="h-5 w-5 text-white" aria-hidden />
              </a>
            </div>
          </div>

          <nav aria-label="Navegação do rodapé">
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">Navegação</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {nav.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="transition-colors hover:text-cardio-400">{item.label}</a>
                </li>
              ))}
              <li>
                <Link href="/login" className="transition-colors hover:text-cardio-400">Área da equipe</Link>
              </li>
            </ul>
          </nav>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">Contato</h3>
            <ul className="mt-5 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 flex-none text-cardio-400" aria-hidden />
                {contato.enderecoCompleto}
              </li>
              <li>
                <a href={contato.telefoneLink} className="flex items-center gap-2.5 transition-colors hover:text-cardio-400">
                  <Phone className="h-4 w-4 flex-none text-cardio-400" aria-hidden />
                  {contato.telefoneFixo}
                </a>
              </li>
              <li>
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 transition-colors hover:text-cardio-400">
                  <MessageCircle className="h-4 w-4 flex-none text-cardio-400" aria-hidden />
                  WhatsApp: {contato.whatsapp} ({contato.whatsappDescricao})
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 flex-none text-cardio-400" aria-hidden />
                {contato.email}
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">Confiança</h3>
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <ShieldCheck className="h-5 w-5 flex-none text-success" aria-hidden />
                Corpo clínico registrado no CRM-MG
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <ShieldCheck className="h-5 w-5 flex-none text-success" aria-hidden />
                Conformidade com a LGPD
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} Cardiocentro — Métodos Diagnósticos em Cardiologia Ltda. Todos os direitos reservados.</p>
          <nav aria-label="Links legais" className="flex items-center gap-4">
            <Link href="/privacidade" className="transition-colors hover:text-cardio-400">
              Política de Privacidade
            </Link>
            <Link href="/termos" className="transition-colors hover:text-cardio-400">
              Termos de Uso
            </Link>
          </nav>
          <p>Juiz de Fora · Minas Gerais</p>
        </div>
      </div>
    </footer>
  );
}
