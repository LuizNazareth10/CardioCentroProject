import {
  Activity,
  Bike,
  Clock,
  Gauge,
  HeartPulse,
  ScanHeart,
  Scissors,
  Stethoscope,
  Waves,
} from 'lucide-react';
import { CONVENIOS, CONTATO, linkWhatsapp } from '@/lib/seed-data';

export const contato = CONTATO;
export { linkWhatsapp };
export const whatsappLink = CONTATO.whatsappLink;

export const brandAssets = {
  logo: '/img/CardiocentroLogo.jpeg',
  examesList: '/img/ExamesList.jpeg',
};

// Fotos reais da clínica (public/img) — fachada, recepção e salas de exame.
export const photos = {
  hero: '/img/clinica-fachada-entrada.jpg',
  about: '/img/clinica-recepcao.jpg',
  aboutSecondary: '/img/clinica-sala-espera.jpg',
  cta: '/img/clinica-fachada-entrada.jpg',
};

// Galeria "Conheça nossa estrutura" — mosaico com o restante do acervo real.
export const structurePhotos = {
  patio: {
    src: '/img/clinica-patio-exames.jpg',
    alt: 'Pátio interno e área de exames da Cardiocentro, com bancos e jardim',
    label: 'Área externa de exames',
  },
  fachada: {
    src: '/img/clinica-fachada-detalhe.jpg',
    alt: 'Detalhe da fachada da Cardiocentro com a marca em destaque',
    label: 'Nossa fachada',
  },
  ecocardiograma: {
    src: '/img/clinica-sala-ecocardiograma.jpg',
    alt: 'Sala equipada para realização de ecocardiograma',
    label: 'Sala de Ecocardiograma',
  },
  ergometrico: {
    src: '/img/clinica-sala-ergometrico.jpg',
    alt: 'Sala equipada para teste ergométrico, com esteira e monitoramento',
    label: 'Sala de Teste Ergométrico',
  },
  salaExame: {
    src: '/img/clinica-sala-exame.jpg',
    alt: 'Sala de exames da Cardiocentro, limpa e climatizada',
    label: 'Sala de Exames',
  },
};

// Catálogo completo conforme material oficial (ExamesList.jpeg).
export const services = [
  {
    icon: Stethoscope,
    title: 'Consulta Cardiológica',
    desc: 'Avaliação clínica completa com cardiologista, histórico e plano de cuidado personalizado.',
    bookable: false,
  },
  {
    icon: Activity,
    title: 'Eletrocardiograma (ECG)',
    desc: 'Registro da atividade elétrica do coração para investigar arritmias e outras alterações.',
    bookable: false,
  },
  {
    icon: Scissors,
    title: 'Risco Cirúrgico',
    desc: 'Avaliação cardiovascular pré-operatória para orientar procedimentos com segurança.',
    bookable: false,
  },
  {
    icon: ScanHeart,
    title: 'Ecocardiograma com Doppler Colorido/Ecocardiograma Transtorácico',
    desc: 'Ultrassom do coração com imagem de alta definição para avaliar estrutura e função cardíaca.',
    bookable: true,
  },
  {
    icon: Waves,
    title: 'Duplex Scan de Carótidas e Vertebrais',
    desc: 'Ultrassom com Doppler das artérias carótidas e vertebrais para avaliar o fluxo sanguíneo.',
    bookable: true,
  },
  {
    icon: Bike,
    title: 'Teste Ergométrico Computadorizado',
    desc: 'Avaliação do coração sob esforço físico controlado, com acompanhamento médico integral.',
    bookable: true,
  },
  {
    icon: HeartPulse,
    title: 'Teste Cardiopulmonar',
    desc: 'Análise integrada do coração, pulmões e músculos durante o esforço, com precisão máxima.',
    bookable: true,
  },
  {
    icon: Clock,
    title: 'Holter 24h',
    desc: 'Monitoramento contínuo do ritmo cardíaco ao longo de 24 horas para detectar arritmias.',
    bookable: true,
  },
  {
    icon: Gauge,
    title: 'MAPA 24h',
    desc: 'Medição da pressão arterial ao longo de 24 horas para diagnóstico preciso da hipertensão.',
    bookable: true,
  },
];

export const doctors = [
  { name: 'Dr. Ricardo Daher' },
  { name: 'Dr. Paulo Zorzo' },
  { name: 'Dr. Júlio Lovisi' },
  { name: 'Dra. Fernanda Lanzoni' },
  { name: 'Dra. Sonielle Albertino' },
  { name: 'Dr. Pedro Paulo de Oliveira' },
  { name: 'Dr. Vagner Campos' },
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
  { label: 'Corpo\u00A0Clínico', href: '#corpo-clinico' },
  { label: 'Preparo', href: '#preparo' },
  { label: 'Contato', href: '#agendamento' },
];

export const examesAgendamento = services.map((s) => s.title);

// Convênios exibidos na landing — derivados da fonte única (seed-data),
// sempre em sincronia com a área restrita. "Particular" fica implícito
// no título da seção.
export const conveniosAceitos = CONVENIOS.filter((c) => c.ativo && c.nome !== 'Particular').map(
  (c) => c.nome,
);

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
      'Clique em qualquer botão de WhatsApp desta página e envie a mensagem. Nossa assistente apresenta os exames e mostra os horários disponíveis para você escolher. Você também pode enviar a foto do seu pedido médico, que ela identifica os exames automaticamente. Se preferir falar com uma pessoa, é só pedir "atendente".',
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
