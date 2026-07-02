// Estado de conversa por telefone. Em produção, mover para Firestore
// (coleção "wa_sessions") com TTL — aqui é em memória para simplicidade.

export type EtapaConversa =
  | 'inicio'
  | 'menu'
  | 'escolhendo_exames'
  | 'escolhendo_medico'
  | 'escolhendo_horario'
  | 'identificacao'
  | 'confirmando'
  | 'humano'; // handoff: o agente para de processar, a recepção assume

interface ItemProposto {
  exameId: string;
  medicoId: string;
  inicio: string;
  fim: string;
}

export interface ConversaState {
  etapa: EtapaConversa;
  examesSelecionados: string[];
  medicoPreferidoId?: string;
  // TODAS as sugestões calculadas (vários dias/horários) — base para
  // navegar por dia e por horário na etapa "escolhendo_horario".
  propostas?: Array<{ rotulo: string; subtitulo: string; data: string; inicio: string; itens: ItemProposto[] }>;
  // proposta escolhida (reduzida a 1) para confirmação
  opcoes?: Array<{ rotulo: string; itens: ItemProposto[] }>;
  // dados de identificação coletados
  nome?: string;
  convenioId?: string;
  pacienteId?: string;
  // true enquanto esperamos o paciente digitar o nome de um convênio fora da lista
  aguardandoConvenio?: boolean;
  atualizadoEm: number;
}

const sessoes = new Map<string, ConversaState>();
const TTL = 30 * 60 * 1000; // 30 min

export function getSessao(telefone: string): ConversaState {
  const atual = sessoes.get(telefone);
  if (atual && Date.now() - atual.atualizadoEm < TTL) return atual;
  const nova: ConversaState = { etapa: 'inicio', examesSelecionados: [], atualizadoEm: Date.now() };
  sessoes.set(telefone, nova);
  return nova;
}

export function salvarSessao(telefone: string, state: ConversaState) {
  state.atualizadoEm = Date.now();
  sessoes.set(telefone, state);
}

export function limparSessao(telefone: string) {
  sessoes.delete(telefone);
}
