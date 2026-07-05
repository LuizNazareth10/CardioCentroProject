import type { Metadata, Viewport } from 'next';
import { Inter, Nunito, Playfair_Display } from 'next/font/google';
import './globals.css';
import '@/lib/env'; // valida variáveis de ambiente no boot do servidor
import { CookieBanner } from '@/components/CookieBanner';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-playfair',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
});

const SITE_URL = process.env.APP_BASE_URL ?? 'https://cardiocentrojf.com.br';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Cardiocentro — Métodos Diagnósticos em Cardiologia em Juiz de Fora',
    template: '%s · Cardiocentro',
  },
  description:
    'Exames cardiológicos completos em Juiz de Fora: ecocardiograma, Holter 24h, MAPA, teste ergométrico e cardiopulmonar. Corpo médico especializado, mais de 20 convênios e agendamento pelo WhatsApp.',
  keywords: [
    'cardiologia juiz de fora',
    'ecocardiograma juiz de fora',
    'holter 24h juiz de fora',
    'mapa 24h juiz de fora',
    'teste ergométrico juiz de fora',
    'clínica cardiológica jf',
    'cardiocentro',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Cardiocentro — Métodos Diagnósticos em Cardiologia em Juiz de Fora',
    description:
      'Centro especializado em diagnóstico cardiológico em Juiz de Fora há mais de 45 anos: ecocardiograma, Holter 24h, MAPA, teste ergométrico e mais, com corpo médico especializado.',
    url: '/',
    siteName: 'Cardiocentro',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: '/img/hero-cardio.jpg',
        alt: 'Cardiocentro — clínica de métodos diagnósticos em cardiologia em Juiz de Fora',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cardiocentro — Cardiologia em Juiz de Fora',
    description:
      'Centro especializado em diagnóstico cardiológico em Juiz de Fora, com mais de 45 anos de tradição.',
    images: ['/img/hero-cardio.jpg'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#05132E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable} ${nunito.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
