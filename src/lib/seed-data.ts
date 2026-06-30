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

export const MEDICOS: Medico[] = [
  {
    id: 'med-1',
    nome: 'Dr. Exemplo Um',
    crm: 'CRM-MG 00001',
    examesHabilitados: EXAMES.map((e) => e.id),
    disponibilidade: grade('08:00', '12:00'),
    ativo: true,
  },
  {
    id: 'med-2',
    nome: 'Dra. Exemplo Dois',
    crm: 'CRM-MG 00002',
    examesHabilitados: ['consulta', 'ecg', 'eco-doppler', 'duplex-carotidas', 'mapa', 'holter'],
    disponibilidade: grade('13:00', '18:00'),
    ativo: true,
  },
  {
    id: 'med-3',
    nome: 'Dr. Exemplo Três',
    crm: 'CRM-MG 00003',
    examesHabilitados: ['consulta', 'ecg', 'ergometrico', 'cardiopulmonar', 'risco-cirurgico'],
    disponibilidade: grade('08:00', '14:00'),
    ativo: true,
  },
];

export const CONTATO = {
  telefoneFixo: '(32) 3215-8744',
  whatsapp: '(32) 99995-2138',
  nomeClinica: 'CardioCentro',
  subtitulo: 'Métodos Diagnósticos em Cardiologia',
  cidade: 'Juiz de Fora — MG',
};
