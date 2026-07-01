import type { Convenio, Exame, Medico } from './types';

// =============================================================
// Dados-base extraídos das imagens reais da clínica (Instagram).
// Os horários dos médicos e durações de exame são PLACEHOLDERS
// (múltiplos de 15min) e devem ser substituídos pelos dados reais
// que serão enviados depois. Ver docs/DECISOES.md.
// =============================================================

export const EXAMES: Exame[] = [
  { id: 'consulta', nome: 'Consulta Cardiológica', duracaoMin: 30, ativo: true },
  { id: 'ecg', nome: 'Eletrocardiograma (ECG)', duracaoMin: 15, ativo: true },
  { id: 'risco-cirurgico', nome: 'Risco Cirúrgico', duracaoMin: 30, ativo: true },
  {
    id: 'eco-doppler',
    nome: 'Ecocardiograma com Doppler Colorido',
    duracaoMin: 30,
    preparo: 'Não há preparo específico.',
    ativo: true,
  },
  {
    id: 'duplex-carotidas',
    nome: 'Duplex Scan de Carótidas e Vertebrais',
    duracaoMin: 30,
    ativo: true,
  },
  {
    id: 'ergometrico',
    nome: 'Teste Ergométrico Computadorizado',
    duracaoMin: 45,
    preparo: 'Trazer roupa e tênis para esforço. Verificar medicações com o médico.',
    ativo: true,
  },
  {
    id: 'cardiopulmonar',
    nome: 'Teste Cardiopulmonar',
    duracaoMin: 60,
    preparo: 'Trazer roupa e tênis para esforço.',
    ativo: true,
  },
  { id: 'holter', nome: 'Holter 24h', duracaoMin: 15, preparo: 'Retorno em 24h para retirada.', ativo: true },
  { id: 'mapa', nome: 'MAPA 24h', duracaoMin: 15, preparo: 'Retorno em 24h para retirada.', ativo: true },
];

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
].map((nome) => ({
  id: nome.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  nome,
  ativo: true,
}));

// Grade semanal padrão (seg–sex). PLACEHOLDER — trocar pelos horários reais.
const grade = (inicio: string, fim: string) =>
  [1, 2, 3, 4, 5].map((weekday) => ({ weekday: weekday as 1 | 2 | 3 | 4 | 5, inicio, fim }));

// retrato Unsplash (mesmo padrão usado na landing)
const retrato = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=700`;

// =============================================================
// FONTE ÚNICA DE VERDADE dos 6 médicos.
// A landing (src/components/landing/content.ts) deriva a lista de
// "doctors" a partir daqui — landing e área restrita ficam sempre
// sincronizadas. Nomes são fictícios (placeholder), a trocar pelos
// reais. Ver docs/DECISOES.md.
// =============================================================
export const MEDICOS: Medico[] = [
  {
    id: 'med-1',
    nome: 'Dra. Helena Marques',
    crm: 'CRM-MG 41.209',
    especialidade: 'Cardiologista · Ecocardiografia',
    foto: retrato('photo-1559839734-2b71ea197ec2'),
    examesHabilitados: ['consulta', 'ecg', 'eco-doppler', 'duplex-carotidas', 'mapa', 'holter', 'risco-cirurgico'],
    disponibilidade: grade('08:00', '12:00'),
    ativo: true,
  },
  {
    id: 'med-2',
    nome: 'Dr. Rafael Andrade',
    crm: 'CRM-MG 38.744',
    especialidade: 'Cardiologista · Arritmias',
    foto: retrato('photo-1612349317150-e413f6a5b16d'),
    examesHabilitados: ['consulta', 'ecg', 'holter', 'mapa', 'ergometrico', 'risco-cirurgico'],
    disponibilidade: grade('13:00', '18:00'),
    ativo: true,
  },
  {
    id: 'med-3',
    nome: 'Dra. Beatriz Nunes',
    crm: 'CRM-MG 45.117',
    especialidade: 'Cardiologista · Hipertensão',
    foto: retrato('photo-1527613426441-4da17471b66d'),
    examesHabilitados: ['consulta', 'ecg', 'mapa', 'holter', 'eco-doppler', 'risco-cirurgico'],
    disponibilidade: grade('08:00', '14:00'),
    ativo: true,
  },
  {
    id: 'med-4',
    nome: 'Dr. Marcelo Ribeiro',
    crm: 'CRM-MG 33.586',
    especialidade: 'Cardiologista · Ergometria e Reabilitação',
    foto: retrato('photo-1537368910025-700350fe46c7'),
    examesHabilitados: ['consulta', 'ecg', 'ergometrico', 'cardiopulmonar', 'risco-cirurgico'],
    disponibilidade: grade('09:00', '15:00'),
    ativo: true,
  },
  {
    id: 'med-5',
    nome: 'Dra. Carolina Teixeira',
    crm: 'CRM-MG 48.902',
    especialidade: 'Cardiologista · Cardiologia Clínica',
    foto: retrato('photo-1651008376811-b90baee60c1f'),
    examesHabilitados: EXAMES.map((e) => e.id),
    disponibilidade: grade('13:00', '19:00'),
    ativo: true,
  },
  {
    id: 'med-6',
    nome: 'Dr. Eduardo Salgado',
    crm: 'CRM-MG 29.415',
    especialidade: 'Cardiologista · Cardiologia Intervencionista',
    foto: retrato('photo-1582750433449-648ed127bb54'),
    examesHabilitados: ['consulta', 'ecg', 'eco-doppler', 'duplex-carotidas', 'ergometrico', 'risco-cirurgico'],
    disponibilidade: grade('07:00', '13:00'),
    ativo: true,
  },
];

// =============================================================
// Contato oficial da clínica — usado na landing e na área restrita.
// =============================================================
const WHATSAPP_NUMERO = '5532999952138'; // formato internacional (wa.me)
const WHATSAPP_MENSAGEM =
  'Olá! Gostaria de marcar um exame na Cardiocentro. Pode me ajudar?';

export const CONTATO = {
  nomeClinica: 'Cardiocentro',
  subtitulo: 'Métodos Diagnósticos em Cardiologia',
  cidade: 'Juiz de Fora — MG',
  endereco: 'Rua Delfim Moreira, 165',
  bairro: 'Centro · Juiz de Fora — MG',
  enderecoCompleto: 'Rua Delfim Moreira, 165 — Centro, Juiz de Fora — MG',
  email: 'contato@cardiocentro.com.br',
  // O único número informado pela clínica é o WhatsApp; ele é usado
  // tanto como telefone de contato quanto para o botão do WhatsApp.
  telefoneFixo: '(32) 99995-2138',
  telefone: '(32) 99995-2138',
  telefoneLink: 'tel:+5532999952138',
  whatsapp: '(32) 99995-2138',
  whatsappNumero: WHATSAPP_NUMERO,
  whatsappMensagem: WHATSAPP_MENSAGEM,
  whatsappLink: `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(WHATSAPP_MENSAGEM)}`,
  instagram: 'https://www.instagram.com/cardiocentro.jf/',
  instagramHandle: '@cardiocentro.jf',
  // usado no embed do mapa (Google Maps sem chave de API)
  mapaQuery: 'Rua Delfim Moreira, 165, Centro, Juiz de Fora - MG',
} as const;

/** Monta um link de WhatsApp com mensagem opcional customizada. */
export function linkWhatsapp(mensagem: string = WHATSAPP_MENSAGEM): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}
