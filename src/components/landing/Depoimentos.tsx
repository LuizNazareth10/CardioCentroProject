'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import { Reveal } from './Reveal';
import { testimonials } from './content';

export function Depoimentos() {
  const reduce = useReducedMotion();

  return (
    <section id="depoimentos" className="scroll-mt-24 bg-white py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="pill mx-auto">Depoimentos</span>
          <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
            Histórias de quem confia seu coração a nós
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex flex-col rounded-3xl border border-navyblue-100/70 bg-offwhite p-7 shadow-card"
            >
              <Quote className="h-9 w-9 text-cardio/20" aria-hidden />
              <div className="mt-2 flex text-warning">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="h-4 w-4 fill-current" aria-hidden />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-gray-700">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-navyblue-100/70 pt-5">
                <Image
                  src={t.avatar}
                  alt={`Foto de ${t.name}`}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-white"
                />
                <div>
                  <div className="text-sm font-bold text-navyblue-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
