import { ChevronDown } from 'lucide-react';
import { Reveal } from './Reveal';
import { contato, faq } from './content';

// Server component: accordion nativo (<details>) — acessível por teclado,
// sem JavaScript e indexável. Inclui JSON-LD FAQPage para rich snippets.
export function Faq() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: f.resposta },
    })),
  };

  return (
    <section id="faq" className="scroll-mt-24 bg-canvas py-24 lg:py-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-4xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="pill mx-auto">Perguntas frequentes</span>
          <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
            Tire suas dúvidas antes de agendar
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Não encontrou sua resposta? Ligue para {contato.telefoneFixo} e
            fale com a nossa equipe.
          </p>
        </Reveal>

        <Reveal className="mt-12">
          <div className="space-y-3">
            {faq.map((f) => (
              <details
                key={f.pergunta}
                className="group rounded-2xl border border-navyblue-100/70 bg-white shadow-card open:ring-1 open:ring-navyblue-100"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[15px] font-semibold text-navyblue-900 [&::-webkit-details-marker]:hidden">
                  {f.pergunta}
                  <ChevronDown
                    className="h-5 w-5 flex-none text-navyblue-400 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="px-6 pb-5 text-[15px] leading-relaxed text-gray-600">
                  {f.resposta}
                </div>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
