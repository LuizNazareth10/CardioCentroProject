import type { StatusAgendamento } from './types';

// Fonte única de rótulos/cores do status do agendamento — usada na agenda
// (bloco colorido) e na ficha do paciente (badge do histórico), para as
// duas telas ficarem sempre sincronizadas.
export const STATUS_AGENDAMENTO_LABEL: Record<StatusAgendamento, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  chegou: 'Chegou',
  em_atendimento: 'Em atendimento',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
  faltou: 'Faltou',
};

/** classe Tailwind `bg-*` usada no bloco sólido da agenda */
export const STATUS_AGENDAMENTO_COR: Record<StatusAgendamento, string> = {
  agendado: 'bg-navyblue',
  confirmado: 'bg-success',
  chegou: 'bg-danger',
  em_atendimento: 'bg-warning',
  realizado: 'bg-info',
  cancelado: 'bg-gray-400',
  faltou: 'bg-gray-600',
};

/** classes Tailwind de fundo claro + texto, usadas em badges */
export const STATUS_AGENDAMENTO_BADGE: Record<StatusAgendamento, string> = {
  agendado: 'bg-navy-50 text-navy-700',
  confirmado: 'bg-green-50 text-success',
  chegou: 'bg-red-50 text-danger',
  em_atendimento: 'bg-amber-50 text-warning',
  realizado: 'bg-blue-50 text-info',
  cancelado: 'bg-gray-100 text-gray-500',
  faltou: 'bg-gray-100 text-gray-600',
};
