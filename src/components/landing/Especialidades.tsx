'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from './Reveal';
import { services } from './content';

export function Especialidades() {
  const reduce = useReducedMotion();

  return (
    <section id="especialidades" className="scroll-mt-24 bg-canvas py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="pill mx-auto">Nossas especialidades</span>
          <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
            Exames e cuidados para cada batida
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Uma linha completa de métodos diagnósticos em cardiologia, conduzida
            por especialistas e apoiada por tecnologia de ponta.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <motion.article
              key={s.title}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={reduce ? undefined : { y: -6 }}
              className="group relative flex flex-col rounded-3xl border border-navyblue-100/70 bg-white p-7 shadow-card transition-shadow hover:shadow-lift"
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-navyblue-50 to-cardio-50 text-navyblue-700 transition-colors group-hover:from-cardio group-hover:to-cardio-600 group-hover:text-white">
                <s.icon className="h-7 w-7" aria-hidden />
              </span>
              <h3 className="mt-6 text-xl font-bold text-navyblue-900">{s.title}</h3>
              <p className="mt-2.5 flex-1 text-sm leading-relaxed text-gray-600">
                {s.desc}
              </p>
              <a
                href="#agendamento"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-cardio transition-colors hover:text-cardio-600"
              >
                Agendar
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </a>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
