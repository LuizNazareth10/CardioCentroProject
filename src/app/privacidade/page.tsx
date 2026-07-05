import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/landing/BrandLogo';
import { CONTATO } from '@/lib/seed-data';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Como a Cardiocentro coleta, usa e protege seus dados pessoais, em conformidade com a LGPD (Lei nº 13.709/2018).',
  alternates: { canonical: '/privacidade' },
};

export default function PrivacidadePage() {
  return (
    <div className="bg-canvas min-h-screen">
      <header className="border-b border-navyblue-100/60 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" aria-label="Cardiocentro — início">
            <BrandLogo tone="light" size={44} />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navyblue-700 hover:text-cardio">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar ao site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-14 lg:px-8">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-navyblue-900">
          Política de Privacidade
        </h1>
        <p className="mt-3 text-sm text-gray-500">Última atualização: julho de 2026</p>

        <div className="prose-cardio mt-10 space-y-8 text-[15px] leading-relaxed text-gray-700">
          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">1. Quem somos</h2>
            <p className="mt-3">
              A <strong>Cardiocentro — Métodos Diagnósticos em Cardiologia</strong>, localizada na{' '}
              {CONTATO.enderecoCompleto}, é a controladora dos dados pessoais tratados por meio
              deste site e dos nossos canais de atendimento (telefone e WhatsApp), nos termos da
              Lei Geral de Proteção de Dados — LGPD (Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">2. Quais dados coletamos</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Formulário de agendamento:</strong> nome, telefone, e-mail (opcional),
                exame de interesse, datas e turnos preferenciais e a mensagem que você escrever.
              </li>
              <li>
                <strong>Atendimento pelo WhatsApp:</strong> número de telefone, nome informado,
                convênio, exames solicitados e o conteúdo das mensagens trocadas — incluindo
                fotos de pedidos médicos que você optar por enviar.
              </li>
              <li>
                <strong>Dados de agendamento e ficha clínica:</strong> quando você se torna
                paciente, registramos os dados cadastrais e clínicos necessários à realização
                dos exames, que são dados sensíveis tratados sob sigilo profissional.
              </li>
              <li>
                <strong>Cookies:</strong> utilizamos apenas cookies essenciais ao funcionamento
                do site. Cookies de medição de audiência (analytics) são carregados somente com
                o seu consentimento, dado no aviso de cookies.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">3. Para que usamos os dados</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Entrar em contato para confirmar, remarcar ou orientar sobre agendamentos;</li>
              <li>Realizar os exames e emitir os respectivos laudos (tutela da saúde, art. 11, II, "f" da LGPD);</li>
              <li>Cumprir obrigações legais e regulatórias aplicáveis a serviços de saúde;</li>
              <li>Melhorar nosso atendimento e a experiência de navegação no site (com consentimento, quando exigido).</li>
            </ul>
            <p className="mt-3">
              <strong>Não vendemos nem compartilhamos seus dados para fins de marketing de terceiros.</strong>
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">4. Com quem compartilhamos</h2>
            <p className="mt-3">
              Seus dados podem ser compartilhados apenas com: (i) operadores de tecnologia que
              hospedam nossos sistemas (servidores de aplicação e banco de dados em nuvem, com
              contratos de confidencialidade); (ii) a plataforma WhatsApp/Meta, quando você opta
              por esse canal de atendimento; (iii) seu convênio ou operadora de saúde, quando
              necessário ao faturamento do exame; e (iv) autoridades, mediante obrigação legal.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">5. Por quanto tempo guardamos</h2>
            <p className="mt-3">
              Dados de contato de quem não se torna paciente são mantidos pelo tempo necessário
              ao atendimento da solicitação. Prontuários e registros clínicos seguem os prazos
              mínimos de guarda exigidos pela legislação e pelas normas do Conselho Federal de
              Medicina.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">6. Seus direitos</h2>
            <p className="mt-3">
              Você pode solicitar, a qualquer momento: confirmação do tratamento, acesso,
              correção, anonimização, portabilidade, informação sobre compartilhamentos,
              revogação de consentimento e eliminação de dados tratados com base em
              consentimento. Para exercer seus direitos, fale conosco pelos canais abaixo.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">7. Segurança</h2>
            <p className="mt-3">
              Adotamos medidas técnicas e administrativas para proteger seus dados: acesso à
              área interna restrito por autenticação, comunicação criptografada (HTTPS), banco
              de dados com acesso bloqueado ao público e registro de acesso limitado à equipe
              autorizada.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">8. Contato do encarregado (DPO)</h2>
            <p className="mt-3">
              Dúvidas ou solicitações sobre dados pessoais: {CONTATO.email} · {CONTATO.telefoneFixo} ·{' '}
              {CONTATO.enderecoCompleto}.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">9. Alterações desta política</h2>
            <p className="mt-3">
              Esta política pode ser atualizada para refletir mudanças legais ou operacionais.
              A versão vigente estará sempre disponível nesta página.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-navyblue-100/60 bg-white py-8 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Cardiocentro — Métodos Diagnósticos em Cardiologia ·{' '}
        <Link href="/termos" className="underline hover:text-navyblue-700">Termos de Uso</Link>
      </footer>
    </div>
  );
}
