'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from './Reveal';
import { brandAssets, services } from './content';

export function Especialidades() {
  const reduce = useReducedMotion();

  return (
    <section id="especialidades" className="scroll-mt-24 bg-canvas py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="pill mx-auto">Nossos exames</span>
          <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
            Métodos diagnósticos em cardiologia
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            A Cardiocentro oferece uma linha completa de exames cardiológicos,
            conduzidos por médicos especialistas.
          </p>
        </Reveal>

        <div className="mt-16 grid items-start gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14">
          <Reveal direction="right" className="lg:sticky lg:top-28">
            <div className="overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-navyblue-100/80">
              <Image
                src={brandAssets.examesList}
                alt="Lista oficial de exames da Cardiocentro: consulta cardiológica, ECG, risco cirúrgico, ecocardiograma, duplex de carótidas, teste ergométrico, teste cardiopulmonar, Holter 24h e MAPA 24h"
                width={720}
                height={1280}
                className="h-auto w-full"
                priority={false}
              />
            </div>
            <p className="mt-4 text-center text-xs text-gray-500 lg:text-left">
              Material oficial da Cardiocentro — Juiz de Fora, MG
            </p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((s, i) => (
              <motion.article
                key={s.title}
                initial={reduce ? false : { y: 18 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.55, delay: (i % 2) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                whileHover={reduce ? undefined : { y: -4 }}
                className="group relative flex gap-4 rounded-2xl border border-navyblue-100/70 bg-white p-5 shadow-card transition-shadow hover:shadow-lift"
              >
                <span className="mt-0.5 grid h-11 w-11 flex-none place-items-center rounded-xl bg-gradient-to-br from-navyblue-50 to-cardio-50 text-navyblue-700 transition-colors group-hover:from-cardio group-hover:to-cardio-600 group-hover:text-white">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-bold leading-snug text-navyblue-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{s.desc}</p>
                  {s.bookable && (
                    <a
                      href="#agendamento"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cardio transition-colors hover:text-cardio-600"
                    >
                      Agendar
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                    </a>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
