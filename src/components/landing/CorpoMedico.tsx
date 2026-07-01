'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck } from 'lucide-react';
import { Reveal } from './Reveal';
import { doctors } from './content';

export function CorpoMedico() {
  const reduce = useReducedMotion();

  return (
    <section id="corpo-medico" className="scroll-mt-24 bg-canvas py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="pill mx-auto">Corpo médico</span>
          <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
            Especialistas em quem você pode confiar
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Cardiologistas dedicados, com formação sólida e escuta atenta a cada
            paciente.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d, i) => (
            <motion.article
              key={d.name}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="group overflow-hidden rounded-3xl border border-navyblue-100/70 bg-white shadow-card transition-shadow hover:shadow-lift"
            >
              <div className="relative overflow-hidden">
                <Image
                  src={d.photo}
                  alt={`Retrato de ${d.name}, ${d.role}`}
                  width={500}
                  height={560}
                  className="h-72 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-navyblue-900/30 to-transparent" />
              </div>
              <div className="p-6">
                <h3 className="flex items-center gap-1.5 text-lg font-bold text-navyblue-900">
                  {d.name}
                  <BadgeCheck className="h-4 w-4 text-info" aria-hidden />
                </h3>
                <p className="mt-1 text-sm font-medium text-cardio">{d.role}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {d.crm}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
