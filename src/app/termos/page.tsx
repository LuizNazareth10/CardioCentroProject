import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/landing/BrandLogo';
import { CONTATO } from '@/lib/seed-data';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Condições de uso do site e dos canais digitais da Cardiocentro.',
  alternates: { canonical: '/termos' },
};

export default function TermosPage() {
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
        <h1 className="font-serif text-4xl font-bold tracking-tight text-navyblue-900">Termos de Uso</h1>
        <p className="mt-3 text-sm text-gray-500">Última atualização: julho de 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-gray-700">
          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">1. Sobre este site</h2>
            <p className="mt-3">
              Este site é mantido pela <strong>Cardiocentro — Métodos Diagnósticos em Cardiologia</strong>{' '}
              ({CONTATO.enderecoCompleto}) e tem finalidade informativa e de facilitação de
              agendamentos. O uso do site implica concordância com estes termos.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">2. O site não substitui atendimento médico</h2>
            <p className="mt-3">
              As informações publicadas aqui — incluindo descrições de exames e respostas da
              assistente virtual no WhatsApp — têm caráter exclusivamente informativo e{' '}
              <strong>não constituem consulta, diagnóstico ou prescrição médica</strong>. Em caso
              de sintomas agudos, como dor no peito, falta de ar intensa ou desmaio, procure
              imediatamente um serviço de emergência ou ligue 192 (SAMU).
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">3. Agendamentos</h2>
            <p className="mt-3">
              As solicitações feitas pelo formulário ou pelo WhatsApp são um pedido de
              agendamento, confirmado pela nossa equipe conforme a disponibilidade da agenda.
              A realização de exames exige a apresentação do pedido médico no dia do
              atendimento. Cancelamentos e remarcações devem ser feitos pelo telefone{' '}
              {CONTATO.telefoneFixo}.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">4. Uso adequado</h2>
            <p className="mt-3">
              É vedado utilizar o site e os canais de atendimento para fins ilícitos, enviar
              conteúdo falso, ofensivo ou de terceiros sem autorização, ou tentar acessar áreas
              restritas sem credenciais válidas.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">5. Propriedade intelectual</h2>
            <p className="mt-3">
              A marca Cardiocentro, os textos, imagens e o layout deste site são protegidos por
              direitos de propriedade intelectual e não podem ser reproduzidos sem autorização.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">6. Privacidade</h2>
            <p className="mt-3">
              O tratamento de dados pessoais está descrito na nossa{' '}
              <Link href="/privacidade" className="font-semibold text-navyblue-700 underline">
                Política de Privacidade
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-navyblue-900">7. Contato</h2>
            <p className="mt-3">
              Dúvidas sobre estes termos: {CONTATO.email} · {CONTATO.telefoneFixo}.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-navyblue-100/60 bg-white py-8 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Cardiocentro — Métodos Diagnósticos em Cardiologia ·{' '}
        <Link href="/privacidade" className="underline hover:text-navyblue-700">Política de Privacidade</Link>
      </footer>
    </div>
  );
}
