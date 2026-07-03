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
import { MEDICOS, CONTATO, linkWhatsapp } from '@/lib/seed-data';

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
  { label: 'Contato', href: '#agendamento' },
];

export const examesAgendamento = services.map((s) => s.title);
