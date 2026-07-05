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
        <Reveal direction="right" className="relative">
          <div className="grid grid-cols-2 gap-4">
            <div className="group relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-navyblue-100/80">
              <Image
                src={photos.about}
                alt="Ambiente interno da clínica Cardiocentro"
                fill
                sizes="(max-width: 640px) 45vw, 280px"
                className="object-cover object-center transition duration-700 group-hover:scale-[1.03]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navyblue-900/25 via-transparent to-transparent" />
            </div>
            <div className="group relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-navyblue-100/80">
              <Image
                src={photos.aboutSecondary}
                alt="Fachada da clínica Cardiocentro em Juiz de Fora"
                fill
                sizes="(max-width: 640px) 45vw, 280px"
                className="object-cover object-[center_35%] transition duration-700 group-hover:scale-[1.03]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navyblue-900/30 via-navyblue-900/5 to-transparent" />
            </div>
          </div>
        </Reveal>

        <Reveal direction="left">
          <span className="pill">A clínica</span>
          <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
            Referência em diagnóstico cardiológico
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            No Centro de Juiz de Fora, a Cardiocentro reúne a linha completa de
            métodos diagnósticos em cardiologia — do eletrocardiograma ao teste
            cardiopulmonar — com médicos especialistas e atendimento a particular
            e a mais de 20 convênios. Cada exame é conduzido com atenção aos
            detalhes e respeito à sua história — porque por trás de cada coração
            existe uma vida inteira.
          </p>

          <ul className="mt-8 space-y-4">
            {pillars.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-cardio/10 text-cardio">
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
