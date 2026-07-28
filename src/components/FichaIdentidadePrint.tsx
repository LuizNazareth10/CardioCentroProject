'use client';

import type { Agendamento, Paciente } from '@/lib/types';
import { fmtData, idade } from '@/lib/format';

export function FichaIdentidadePrint({
  paciente,
  convenio,
  medicoSolicitante,
  medicoExecutante,
  exameRecente,
}: {
  paciente: Paciente;
  convenio: string;
  medicoSolicitante: string;
  medicoExecutante: string;
  exameRecente?: ExameMaisRecente | null;
}) {
  const fm = paciente.fichaMedica;
  const sexo =
    paciente.sexo === 'F' ? 'Feminino' : paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'O' ? 'Outro' : '—';

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

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-900">Dados pessoais</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Campo label="Nome completo" valor={paciente.nome} className="col-span-2" />
            <Campo label="Data de nascimento" valor={paciente.dataNascimento ? fmtData(paciente.dataNascimento + 'T12:00') : undefined} />
            <Campo label="Identidade / CPF" valor={paciente.cpf} />
            <Campo label="Idade" valor={idade(paciente.dataNascimento)} />
            <Campo label="Sexo" valor={sexo} />
            <Campo label="Telefone" valor={paciente.telefone} />
            <Campo label="E-mail" valor={paciente.email} />
            <Campo label="Endereço completo" valor={paciente.endereco} className="col-span-2" />
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-900">Cadastro e convênio</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Campo label="Data de cadastro" valor={fmtData(paciente.criadoEm)} />
            <Campo label="Convênio" valor={convenio} />
            <Campo label="Carteirinha" valor={paciente.carteirinha} />
            <Campo label="Médico solicitante" valor={medicoSolicitante} />
            <Campo label="Médico executante" valor={medicoExecutante} />
            <Campo
              label={exameRecente?.futuro ? 'Próximo exame agendado' : 'Último exame realizado'}
              valor={exameRecente ? `${exameRecente.nome} — ${fmtData(exameRecente.quando)}` : undefined}
              className="col-span-2"
            />
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-900">Antropometria</h2>
          <dl className="grid grid-cols-3 gap-x-6 gap-y-3">
            <Campo label="Peso" valor={fm.pesoKg ? `${fm.pesoKg} kg` : undefined} />
            <Campo label="Altura" valor={fm.alturaCm ? `${fm.alturaCm} cm` : undefined} />
            <Campo label="Registro nº" valor={paciente.id} />
          </dl>
        </section>

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
      <dd className="mt-0.5 border-b border-gray-200 pb-1 font-medium text-gray-900">{valor?.trim() || '—'}</dd>
    </div>
  );
}

/** Médico do atendimento mais recente já ocorrido (solicitante / histórico). */
export function medicoUltimaConsulta(historico: Agendamento[], nomeMedico: (id: string) => string): string {
  const agora = Date.now();
  const consultas = historico
    .filter((h) => h.status !== 'cancelado' && !['mapa', 'holter'].includes(h.medicoId) && new Date(h.inicio).getTime() < agora)
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  if (consultas.length === 0) {
    const qualquer = historico
      .filter((h) => h.status !== 'cancelado' && !['mapa', 'holter'].includes(h.medicoId))
      .sort((a, b) => b.inicio.localeCompare(a.inicio));
    if (qualquer.length === 0) return '—';
    return nomeMedico(qualquer[0].medicoId);
  }
  return nomeMedico(consultas[0].medicoId);
}

/** Médico do próximo agendamento futuro (quem vai executar o exame). */
export function medicoExecutanteFuturo(historico: Agendamento[], nomeMedico: (id: string) => string): string {
  const agora = Date.now();
  const futuros = historico
    .filter(
      (h) =>
        h.status !== 'cancelado' &&
        h.status !== 'faltou' &&
        !['mapa', 'holter'].includes(h.medicoId) &&
        new Date(h.inicio).getTime() >= agora,
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (futuros.length === 0) return '—';
  return nomeMedico(futuros[0].medicoId);
}

export interface ExameMaisRecente {
  nome: string;
  quando: string;
  futuro: boolean;
  medicoId?: string;
}

/**
 * Prefere o próximo exame agendado (futuro); se não houver, o último realizado.
 */
export function exameMaisRecente(
  historico: Agendamento[],
  nomeExame: (id: string) => string,
  agoraISO: string = new Date().toISOString(),
): ExameMaisRecente | null {
  const agoraMs = new Date(agoraISO).getTime();
  const validos = historico.filter((h) => h.status !== 'cancelado' && h.status !== 'faltou');
  const futuros = validos
    .filter((h) => new Date(h.inicio).getTime() >= agoraMs)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (futuros.length > 0) {
    return {
      nome: nomeExame(futuros[0].exameId),
      quando: futuros[0].inicio,
      futuro: true,
      medicoId: futuros[0].medicoId,
    };
  }
  const passados = validos
    .filter((h) => new Date(h.inicio).getTime() < agoraMs)
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  if (passados.length > 0) {
    return {
      nome: nomeExame(passados[0].exameId),
      quando: passados[0].inicio,
      futuro: false,
      medicoId: passados[0].medicoId,
    };
  }
  return null;
}
