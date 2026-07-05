'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarCheck, HeartPulse, MessageCircle } from 'lucide-react';
import { photos, whatsappLink } from './content';

export function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { y: 22 },
          animate: { y: 0 },
          transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section className="relative overflow-hidden bg-canvas pt-36 pb-20 lg:pt-44 lg:pb-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="aura absolute -left-24 top-10 h-72 w-72 rounded-full bg-navyblue-400/40" />
        <div className="aura absolute right-0 top-40 h-80 w-80 rounded-full bg-cardio/30" />
        <div className="dotgrid absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div>
          <motion.div {...rise(0)}>
            <span className="pill">
              <HeartPulse className="h-3.5 w-3.5 text-cardio" aria-hidden />
              Tradição em cardiologia · Juiz de Fora — MG
            </span>
          </motion.div>

          <motion.h1
            {...rise(0.08)}
            className="mt-6 font-serif text-[2.6rem] font-bold leading-[1.05] tracking-tight text-navyblue-900 sm:text-5xl lg:text-display"
          >
            Centro especializado em{' '}
            <span className="text-gradient">diagnóstico cardiológico</span>.
          </motion.h1>

          <motion.p
            {...rise(0.16)}
            className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600"
          >
            Há mais de 45 anos oferecendo exames com qualidade e precisão em
            Juiz de Fora.
          </motion.p>

          <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#agendamento" className="cta-primary text-base">
              <CalendarCheck className="h-5 w-5" aria-hidden />
              Quero agendar meu exame
            </a>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-navy text-base"
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
              Agendar pelo WhatsApp
            </a>
          </motion.div>
        </div>

        <motion.div
          {...(reduce
            ? {}
            : {
                initial: { scale: 0.98, y: 20 },
                animate: { scale: 1, y: 0 },
                transition: { duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] },
              })}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <div className="relative overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-navyblue-100/80">
            <Image
              src={photos.hero}
              alt="Estetoscópio e equipamento de aferição de pressão arterial em atendimento cardiológico"
              width={720}
              height={860}
              priority
              className="h-[420px] w-full object-cover object-center sm:h-[520px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navyblue-900/50 via-navyblue-900/5 to-transparent" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
