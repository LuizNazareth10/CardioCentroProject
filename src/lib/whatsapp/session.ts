// =============================================================
// Estado de conversa por telefone.
//
// Em produção (DATA_BACKEND=firestore) o estado vive na coleção
// "wa_sessions" — OBRIGATÓRIO em serverless (Vercel): cada invocação
// pode cair numa instância diferente e cold starts zeram a memória.
// Sem persistência, o paciente perderia o fluxo no meio da conversa.
//
// No modo memory (dev/demo), usa um Map em memória como antes.
// TTL de 30 min: sessão mais antiga é descartada e recomeça do zero.
// =============================================================

export type EtapaConversa =
  | 'inicio'
  | 'menu'
  | 'escolhendo_exames'
  | 'escolhendo_medico'
  | 'escolhendo_horario'
  | 'identificacao'
  | 'aguardando_documentos' // convênio com autorização: aguarda foto da carteirinha + pedido médico
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
  /** Nome de exibição do WhatsApp (pushName), usado só para saudação até o paciente informar o nome completo */
  pushName?: string;
  convenioId?: string;
  pacienteId?: string;
  // true enquanto esperamos o paciente digitar o nome de um convênio fora da lista
  aguardandoConvenio?: boolean;
  // nº de fotos recebidas (carteirinha + pedido médico) p/ convênios com autorização — precisa de 2
  docsAutorizacaoRecebidos?: number;
  atualizadoEm: number;
}

const TTL = 30 * 60 * 1000; // 30 min
const isFirestore = process.env.DATA_BACKEND === 'firestore';
const sessoes = new Map<string, ConversaState>(); // fallback memory

function novaSessao(): ConversaState {
  return { etapa: 'inicio', examesSelecionados: [], atualizadoEm: Date.now() };
}

function valida(s: ConversaState | undefined | null): ConversaState | null {
  if (!s) return null;
  if (Date.now() - s.atualizadoEm >= TTL) return null;
  return s;
}

async function fs() {
  const { db } = await import('../db/firestore');
  return db();
}

export async function carregarSessao(telefone: string): Promise<ConversaState> {
  if (isFirestore) {
    try {
      const doc = await (await fs()).collection('wa_sessions').doc(telefone).get();
      const atual = valida(doc.exists ? (doc.data() as ConversaState) : null);
      if (atual) return atual;
    } catch (e) {
      console.error('[wa_sessions] erro ao carregar, usando sessão nova:', e);
    }
    return novaSessao();
  }
  const atual = valida(sessoes.get(telefone));
  if (atual) return atual;
  const nova = novaSessao();
  sessoes.set(telefone, nova);
  return nova;
}

export async function salvarSessao(telefone: string, state: ConversaState): Promise<void> {
  state.atualizadoEm = Date.now();
  if (isFirestore) {
    try {
      // JSON round-trip remove `undefined` (Firestore rejeita) e garante objeto puro
      const puro = JSON.parse(JSON.stringify(state)) as ConversaState;
      await (await fs()).collection('wa_sessions').doc(telefone).set(puro);
    } catch (e) {
      console.error('[wa_sessions] erro ao salvar sessão:', e);
    }
    return;
  }
  sessoes.set(telefone, state);
}

export async function limparSessao(telefone: string): Promise<void> {
  if (isFirestore) {
    try {
      await (await fs()).collection('wa_sessions').doc(telefone).delete();
    } catch (e) {
      console.error('[wa_sessions] erro ao limpar sessão:', e);
    }
    return;
  }
  sessoes.delete(telefone);
}
