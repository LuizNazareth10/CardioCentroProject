'use client';

import type { Paciente } from '@/lib/types';
import { montarFichaIdentidade, type ContextoFicha } from '@/lib/ficha-identidade';

/**
 * Versão para papel da ficha de identidade.
 *
 * NÃO tem lista de campos própria: renderiza exatamente as seções de
 * `montarFichaIdentidade`, as mesmas que a tela de edição usa. Campo novo na
 * ficha aparece aqui sem tocar neste arquivo — foi o que evitou a impressão
 * voltar a divergir da tela (ela imprimia "Médico solicitante", que não
 * existia na edição, e não imprimia as observações, que existiam).
 */
export function FichaIdentidadePrint({
  paciente,
  ...ctx
}: { paciente: Paciente } & ContextoFicha) {
  const secoes = montarFichaIdentidade(paciente, ctx);

  return (
    <div id="ficha-identidade-print" className="hidden print:block">
      <div className="mx-auto max-w-[210mm] p-8 text-[13px] text-black">
        <header className="flex items-center gap-4 border-b-2 border-navy-900 pb-4">
          <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full ring-1 ring-black/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/CardiocentroLogo.jpeg"
              alt=""
              width={52}
              height={52}
              className="h-full w-full object-cover object-center grayscale contrast-125 scale-[1.55]"
              aria-hidden
            />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-navy-900">Cardiocentro</h1>
            <p className="text-xs uppercase tracking-widest text-gray-600">Ficha de identidade do paciente</p>
          </div>
        </header>

        {secoes.map((secao) => (
          <section key={secao.titulo} className="mt-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-900">{secao.titulo}</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {secao.campos.map((c) => (
                <Campo key={c.chave} label={c.label} valor={c.valor} className={c.linhaInteira ? 'col-span-2' : ''} />
              ))}
            </dl>
          </section>
        ))}

        <footer className="mt-10 border-t border-gray-300 pt-4 text-xs text-gray-500">
          Documento gerado em {new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} ·
          Informações clínicas constam nas triagens de atendimento.
        </footer>
      </div>
    </div>
  );
}

function Campo({ label, valor, className = '' }: { label: string; valor?: string | null; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap border-b border-gray-200 pb-1 font-medium text-gray-900">
        {valor?.trim() || '—'}
      </dd>
    </div>
  );
}
