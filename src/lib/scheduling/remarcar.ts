// =============================================================
// REMARCAÇÃO — motor ÚNICO, usado pelos dois canais:
//   • área restrita  → POST /api/agendamentos/remarcar (clique na agenda)
//   • agente WhatsApp → src/lib/whatsapp/agent.ts (paciente pede outro horário)
//
// Um só lugar para a validação de conflito e para a regra de sessão, senão
// os dois canais divergiriam com o tempo.
//
// DECISÕES DE PRODUTO codificadas aqui:
//  1. O registro é MOVIDO, não duplicado — o histórico do paciente continua
//     com UM agendamento (com `inicioAnterior`/`remarcadoEm` como rastro).
//  2. Exames marcados JUNTOS (mesmo `grupoId`) andam juntos: a sessão inteira
//     desliza pelo mesmo intervalo, preservando a sequência e o intervalo
//     entre eles. Remarcar um eco que foi marcado colado num ergométrico e
//     deixar o outro para trás quebraria a sessão.
//  3. Remarcar volta o status para "agendado": a presença confirmada valia
//     para a data antiga, e o lembrete precisa ser reenviado para a nova.
// =============================================================

import { APARELHOS, EXAMES, MEDICOS } from '../seed-data';
import {
  atualizarAgendamento,
  listarAgendamentosDoGrupo,
  listarAgendamentosDoMedico,
  obterAgendamento,
} from '../db';
import type { Agendamento, TipoAparelho } from '../types';
import { duracaoDoMedico } from './engine';

/** posição exata já calculada pelo motor de horários (agente do WhatsApp) */
export interface ColocacaoExplicita {
  exameId: string;
  medicoId: string;
  inicio: string;
  fim: string;
}

export interface ItemRemarcado {
  id: string;
  exameId: string;
  medicoId: string;
  /** novo início (ISO com offset -03:00) */
  inicio: string;
  /** novo fim (ISO) */
  fim: string;
  /** início que o registro tinha antes desta remarcação */
  inicioAnterior: string;
}

export interface PlanoRemarcacao {
  itens: ItemRemarcado[];
  /** true quando move uma sessão de vários exames marcados juntos */
  sessao: boolean;
  /** o agendamento que foi clicado/escolhido (âncora do deslocamento) */
  ancora: Agendamento;
}

export type ResultadoPlano =
  | { ok: true; plano: PlanoRemarcacao }
  | { ok: false; erro: string };

function hojeJF(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Desloca um ISO em `deltaMin` minutos, devolvendo ISO no fuso da clínica. */
function deslocarIso(iso: string, deltaMin: number): string {
  const d = new Date(new Date(iso).getTime() + deltaMin * 60_000);
  const data = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const hora = d.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false });
  return `${data}T${hora}-03:00`;
}

function minutosEntre(de: string, ate: string): number {
  return Math.round((new Date(ate).getTime() - new Date(de).getTime()) / 60_000);
}

function aparelhoDoExame(exameId: string): TipoAparelho | undefined {
  return EXAMES.find((e) => e.id === exameId)?.aparelho;
}

/**
 * Monta (sem gravar) o plano de remarcação de um agendamento para `alvo`,
 * já validando conflito. Separar plano/aplicação deixa a UI mostrar ao
 * usuário exatamente o que vai acontecer antes de confirmar.
 *
 * Dois modos de colocação, conforme quem chama:
 *
 *  • `alvo.colocacoes` — o chamador JÁ calculou as posições pelo motor de
 *    horários (é o caso do agente do WhatsApp, que oferece slots livres). Usa
 *    exatamente aquelas posições, o que respeita a janela e a duração do
 *    médico que vai atender. Preferível sempre que existir.
 *
 *  • deslocamento — a recepção clicou num ponto da grade. A sessão inteira
 *    desliza pelo mesmo intervalo, preservando a sequência. A duração é
 *    recalculada quando o exame muda de médico (médicos têm durações
 *    diferentes para o mesmo exame).
 *
 * `alvo.medicoId` só é respeitado quando o agendamento está SOZINHO: numa
 * sessão de vários exames cada item mantém o seu próprio prestador (trocar
 * todos para um único médico poderia cair fora dos exames que ele realiza).
 */
export async function planejarRemarcacao(
  agendamentoId: string,
  alvo: { inicio: string; medicoId?: string; colocacoes?: ColocacaoExplicita[] },
): Promise<ResultadoPlano> {
  const ancora = await obterAgendamento(agendamentoId);
  if (!ancora) return { ok: false, erro: 'Agendamento não encontrado.' };
  if (ancora.status === 'cancelado') return { ok: false, erro: 'Agendamento cancelado não pode ser remarcado.' };
  if (ancora.status === 'realizado') return { ok: false, erro: 'Atendimento já finalizado não pode ser remarcado.' };

  if (alvo.inicio.slice(0, 10) < hojeJF()) {
    return { ok: false, erro: 'Não é possível remarcar para uma data no passado.' };
  }

  const grupo = ancora.grupoId ? await listarAgendamentosDoGrupo(ancora.grupoId) : [ancora];
  const membros = grupo.filter((a) => a.status !== 'cancelado');
  // grupo pode ter sido esvaziado por cancelamentos individuais
  const movendo = membros.length ? membros : [ancora];
  const sessao = movendo.length > 1;

  const delta = minutosEntre(ancora.inicio, alvo.inicio);
  if (delta === 0 && (!alvo.medicoId || alvo.medicoId === ancora.medicoId) && !alvo.colocacoes) {
    return { ok: false, erro: 'Este já é o horário do agendamento.' };
  }

  const itens = alvo.colocacoes
    ? porColocacaoExplicita(movendo, alvo.colocacoes)
    : porDeslocamento(movendo, delta, sessao ? undefined : alvo.medicoId);
  if (!itens) return { ok: false, erro: 'Não consegui montar o novo horário para todos os exames.' };

  const idsMovendo = new Set(itens.map((i) => i.id));
  for (const item of itens) {
    const conflito = await checarConflito(item, idsMovendo);
    if (conflito) return { ok: false, erro: conflito };
  }

  return { ok: true, plano: { itens, sessao, ancora } };
}

/**
 * Cada exame vai para a posição que o motor de horários já calculou (casadas
 * por `exameId` — o agente não permite o mesmo exame duas vezes na sessão).
 * Devolve null se alguma posição faltar, para o chamador não gravar pela metade.
 */
function porColocacaoExplicita(
  movendo: Agendamento[],
  colocacoes: ColocacaoExplicita[],
): ItemRemarcado[] | null {
  const itens: ItemRemarcado[] = [];
  const disponiveis = [...colocacoes];
  for (const m of movendo) {
    const i = disponiveis.findIndex((c) => c.exameId === m.exameId);
    if (i < 0) return null;
    const [c] = disponiveis.splice(i, 1);
    itens.push({
      id: m.id,
      exameId: m.exameId,
      medicoId: c.medicoId,
      inicio: c.inicio,
      fim: c.fim,
      inicioAnterior: m.inicio,
    });
  }
  return itens;
}

/**
 * Desliza a sessão inteira pelo mesmo intervalo. Se o exame trocar de médico,
 * o fim é recalculado: a mesma ecocardiografia pode levar 30min com um médico
 * e 45min com outro, e manter a duração antiga criaria buraco ou sobreposição.
 */
function porDeslocamento(
  movendo: Agendamento[],
  delta: number,
  novoMedicoId?: string,
): ItemRemarcado[] {
  return movendo.map((m) => {
    const medicoId = novoMedicoId ?? m.medicoId;
    const inicio = deslocarIso(m.inicio, delta);
    const trocouMedico = medicoId !== m.medicoId;
    const dur = trocouMedico ? duracaoParaMedico(medicoId, m.exameId) : null;
    return {
      id: m.id,
      exameId: m.exameId,
      medicoId,
      inicio,
      fim: dur === null ? deslocarIso(m.fim, delta) : deslocarIso(inicio, dur),
      inicioAnterior: m.inicio,
    };
  });
}

/** duração do exame para um médico (ou do aparelho); null se não souber */
function duracaoParaMedico(medicoId: string, exameId: string): number | null {
  const exame = EXAMES.find((e) => e.id === exameId);
  if (!exame) return null;
  if (exame.aparelho) return APARELHOS[exame.aparelho].duracaoMin;
  const medico = MEDICOS.find((m) => m.id === medicoId);
  return medico ? duracaoDoMedico(medico, exame) : exame.duracaoMin;
}

/**
 * Devolve a mensagem de erro se o novo horário estiver ocupado, ou null.
 * Exame de aparelho (MAPA/Holter) não é exclusivo: o limite é a capacidade
 * de aparelhos no mesmo horário, não a sobreposição.
 */
async function checarConflito(item: ItemRemarcado, idsMovendo: Set<string>): Promise<string | null> {
  const dia = item.inicio.slice(0, 10);
  const doDia = (await listarAgendamentosDoMedico(item.medicoId, `${dia}T00:00:00-03:00`, `${dia}T23:59:59-03:00`))
    .filter((a) => a.status !== 'cancelado' && !idsMovendo.has(a.id));

  const aparelho = aparelhoDoExame(item.exameId);
  if (aparelho) {
    const cfg = APARELHOS[aparelho];
    const hhmm = item.inicio.slice(11, 16);
    const ocupados = doDia.filter((a) => a.exameId === item.exameId && a.inicio.slice(11, 16) === hhmm).length;
    if (ocupados >= cfg.capacidadePorSlot) {
      return `Todos os aparelhos de ${cfg.nome} já estão ocupados nesse horário.`;
    }
    return null;
  }

  const sobrepoe = doDia.some((a) => item.inicio < a.fim && a.inicio < item.fim);
  return sobrepoe ? 'Esse horário já está ocupado. Escolha outro.' : null;
}

/**
 * Grava o plano. Volta o status para "agendado" e limpa o lembrete (string
 * vazia, não `undefined` — o Firestore rejeita `undefined` num merge), para
 * o cron reenviar a confirmação referente à NOVA data.
 */
export async function aplicarRemarcacao(plano: PlanoRemarcacao): Promise<void> {
  const agora = new Date().toISOString();
  for (const item of plano.itens) {
    await atualizarAgendamento(item.id, {
      medicoId: item.medicoId,
      inicio: item.inicio,
      fim: item.fim,
      status: 'agendado',
      lembreteEnviadoEm: '',
      remarcadoEm: agora,
      inicioAnterior: item.inicioAnterior,
    });
  }
}
