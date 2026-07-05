'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { HeartPulse, Stethoscope, ShieldCheck, MessageCircle } from 'lucide-react';
import { metricas } from './content';

const icones = [HeartPulse, Stethoscope, ShieldCheck, MessageCircle];

/** contador que anima de 0 até o valor ao entrar na viewport */
function Contador({ valor, sufixo }: { valor: number; sufixo?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [atual, setAtual] = useState(reduce ? valor : 0);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        const inicio = performance.now();
        const dur = 1200;
        const tick = (t: number) => {
          const p = Math.min((t - inicio) / dur, 1);
          // ease-out cúbico
          setAtual(Math.round(valor * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [valor, reduce]);

  return (
    <span ref={ref}>
      {atual}
      {sufixo}
    </span>
  );
}

export function Numeros() {
  return (
    <section aria-label="Números da Cardiocentro" className="relative bg-navyblue-900 py-12">
      <div className="dotgrid pointer-events-none absolute inset-0 opacity-[0.08]" />
      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 lg:grid-cols-4 lg:px-8">
        {metricas.map((m, i) => {
          const Icone = icones[i % icones.length];
          return (
            <div key={m.rotulo} className="flex flex-col items-center text-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-cardio-400">
                <Icone className="h-5 w-5" aria-hidden />
              </span>
              <div className="mt-3 font-serif text-4xl font-bold tracking-tight text-white">
                <Contador valor={m.valor} sufixo={m.sufixo} />
              </div>
              <div className="mt-1 max-w-[12rem] text-sm text-white/60">{m.rotulo}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
