'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Reveal } from './Reveal';
import { doctors } from './content';

export function CorpoMedico() {
  const reduce = useReducedMotion();

  return (
    <section id="corpo-clinico" className="relative scroll-mt-24 overflow-hidden bg-navyblue py-24 text-white lg:py-28">
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
        <div className="dotgrid h-full w-full" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">
            Corpo Clínico
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Cardiologistas dedicados, com formação sólida e escuta atenta a cada paciente.
          </p>
        </Reveal>

        <div className="mx-auto mt-14 max-w-3xl">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-glass backdrop-blur-sm">
            <ul className="divide-y divide-white/10">
              {doctors.map((d, i) => (
                <motion.li
                  key={d.name}
                  initial={reduce ? false : { x: -12 }}
                  whileInView={{ x: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="group flex items-center gap-5 px-6 py-5 transition-colors hover:bg-white/[0.04] sm:px-8 sm:py-6"
                >
                  <span
                    className="grid h-2 w-2 flex-none rounded-full bg-cardio shadow-[0_0_12px_rgba(221,23,36,0.55)]"
                    aria-hidden
                  />
                  <span className="font-serif text-xl font-semibold tracking-tight text-white sm:text-2xl">
                    {d.name}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
