import {
  Activity,
  Bike,
  Clock,
  Gauge,
  HeartPulse,
  ScanHeart,
  Scissors,
  ShieldCheck,
  Stethoscope,
  Waves,
} from 'lucide-react';
import { CONVENIOS, MEDICOS, CONTATO, linkWhatsapp } from '@/lib/seed-data';

export const contato = CONTATO;
export { linkWhatsapp };
export const whatsappLink = CONTATO.whatsappLink;

export const brandAssets = {
  logo: '/img/CardiocentroLogo.jpeg',
  examesList: '/img/ExamesList.jpeg',
};

// Imagens locais (public/img) — cardiologia, sem rostos.
export const photos = {
  hero: '/img/hero-cardio.jpg',
  about: '/img/FotoClinica.jpeg',
  aboutSecondary: '/img/FotoClinicaFachada.jpg',
  cta: '/img/hero-cardio.jpg',
};

// Catálogo completo conforme material oficial (ExamesList.jpeg).
export const services = [
  {
    icon: Stethoscope,
    title: 'Consulta Cardiológica',
    desc: 'Avaliação clínica completa com cardiologista, histórico e plano de cuidado personalizado.',
  },
  {
    icon: Activity,
    title: 'Eletrocardiograma (ECG)',
    desc: 'Registro da atividade elétrica do coração para investigar arritmias e outras alterações.',
  },
  {
    icon: Scissors,
    title: 'Risco Cirúrgico',
    desc: 'Avaliação cardiovascular pré-operatória para orientar procedimentos com segurança.',
  },
  {
    icon: ScanHeart,
    title: 'Ecocardiograma com Doppler Colorido',
    desc: 'Ultrassom do coração com imagem de alta definição para avaliar estrutura e função cardíaca.',
  },
  {
    icon: Waves,
    title: 'Duplex Scan de Carótidas e Vertebrais',
    desc: 'Ultrassom com Doppler das artérias carótidas e vertebrais para avaliar o fluxo sanguíneo.',
  },
  {
    icon: Bike,
    title: 'Teste Ergométrico Computadorizado',
    desc: 'Avaliação do coração sob esforço físico controlado, com acompanhamento médico integral.',
  },
  {
    icon: HeartPulse,
    title: 'Teste Cardiopulmonar',
    desc: 'Análise integrada do coração, pulmões e músculos durante o esforço, com precisão máxima.',
  },
  {
    icon: Clock,
    title: 'Holter 24h',
    desc: 'Monitoramento contínuo do ritmo cardíaco ao longo de 24 horas para detectar arritmias.',
  },
  {
    icon: Gauge,
    title: 'MAPA 24h',
    desc: 'Medição da pressão arterial ao longo de 24 horas para diagnóstico preciso da hipertensão.',
  },
];

export const differentials = [
  {
    icon: ShieldCheck,
    title: 'Precisão diagnóstica',
    desc: 'Equipamentos de última geração e laudos revisados por especialistas.',
  },
  {
    icon: ScanHeart,
    title: 'Linha completa de exames',
    desc: 'Todos os métodos diagnósticos em cardiologia reunidos em um só lugar.',
  },
  {
    icon: HeartPulse,
    title: 'Cuidado humano',
    desc: 'Cada paciente é acolhido com empatia, do primeiro contato ao acompanhamento.',
  },
];

export const doctors = [
  ...MEDICOS.filter((m) => m.ativo).map((m) => ({ name: m.nome })),
  { name: 'Dr. Pedro Paulo' },
];

export const testimonials = [
  {
    quote:
      'Fui acolhida do começo ao fim. O exame foi rápido e a equipe explicou cada detalhe com calma. Saí tranquila e bem cuidada.',
    name: 'Marina C.',
    role: 'Paciente · Juiz de Fora',
  },
  {
    quote:
      'Marquei pelo site em minutos e fui atendido no horário. Estrutura impecável e uma equipe que realmente se importa.',
    name: 'Carlos E.',
    role: 'Paciente · Juiz de Fora',
  },
  {
    quote:
      'Meu pai é hipertenso e o acompanhamento aqui mudou a rotina dele. Profissionalismo e carinho na medida certa.',
    name: 'Juliana P.',
    role: 'Acompanhante',
  },
];

export const nav = [
  { label: 'Exames', href: '#especialidades' },
  { label: 'A clínica', href: '#sobre' },
  { label: 'Corpo\u00A0médico', href: '#corpo-medico' },
  { label: 'Dúvidas', href: '#faq' },
  { label: 'Contato', href: '#agendamento' },
];

export const examesAgendamento = services.map((s) => s.title);

// Convênios exibidos na landing — derivados da fonte única (seed-data),
// sempre em sincronia com a área restrita. "Particular" fica implícito
// no título da seção.
export const conveniosAceitos = CONVENIOS.filter((c) => c.ativo && c.nome !== 'Particular').map(
  (c) => c.nome,
);

// Números REAIS derivados dos dados da clínica (nada inventado —
// exigência das normas de publicidade médica do CFM).
export const metricas = [
  { valor: services.length, sufixo: '', rotulo: 'exames e serviços em cardiologia' },
  { valor: doctors.length, sufixo: '', rotulo: 'médicos especialistas' },
  { valor: conveniosAceitos.length, sufixo: '', rotulo: 'convênios atendidos' },
  { valor: 1, sufixo: ' min', rotulo: 'para agendar pelo WhatsApp' },
];

// Perguntas frequentes — respostas alinhadas às regras reais da clínica
// (pedido médico obrigatório, cancelamento pelo telefone fixo etc.).
export const faq = [
  {
    pergunta: 'Preciso de pedido médico para fazer os exames?',
    resposta:
      'Sim. No dia do exame é obrigatório apresentar o pedido médico (em papel ou digital). Ele é necessário para o encaminhamento ao convênio e para os procedimentos administrativos. Se você ainda não tem pedido, agende uma consulta cardiológica — o médico avaliará qual exame é indicado para o seu caso.',
  },
  {
    pergunta: 'Quais convênios são aceitos?',
    resposta:
      'Atendemos particular e mais de 20 convênios, entre eles Unimed, Bradesco Saúde, Sul América, CASSI, IPSEMG, CEMIG Saúde, Saúde Caixa e Golden Cross. A lista completa está na seção de convênios desta página — e, em caso de dúvida, nossa equipe confirma na hora pelo WhatsApp.',
  },
  {
    pergunta: 'Como faço para agendar pelo WhatsApp?',
    resposta:
      'Clique em qualquer botão de WhatsApp desta página e envie a mensagem. Nossa assistente virtual apresenta os exames, mostra os horários disponíveis e confirma o agendamento em cerca de 1 minuto. Você também pode enviar a foto do seu pedido médico, que ela identifica os exames automaticamente. Se preferir falar com uma pessoa, é só pedir "atendente".',
  },
  {
    pergunta: 'O que devo levar no dia do exame?',
    resposta:
      'Documento com foto, carteirinha do convênio (se for usar), o pedido médico e, se possível, uma lista das medicações em uso. Para MAPA e Holter, venha de banho tomado — o aparelho não pode ser molhado durante as 24 horas do exame.',
  },
  {
    pergunta: 'Os exames precisam de preparo?',
    resposta:
      'Depende do exame. O ecocardiograma não exige preparo específico. Para o teste ergométrico e o cardiopulmonar, recomendamos roupa confortável para esforço físico e uma refeição leve cerca de 2 horas antes. Ao confirmar seu agendamento, enviamos pelo WhatsApp as orientações completas do seu exame.',
  },
  {
    pergunta: 'Quanto tempo leva para receber o resultado?',
    resposta:
      'O prazo varia conforme o exame realizado. Todos os laudos são elaborados e assinados por cardiologistas da clínica, e nossa equipe informa o prazo exato no dia do seu atendimento.',
  },
  {
    pergunta: 'Posso remarcar ou cancelar meu exame?',
    resposta:
      'Sim. Para cancelar ou remarcar, ligue para o telefone fixo (32) 3215-8744 em horário comercial (segunda a quinta das 8h às 18h, sexta das 8h às 17h). Pedimos que avise com antecedência para liberarmos o horário a outro paciente.',
  },
  {
    pergunta: 'Onde fica a clínica e qual o horário de funcionamento?',
    resposta:
      'Estamos na Rua Delfim Moreira, 165 — Centro, Juiz de Fora (MG). Funcionamos de segunda a quinta das 8h às 18h e sexta das 8h às 17h. Na seção de contato você encontra o mapa e o botão "Como chegar".',
  },
];
