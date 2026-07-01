// =============================================================
// Tipos de domínio — CardioCentro
// =============================================================

/** Dia da semana no padrão JS: 0 = domingo ... 6 = sábado */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Aparelho físico com slots fixos (não vinculado a médico) */
export type TipoAparelho = 'mapa' | 'holter';

/** Exame oferecido pela clínica */
export interface Exame {
  id: string;
  nome: string;
  /** duração PADRÃO em múltiplos de 15 (pode ser sobrescrita por médico) */
  duracaoMin: number;
  /** se exige preparo/jejum, observação curta exibida ao paciente */
  preparo?: string;
  /** se for exame de aparelho (Mapa/Holter), qual — usa a lógica de slots fixos */
  aparelho?: TipoAparelho;
  ativo: boolean;
}

/** Janela de disponibilidade de um médico num dia da semana */
export interface JanelaDisponibilidade {
  weekday: Weekday;
  /** "HH:MM" 24h */
  inicio: string;
  fim: string;
  /** exames oferecidos NESTA janela; se ausente, usa examesHabilitados do médico */
  exames?: string[];
  /** true = só ocorre nas semanas quinzenais ativas (referência 2026-07-08) */
  quinzenal?: boolean;
}

/** Médico da clínica */
export interface Medico {
  id: string;
  nome: string;
  crm: string;
  /** área de atuação exibida na landing e na área restrita */
  especialidade?: string;
  /** retrato usado na landing (URL) */
  foto?: string;
  /** exames que este médico realiza (ids de Exame) */
  examesHabilitados: string[];
  /** duração (min) por exame PARA ESTE médico; fallback = Exame.duracaoMin */
  duracoes?: Record<string, number>;
  /** grade fixa semanal de atendimento */
  disponibilidade: JanelaDisponibilidade[];
  ativo: boolean;
}

/** Configuração de um aparelho com slots fixos por dia da semana */
export interface AparelhoConfig {
  tipo: TipoAparelho;
  nome: string;
  /** id do Exame correspondente ('mapa' | 'holter') */
  exameId: string;
  /** nº de aparelhos físicos (= nº de slots por dia) */
  capacidade: number;
  /** quantos pacientes cabem no MESMO horário/dia (cada slot = 1 aparelho) */
  capacidadePorSlot: number;
  /** duração da colocação do aparelho (min) */
  duracaoMin: number;
  /** weekday (1=seg..5=sex) -> horários "HH:MM"; sexta é bloqueada (sem slots) */
  slots: Partial<Record<Weekday, string[]>>;
}

/** Convênio aceito (ou particular) */
export interface Convenio {
  id: string;
  nome: string;
  ativo: boolean;
}

export type StatusAgendamento =
  | 'agendado'
  | 'confirmado'
  | 'realizado'
  | 'cancelado'
  | 'faltou';

export type OrigemAgendamento = 'whatsapp' | 'sistema';

/** Um agendamento de exame (slot reservado na agenda) */
export interface Agendamento {
  id: string;
  pacienteId: string;
  pacienteNome: string;
  medicoId: string;
  exameId: string;
  convenioId: string;
  /** ISO datetime do início, ex: 2026-07-01T09:00:00-03:00 */
  inicio: string;
  /** ISO datetime do fim */
  fim: string;
  status: StatusAgendamento;
  origem: OrigemAgendamento;
  /** agrupa exames consecutivos marcados juntos (mesmo paciente/sessão) */
  grupoId?: string;
  observacao?: string;
  criadoEm: string;
}

// ---------- Cadastro de paciente / prontuário ----------

export type Sexo = 'M' | 'F' | 'O';

/** Ficha médica (prontuário base) — preenchida 1x e atualizável */
export interface Paciente {
  id: string;
  nome: string;
  cpf?: string;
  dataNascimento?: string; // ISO date
  sexo?: Sexo;
  telefone: string;
  email?: string;
  endereco?: string;
  convenioId?: string;
  carteirinha?: string;
  fichaMedica: FichaMedica;
  criadoEm: string;
  atualizadoEm: string;
}

/** Conteúdo clínico da ficha (padrão cardiologia) */
export interface FichaMedica {
  pesoKg?: number;
  alturaCm?: number;
  // antecedentes pessoais (fatores de risco cardiovascular)
  hipertensao: boolean;
  diabetes: boolean;
  dislipidemia: boolean;
  tabagismo: boolean;
  etilismo: boolean;
  sedentarismo: boolean;
  iamPrevio: boolean;
  avcPrevio: boolean;
  doencaRenal: boolean;
  marcapasso: boolean;
  // antecedentes familiares
  histFamiliarDac: boolean; // doença arterial coronariana
  histFamiliarMorteSubita: boolean;
  // texto livre
  medicacoesEmUso?: string;
  alergias?: string;
  cirurgiasPrevias?: string;
  queixaPrincipal?: string;
  observacoesGerais?: string;
}

/** Triagem feita ANTES de cada exame (uma por agendamento/dia) */
export interface Triagem {
  id: string;
  pacienteId: string;
  agendamentoId: string;
  exameId: string;
  data: string; // ISO
  // sinais vitais aferidos no dia
  paSistolica?: number;
  paDiastolica?: number;
  frequenciaCardiaca?: number;
  saturacao?: number;
  pesoKg?: number;
  // checagens
  jejum?: boolean;
  medicacaoTomadaHoje?: string;
  // sintomas atuais
  dorToracica: boolean;
  dispneia: boolean;
  palpitacao: boolean;
  sincope: boolean;
  edema: boolean;
  classificacaoRisco?: 'verde' | 'amarelo' | 'vermelho';
  observacoes?: string;
  responsavel?: string; // funcionário que triou
}

// ---------- Usuários do sistema (login) ----------
export type PapelUsuario = 'admin' | 'recepcao' | 'medico';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  // hash bcrypt — nunca a senha em texto
  senhaHash: string;
  ativo: boolean;
}

// ---------- Resultado do motor de agendamento ----------
export interface SlotDisponivel {
  medicoId: string;
  medicoNome: string;
  inicio: string; // ISO
  fim: string; // ISO
}

// ---------- Atendimento humano (handoff do WhatsApp) ----------
export type StatusAtendimento = 'aguardando' | 'em_atendimento' | 'resolvido';

export interface MensagemConversa {
  de: 'paciente' | 'recepcao' | 'agente';
  texto: string;
  ts: string; // ISO
}

/** Conversa de WhatsApp transferida para atendimento humano */
export interface Conversa {
  telefone: string;
  nome?: string;
  status: StatusAtendimento;
  mensagens: MensagemConversa[];
  atualizadoEm: string;
}
