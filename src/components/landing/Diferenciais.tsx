'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Reveal } from './Reveal';
import { differentials, stats } from './content';

export function Diferenciais() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-navy-fade py-24 text-white lg:py-28">
      {/* auras e textura */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="aura absolute -left-20 top-0 h-80 w-80 rounded-full bg-cardio/40" />
        <div className="aura absolute right-0 bottom-0 h-80 w-80 rounded-full bg-navyblue-400/60" />
        <div className="dotgrid absolute inset-0 opacity-[0.15]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="pill mx-auto border-white/20 bg-white/10 text-white">
            Por que a Cardiocentro
          </span>
          <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight sm:text-5xl">
            Tecnologia de ponta, cuidado de verdade
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Reunimos o melhor da medicina diagnóstica com um atendimento que
            coloca você no centro.
          </p>
        </Reveal>

        {/* diferenciais em cards glass */}
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {differentials.map((d, i) => (
            <motion.div
              key={d.title}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="glass-dark rounded-3xl p-7"
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-cardio-400">
                <d.icon className="h-7 w-7" aria-hidden />
              </span>
              <h3 className="mt-6 text-xl font-bold">{d.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-white/70">{d.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* faixa de métricas */}
        <div className="mt-16 grid grid-cols-2 gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="text-center"
            >
              <s.icon className="mx-auto h-6 w-6 text-cardio-400" aria-hidden />
              <div className="mt-3 font-serif text-4xl font-bold">{s.value}</div>
              <div className="mt-1 text-xs font-medium text-white/60">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
