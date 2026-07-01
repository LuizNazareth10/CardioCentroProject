import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { Especialidades } from '@/components/landing/Especialidades';
import { Sobre } from '@/components/landing/Sobre';
import { CorpoMedico } from '@/components/landing/CorpoMedico';
import { Diferenciais } from '@/components/landing/Diferenciais';
import { Depoimentos } from '@/components/landing/Depoimentos';
import { Agendamento } from '@/components/landing/Agendamento';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-navyblue-900 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" className="bg-canvas">
        <Hero />
        <Especialidades />
        <Sobre />
        <CorpoMedico />
        <Diferenciais />
        <Depoimentos />
        <Agendamento />
      </main>
      <Footer />
    </>
  );
}
