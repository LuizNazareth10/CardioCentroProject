import { Activity, Gauge, FileText } from 'lucide-react';
import { Reveal } from './Reveal';
import { contato } from './content';

// Orientações de preparo dos exames — versão nativa (responsiva e acessível)
// do material impresso da clínica. Os dados espelham as orientações reais
// enviadas pela equipe (esforço físico e aparelhos MAPA/Holter).

const grupos = [
  {
    icon: Activity,
    titulo: 'Exames de esforço físico',
    subtitulo: 'Teste ergométrico e teste cardiopulmonar',
    passos: [
      'Venha com roupa confortável e adequada para atividade física.',
      'Mulheres: utilizar sutiã ou top esportivo.',
      'Homens: caso possuam pelos no peito, será necessário raspar a região para a fixação dos eletrodos.',
      'Não utilize hidratante, óleo corporal ou cremes no dia do exame.',
      'Mantenha o uso das medicações conforme a orientação do seu médico.',
      'Faça uma refeição leve cerca de 2 horas antes. Evite comparecer em jejum.',
    ],
  },
  {
    icon: Gauge,
    titulo: 'MAPA 24h e Holter 24h',
    subtitulo: 'Exames com aparelho por 24 horas',
    passos: [
      'Venha de banho tomado — durante o exame não é possível molhar o aparelho.',
      'Para o MAPA: traga a lista dos medicamentos que faz uso (ou os próprios medicamentos).',
      'Reserve um tempo maior para o atendimento: a instalação do aparelho é individualizada.',
      'O retorno para a retirada do aparelho acontece após 24 horas.',
    ],
  },
];

export function Preparo() {
  return (
    <section id="preparo" className="scroll-mt-24 bg-canvas py-24 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="pill mx-auto">Antes do exame</span>
          <h2 className="mt-5 font-serif text-4xl font-bold tracking-tight text-navyblue-900 sm:text-5xl">
            Como se preparar para o seu exame
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Siga as orientações abaixo conforme o exame que você vai realizar.
            Em caso de dúvida, nossa equipe está à disposição.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {grupos.map((g) => (
            <Reveal key={g.titulo}>
              <article className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-navyblue-100/70 bg-white shadow-card">
                {/* cabeçalho do card — faixa navy como no material impresso */}
                <div className="flex items-center gap-4 bg-navyblue-900 px-7 py-6 text-white">
                  <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white/10 text-cardio-400">
                    <g.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-serif text-xl font-bold leading-tight">{g.titulo}</h3>
                    <p className="mt-0.5 text-sm text-white/60">{g.subtitulo}</p>
                  </div>
                </div>

                <ol className="flex-1 space-y-4 px-7 py-7">
                  {g.passos.map((passo, i) => (
                    <li key={passo} className="flex gap-4">
                      <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-cardio/10 text-sm font-bold text-cardio">
                        {i + 1}
                      </span>
                      <span className="pt-0.5 text-[15px] leading-relaxed text-gray-700">{passo}</span>
                    </li>
                  ))}
                </ol>
              </article>
            </Reveal>
          ))}
        </div>

        {/* lembrete comum a todos os exames */}
        <Reveal className="mt-6">
          <div className="flex flex-col items-start gap-4 rounded-3xl border border-cardio/20 bg-cardio-50/50 p-6 sm:flex-row sm:items-center">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-cardio/10 text-cardio">
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-[15px] leading-relaxed text-navyblue-900">
              <strong>No dia do exame, traga sempre o pedido médico</strong> (em papel ou
              digital), um documento com foto e a carteirinha do convênio, se for utilizá-lo.
              Dúvidas sobre o preparo? Ligue para{' '}
              <a href={contato.telefoneLink} className="font-semibold text-cardio underline">
                {contato.telefoneFixo}
              </a>.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
