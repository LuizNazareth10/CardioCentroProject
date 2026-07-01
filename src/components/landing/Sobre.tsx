'use client';

import Image from 'next/image';
import { Check } from 'lucide-react';
import { Reveal } from './Reveal';
import { photos } from './content';

const pillars = [
  'Equipamentos de última geração e ambiente acolhedor',
  'Laudos assinados por cardiologistas experientes',
  'Atendimento humanizado, do agendamento ao acompanhamento',
];

export function Sobre() {
  return (
    <section id="sobre" className="scroll-mt-24 bg-white py-24 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-8">
        {/* imagens */}
        <Reveal direction="right" className="relative">
          <div className="overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-navyblue-100">
            <Image
              src={photos.about}
              alt="Equipe médica da Cardiocentro em ambiente clínico"
              width={720}
              height={800}
              className="h-[440px] w-full object-cover sm:h-[540px]"
            />
          </div>
          <div className="glass absolute -bottom-6 right-4 hidden w-56 rounded-2xl p-5 shadow-glass sm:block">
            <div className="font-serif text-3xl font-bold text-cardio">+25 anos</div>
            <p className="mt-1 text-sm text-gray-600">
              dedicados exclusivamente à saúde do coração dos mineiros.
            </p>
          </div>
        </Reveal>

        {/* texto */}
        <Reveal direction="left">
          <span className="pill">A clínica</span>
          <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
            Um centro de referência feito de gente que cuida
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Desde a nossa fundação, unimos precisão diagnóstica e cuidado humano.
            Cada exame na Cardiocentro é conduzido com atenção aos detalhes e
            respeito à sua história — porque por trás de cada coração existe uma
            vida inteira.
          </p>

          <ul className="mt-8 space-y-4">
            {pillars.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-success/15 text-success">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-[15px] text-gray-700">{p}</span>
              </li>
            ))}
          </ul>

          <div className="mt-9">
            <a href="#corpo-medico" className="cta-navy">
              Conheça nosso corpo médico
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
