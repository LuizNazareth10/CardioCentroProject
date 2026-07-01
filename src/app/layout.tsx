import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

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

export const metadata: Metadata = {
  metadataBase: new URL('https://cardiocentro.com.br'),
  title: {
    default: 'Cardiocentro — Métodos Diagnósticos em Cardiologia',
    template: '%s · Cardiocentro',
  },
  description:
    'Cuidado cardiológico humano e de alta precisão em Juiz de Fora. Diagnóstico avançado, corpo médico especializado e agendamento simples.',
  keywords: ['cardiologia', 'cardiocentro', 'Juiz de Fora', 'ecocardiograma', 'holter', 'consulta cardiológica'],
  openGraph: {
    title: 'Cardiocentro — Métodos Diagnósticos em Cardiologia',
    description:
      'Cuidado cardiológico humano e de alta precisão em Juiz de Fora.',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
