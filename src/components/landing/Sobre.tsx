'use client';

import Image from 'next/image';
import { Reveal } from './Reveal';
import { photos } from './content';

export function Sobre() {
  return (
    <section id="sobre" className="scroll-mt-24 bg-white py-24 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-8">
        <Reveal direction="right" className="relative">
          <div className="grid grid-cols-2 gap-4">
            <div className="group relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-navyblue-100/80">
              <Image
                src={photos.about}
                alt="Recepção da clínica Cardiocentro em Juiz de Fora"
                fill
                sizes="(max-width: 640px) 45vw, 280px"
                className="object-cover object-center transition duration-700 group-hover:scale-[1.03]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navyblue-900/25 via-transparent to-transparent" />
            </div>
            <div className="group relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-navyblue-100/80">
              <Image
                src={photos.aboutSecondary}
                alt="Sala de espera confortável da clínica Cardiocentro"
                fill
                sizes="(max-width: 640px) 45vw, 280px"
                className="object-cover object-center transition duration-700 group-hover:scale-[1.03]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navyblue-900/30 via-navyblue-900/5 to-transparent" />
            </div>
          </div>
        </Reveal>

        <Reveal direction="left">
          <span className="pill">A clínica</span>
          <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
            Tradição em diagnóstico cardiológico
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Fundada em 1979 pelo cardiologista{' '}
            <span className="font-semibold text-cardio">Dr. Cyro Augusto Espíndola</span>,
            a Cardiocentro nasceu com o compromisso de oferecer um atendimento
            cardiológico de excelência, baseado na ética e na confiança. Ao longo
            de sua trajetória, a clínica consolidou-se como referência em saúde
            cardiovascular, unindo tradição e experiência para proporcionar um
            diagnóstico preciso, sempre com o propósito de promover mais
            qualidade de vida e bem-estar aos seus pacientes.
          </p>

          <div className="mt-9">
            <a href="#corpo-clinico" className="cta-navy">
              Conheça nosso corpo clínico
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
