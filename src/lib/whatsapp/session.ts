// =============================================================
// Estado de conversa por telefone.
//
// Em produção (DATA_BACKEND=firestore) o estado vive na coleção
// "wa_sessions" — OBRIGATÓRIO em serverless (Vercel): cada invocação
// pode cair numa instância diferente e cold starts zeram a memória.
// Sem persistência, o paciente perderia o fluxo no meio da conversa.
//
// No modo memory (dev/demo), usa um Map em memória como antes.
// TTL de 2h: sessão mais antiga é descartada e recomeça do zero. Mesmo TTL
// vale para o handoff humano (marcarHandoffHumano, abaixo) — não há uma
// janela separada para cada caso.
// =============================================================

export type EtapaConversa =
  | 'inicio'
  | 'menu'
  | 'escolhendo_exames'
  | 'confirmando_idade' // exames escolhidos: confirma se é para adulto ou criança, antes de seguir
  | 'escolhendo_medico'
  | 'escolhendo_horario'
  | 'identificacao'
  | 'aguardando_documentos' // convênio com autorização: aguarda foto da carteirinha + pedido médico
  | 'confirmando_plano' // convênio aceito, mas com planos não atendidos: confirma qual é o plano
  | 'confirmando_remarcacao' // paciente com exame marcado: confirma que quer trocar de horário
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
  /** paciente já confirmou que o plano dele NÃO é um dos não atendidos (ver PLANOS_NAO_ATENDIDOS) */
  planoConfirmado?: boolean;
  /**
   * já perguntamos e o agendamento desta sessão é para um ADULTO. Regra de
   * negócio: agendamento para criança/menor de idade sempre transborda para
   * a recepção (ver transbordarMenorIdade) — por isso só existe o caso
   * "true" aqui; se fosse criança o fluxo já teria saído para 'humano'.
   * Volta a `undefined` a cada "menu" para o mesmo telefone poder agendar
   * para outra pessoa da família depois, sem herdar a resposta anterior.
   */
  idadeConfirmada?: boolean;

  // ---- REMARCAÇÃO ----
  /**
   * Agendamento futuro que o agente reconheceu para este número. Fica no
   * estado para não reler o banco a cada mensagem; é recarregado sempre que
   * o paciente volta ao menu.
   */
  agendamentoFuturo?: AgendamentoFuturoState;
  /**
   * Já consultamos o banco por agendamentos futuros nesta sessão. Evita
   * reler a cada volta ao menu quando o paciente NÃO tem exame marcado —
   * sem isso, quem só tira dúvidas geraria duas leituras por mensagem.
   * Um agendamento criado no meio da conversa não escapa: ao confirmar, a
   * sessão é limpa e a próxima começa do zero.
   */
  futuroVerificado?: boolean;
  /** id do agendamento sendo remarcado — enquanto setado, o fluxo de horário MOVE em vez de criar */
  remarcandoId?: string;

  atualizadoEm: number;
}

/** resumo do próximo exame marcado, carregado do banco pelo telefone */
export interface AgendamentoFuturoState {
  /** id do agendamento âncora (o mais cedo da sessão) */
  id: string;
  /** ISO do início */
  inicio: string;
  /** exames da sessão (1 ou vários marcados juntos) */
  exameIds: string[];
  /** texto pronto para exibir ao paciente (ex.: "Ecocardiograma — 12/08 às 14:00") */
  resumo: string;
}

const TTL = 2 * 60 * 60 * 1000; // 2 horas
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

/**
 * Marca a conversa como `humano` porque a RECEPÇÃO respondeu digitando
 * direto no celular/PC (não pelo agente) — ver `foiEnviadoPeloAgente` em
 * evolution.ts, chamado a partir do webhook para todo `fromMe` que não é eco
 * do próprio agente.
 *
 * Sem isto, um paciente já em atendimento humano que caísse no bucket da IA
 * (canary) na mensagem seguinte reabriria o fluxo de agendamento do zero,
 * sem nenhuma noção da conversa em andamento. Como toda sessão expira depois
 * de 2h sem mensagem (TTL acima), o handoff não é permanente: encerrada a
 * conversa humana, a próxima mensagem do paciente volta a cair na IA normalmente.
 *
 * SEMPRE salva (não retorna cedo se já estava em `humano`): cada mensagem
 * real da atendente precisa repor `atualizadoEm`, senão `horasDeSilencio`
 * (rollout.ts) mede a partir da PRIMEIRA resposta da recepção — se a
 * atendente seguir conversando por horas, o "silêncio" pareceria antigo e o
 * canary poderia dar a conversa de volta pra IA no meio do atendimento.
 */
export async function marcarHandoffHumano(telefone: string): Promise<void> {
  const s = await carregarSessao(telefone);
  s.etapa = 'humano';
  await salvarSessao(telefone, s);
}

/**
 * Horas desde a última mensagem (de qualquer lado) nesta conversa —
 * INDEPENDENTE do TTL acima, que só decide se o CONTEÚDO da sessão ainda
 * vale (etapa, exames escolhidos etc.), não se existe registro dela. Usado
 * pelo rollout (ver decidirRollout em rollout.ts) para dar cobertura total
 * (atende sempre) a conversas em `canary` abandonadas há 4h+: ninguém, nem
 * humano nem IA, está respondendo ali, então não faz sentido reservar a
 * fatia pequena do canary pra elas. `null` = nunca conversamos com esse
 * número — nesse caso o rollout aplica a % normal, não o override.
 */
export async function horasDeSilencio(telefone: string): Promise<number | null> {
  let atualizadoEm: number | undefined;
  if (isFirestore) {
    try {
      const doc = await (await fs()).collection('wa_sessions').doc(telefone).get();
      atualizadoEm = doc.exists ? (doc.data() as ConversaState)?.atualizadoEm : undefined;
    } catch (e) {
      console.error('[wa_sessions] erro ao checar silêncio:', e);
      return null;
    }
  } else {
    atualizadoEm = sessoes.get(telefone)?.atualizadoEm;
  }
  if (!atualizadoEm) return null;
  return (Date.now() - atualizadoEm) / (60 * 60 * 1000);
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
