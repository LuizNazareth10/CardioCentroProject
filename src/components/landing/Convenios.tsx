import { BadgeCheck } from 'lucide-react';
import { Reveal } from './Reveal';
import { conveniosAceitos } from './content';

export function Convenios() {
  return (
    <section id="convenios" className="scroll-mt-24 bg-white py-24 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="pill mx-auto">Convênios</span>
          <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
            Atendemos particular e os principais convênios
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Confira abaixo os convênios aceitos. Ficou na dúvida sobre o seu?
            Fale com a equipe pelo WhatsApp que confirmamos na hora.
          </p>
        </Reveal>

        <Reveal className="mt-12">
          <ul className="flex flex-wrap justify-center gap-2.5" aria-label="Lista de convênios aceitos">
            {conveniosAceitos.map((nome) => (
              <li
                key={nome}
                className="inline-flex items-center gap-1.5 rounded-full border border-navyblue-100/80 bg-offwhite px-4 py-2 text-sm font-semibold text-navyblue-700"
              >
                <BadgeCheck className="h-4 w-4 text-success" aria-hidden />
                {nome}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
