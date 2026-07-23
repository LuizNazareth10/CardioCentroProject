import type { AparelhoConfig, Convenio, Exame, Medico } from './types';

// =============================================================
// Dados-base da clínica CardioCentro (Juiz de Fora).
// Médicos, janelas e durações são os REAIS informados pela clínica.
// Mapa e Holter são exames de APARELHO (slots fixos, ver APARELHOS).
// =============================================================

// Catálogo REAL da clínica: apenas 4 exames de médico + 2 de aparelho.
// (A duração é a PADRÃO; cada médico pode ter duração própria via `duracoes`.)
export const EXAMES: Exame[] = [
  {
    id: 'eco-doppler',
    nome: 'Ecocardiograma com Doppler Colorido/Ecocardiograma Transtorácico',
    duracaoMin: 15,
    preparo: 'Não há preparo específico.',
    ativo: true,
  },
  {
    id: 'duplex-carotidas',
    nome: 'Duplex Scan de Carótidas e Vertebrais',
    duracaoMin: 15,
    ativo: true,
  },
  {
    id: 'ergometrico',
    nome: 'Teste Ergométrico Computadorizado',
    duracaoMin: 25,
    preparo: 'Roupas confortáveis para esforço, sutiã/top esportivo (mulheres). Sem hidratante/cremes. Refeição leve 2h antes. Manter medicações conforme médico.',
    ativo: true,
  },
  {
    id: 'cardiopulmonar',
    nome: 'Teste Cardiopulmonar',
    duracaoMin: 30,
    preparo: 'Roupas confortáveis para esforço, sutiã/top esportivo (mulheres). Sem hidratante/cremes. Refeição leve 2h antes. Manter medicações conforme médico.',
    ativo: true,
  },
  { id: 'holter', nome: 'Holter 24h', duracaoMin: 15, preparo: 'Banho tomado (não molhar aparelho). Retorno em 24h. Reserve tempo extra para instalação.', aparelho: 'holter', ativo: true },
  { id: 'mapa', nome: 'MAPA 24h', duracaoMin: 15, preparo: 'Banho tomado. Traga lista/medicamentos. Retorno em 24h. Reserve tempo extra.', aparelho: 'mapa', ativo: true },
];

// =============================================================
// APARELHOS (Mapa e Holter) — slots fixos por dia, não vinculados a
// médico. O paciente coloca o aparelho no slot e retorna em 24h para
// retirar; por isso NÃO há agendamento de sexta (clínica fecha sábado).
// Cada horário listado corresponde a UM aparelho (capacidade por slot = 1);
// o nº de slots por dia = nº de aparelhos (4 Mapa, 3 Holter).
// =============================================================
export const APARELHOS: Record<'mapa' | 'holter', AparelhoConfig> = {
  mapa: {
    tipo: 'mapa',
    nome: 'MAPA 24h',
    exameId: 'mapa',
    capacidade: 4,
    capacidadePorSlot: 1,
    duracaoMin: 15,
    slots: {
      1: ['08:30', '09:00', '14:30', '15:00'],
      2: ['09:00', '09:30', '15:00', '15:30'],
      3: ['09:30', '10:00', '15:30', '16:00'],
      4: ['10:00', '10:30', '16:00', '16:30'],
      // 5 (sexta) bloqueado
    },
  },
  holter: {
    tipo: 'holter',
    nome: 'Holter 24h',
    exameId: 'holter',
    capacidade: 3,
    capacidadePorSlot: 1,
    duracaoMin: 15,
    slots: {
      1: ['08:45', '09:15', '14:45'],
      2: ['09:15', '09:45', '15:15'],
      3: ['09:45', '10:15', '15:45'],
      4: ['10:15', '10:45', '16:15'],
      // 5 (sexta) bloqueado
    },
  },
};

export const CONVENIOS: Convenio[] = [
  'Particular',
  'AMAGIS',
  'AMMP',
  'CASSI',
  'CEMIG Saúde',
  'IPSEMG',
  'Libertas',
  'Saúde Caixa',
  'AFFEMG',
  'ASSEFAZ',
  'Bradesco',
  'Golden Cross',
  'PLASC',
  'Sabin Sinai',
  'Saúde Servidor',
  'Sul América',
  'Unimed',
  'Associação dos Aposentados',
  'Jade',
  'Plan Minas',
  'A.M.D.A.R',
  'Portal da Luz',
  'Abertta Saúde',
  // convênios de baixo volume vindos do histórico da clínica (retroalimentação)
  // que não têm entrada própria no catálogo — agrupados aqui em vez de perder
  // o registro de qual convênio o paciente/agendamento usava.
  'Outros',
].map((nome) => ({
  id: nome.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  nome,
  ativo: true,
}));

// Convênios que exigem autorização prévia: o agente do WhatsApp só confirma
// o agendamento após o paciente enviar foto da carteirinha + pedido médico
// (o conteúdo das imagens não é validado, só a presença dos dois envios).
const NOMES_CONVENIOS_AUTORIZACAO = ['Saúde Caixa', 'Abertta Saúde', 'Sul América', 'PLASC', 'Sabin Sinai'];
export const CONVENIOS_REQUEREM_AUTORIZACAO_IDS: string[] = CONVENIOS
  .filter((c) => NOMES_CONVENIOS_AUTORIZACAO.includes(c.nome))
  .map((c) => c.id);

// Convênios que, por regra de negócio da clínica, NÃO são finalizados pelo
// agente: assim que o paciente informa um destes, a conversa é transferida
// para a recepção humana concluir. O motivo (regra interna) não é explicado
// ao paciente — o transbordo acontece de forma natural. Ver `avancarAposConvenio`.
const NOMES_CONVENIOS_TRANSBORDO = ['IPSEMG'];
export const CONVENIOS_TRANSBORDO_IMEDIATO_IDS: string[] = CONVENIOS
  .filter((c) => NOMES_CONVENIOS_TRANSBORDO.includes(c.nome))
  .map((c) => c.id);

// ids de exame usados nas janelas (atalhos legíveis)
const ECO = 'eco-doppler';
const CARO = 'duplex-carotidas';
const ERGO = 'ergometrico';
const CARDIOPULM = 'cardiopulmonar';

// =============================================================
// FONTE ÚNICA DE VERDADE dos médicos (dados REAIS da clínica).
// A landing (src/components/landing/content.ts) deriva a lista de
// "doctors" daqui — landing e área restrita ficam sempre sincronizadas.
// Cada janela informa quais exames oferece e (quando aplicável) se é
// quinzenal. As durações por exame variam por médico (campo `duracoes`).
// Mapa/Holter NÃO ficam com médico — ver APARELHOS acima.
// =============================================================
export const MEDICOS: Medico[] = [
  {
    id: 'med-daher',
    nome: 'Dr. Ricardo Daher',
    crm: 'CRM MG 49062',
    especialidade: 'Cardiologista · Ecocardiografia e Doppler',
    foto: '',
    examesHabilitados: [ECO, CARO, ERGO],
    duracoes: { [ECO]: 15, [CARO]: 15, [ERGO]: 15 },
    disponibilidade: [
      { weekday: 1, inicio: '13:30', fim: '17:00', exames: [ECO, CARO, ERGO] }, // seg tarde
      { weekday: 2, inicio: '09:15', fim: '11:30', exames: [ECO, CARO, ERGO] }, // ter manhã
      { weekday: 2, inicio: '13:30', fim: '17:00', exames: [ECO, CARO, ERGO] }, // ter tarde
      { weekday: 4, inicio: '09:00', fim: '11:30', exames: [ECO, CARO] },       // qui manhã
      { weekday: 4, inicio: '13:30', fim: '17:00', exames: [ECO, CARO] },       // qui tarde
      { weekday: 5, inicio: '13:40', fim: '16:00', exames: [ECO, CARO] },       // sex tarde
    ],
    ativo: true,
  },
  {
    id: 'med-zorzo',
    nome: 'Dr. Paulo Zorzo',
    crm: 'CRM MG 10312',
    especialidade: 'Cardiologista · Ecocardiografia',
    foto: '',
    examesHabilitados: [ECO, CARO],
    duracoes: { [ECO]: 20, [CARO]: 20 },
    disponibilidade: [
      { weekday: 2, inicio: '14:00', fim: '15:20', exames: [ECO] },       // ter tarde
      { weekday: 3, inicio: '14:00', fim: '15:20', exames: [ECO, CARO] }, // qua tarde
      { weekday: 4, inicio: '11:40', fim: '12:20', exames: [ECO, CARO] }, // qui manhã
    ],
    ativo: true,
  },
  {
    id: 'med-lovisi',
    nome: 'Dr. Júlio Lovisi',
    crm: 'CRM MG 16343',
    especialidade: 'Cardiologista · Teste Cardiopulmonar',
    foto: '',
    examesHabilitados: [ECO, CARO, CARDIOPULM],
    duracoes: { [CARDIOPULM]: 30, [ECO]: 15, [CARO]: 15 },
    disponibilidade: [
      // Regra da clínica: na seg e na sex, o Teste Cardiopulmonar tem PRIORIDADE.
      // `exigeExame` faz o motor só oferecer estes horários se a sessão incluir
      // o cardiopulmonar — eco/carótida entram junto com ele, nunca sozinhos.
      { weekday: 1, inicio: '09:00', fim: '11:30', exames: [CARDIOPULM, ECO, CARO], exigeExame: CARDIOPULM }, // seg manhã
      { weekday: 3, inicio: '09:00', fim: '11:15', exames: [ECO, CARO], quinzenal: true },                   // qua manhã (quinzenal) — só eco/carótida
      { weekday: 5, inicio: '09:00', fim: '11:30', exames: [CARDIOPULM, ECO, CARO], exigeExame: CARDIOPULM }, // sex manhã
    ],
    ativo: true,
  },
  {
    id: 'med-lanzoni',
    nome: 'Dra. Fernanda Lanzoni',
    crm: 'CRM MG 40312',
    especialidade: 'Cardiologista · Teste Ergométrico',
    foto: '',
    examesHabilitados: [ERGO],
    duracoes: { [ERGO]: 25 },
    disponibilidade: [
      { weekday: 3, inicio: '08:20', fim: '11:00', exames: [ERGO], quinzenal: true },
      { weekday: 3, inicio: '13:20', fim: '16:20', exames: [ERGO] },
      { weekday: 4, inicio: '08:20', fim: '11:00', exames: [ERGO] },
      { weekday: 4, inicio: '13:20', fim: '16:20', exames: [ERGO] },
      { weekday: 5, inicio: '13:20', fim: '15:20', exames: [ERGO] },
    ],
    ativo: true,
  },
  // -----------------------------------------------------------
  // Médicos INATIVOS: só têm histórico (retroalimentação), sem agenda
  // futura nem horário configurado. Mantidos aqui apenas para que os
  // agendamentos antigos deles mostrem o nome certo (não o id cru) na
  // ficha do paciente. Não aparecem na Agenda nem no agendamento por
  // não terem `disponibilidade` e por `ativo: false`.
  // -----------------------------------------------------------
  {
    id: 'med-pedro-paulo',
    nome: 'Dr. Pedro Paulo de Oliveira',
    crm: 'CRM MG 19061',
    especialidade: 'Cardiologista',
    foto: '',
    examesHabilitados: [],
    disponibilidade: [],
    ativo: false,
  },
  {
    id: 'med-sonielle',
    nome: 'Dra. Sonielle Albertino',
    crm: 'CRM MG 69987',
    especialidade: 'Cardiologista',
    foto: '',
    examesHabilitados: [],
    disponibilidade: [],
    ativo: false,
  },
  {
    id: 'med-luisa-lovisi',
    nome: 'Dra. Luisa Lovisi',
    crm: '',
    especialidade: 'Cardiologista',
    foto: '',
    examesHabilitados: [],
    disponibilidade: [],
    ativo: false,
  },
  {
    id: 'med-tassiana-campos',
    nome: 'Dra. Tassiana Miranda Campos',
    crm: '',
    especialidade: 'Cardiologista',
    foto: '',
    examesHabilitados: [],
    disponibilidade: [],
    ativo: false,
  },
  {
    id: 'med-vagner-silva',
    nome: 'Dr. Vagner de Campos Silva',
    crm: '',
    especialidade: 'Cardiologista',
    foto: '',
    examesHabilitados: [],
    disponibilidade: [],
    ativo: false,
  },
];

// =============================================================
// Contato oficial da clínica — usado na landing e na área restrita.
// =============================================================
const WHATSAPP_NUMERO = '5532999952138'; // formato internacional (wa.me)
// mensagem do deep link — o agente detecta esta frase e já inicia o fluxo
const WHATSAPP_MENSAGEM = 'Olá, gostaria de agendar um exame';

export const CONTATO = {
  nomeClinica: 'Cardiocentro',
  subtitulo: 'Métodos Diagnósticos em Cardiologia',
  cidade: 'Juiz de Fora — MG',
  endereco: 'Rua Delfim Moreira, 165',
  bairro: 'Centro · Juiz de Fora — MG',
  enderecoCompleto: 'Rua Delfim Moreira, 165 — Centro, Juiz de Fora — MG',
  email: 'cardiocentrojf@hotmail.com',
  telefoneFixo: '(32) 3215-8744',
  telefone: '(32) 3215-8744',
  telefoneLink: 'tel:+553232158744',
  whatsapp: '(32) 99995-2138',
  whatsappDescricao: 'Exclusivo para mensagens',
  whatsappNumero: WHATSAPP_NUMERO,
  whatsappMensagem: WHATSAPP_MENSAGEM,
  whatsappLink: `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(WHATSAPP_MENSAGEM)}`,
  horarios: [
    'Segunda a quinta-feira: 08h às 18h',
    'Sexta-feira: 08h às 17h',
    'Sábado e domingo: Fechado',
  ],
  instagram: 'https://www.instagram.com/cardiocentro.jf/',
  instagramHandle: '@cardiocentro.jf',
  mapaQuery: 'Rua Delfim Moreira, 165, Centro, Juiz de Fora - MG',
} as const;

/** Monta um link de WhatsApp com mensagem opcional customizada. */
export function linkWhatsapp(mensagem: string = WHATSAPP_MENSAGEM): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}
