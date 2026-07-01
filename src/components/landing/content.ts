import {
  HeartPulse,
  Activity,
  Stethoscope,
  Waves,
  ScanHeart,
  Gauge,
  ShieldCheck,
  Clock,
  Users,
  Award,
} from 'lucide-react';
import { MEDICOS, CONTATO, linkWhatsapp } from '@/lib/seed-data';

// Contato e helpers de WhatsApp compartilhados com a área restrita.
export const contato = CONTATO;
export { linkWhatsapp };
export const whatsappLink = CONTATO.whatsappLink;

const IMG = 'https://images.unsplash.com/';
const q = (id: string, w = 1200) =>
  `${IMG}${id}?auto=format&fit=crop&q=80&w=${w}`;

export const photos = {
  hero: q('photo-1622253692010-333f2da6031d', 1400), // médica sorrindo
  heroSecondary: q('photo-1584982751601-97dcc096659c', 900), // cuidado/atendimento
  about: q('photo-1631217868264-e5b90bb7e133', 1200), // equipe médica
  aboutPortrait: q('photo-1594824476967-48c8b964273f', 900), // médica retrato
  cta: q('photo-1579684385127-1ef15d508118', 1400), // consulta
};

export const stats = [
  { value: '25+', label: 'anos cuidando de corações', icon: Award },
  { value: '80mil', label: 'pacientes atendidos', icon: Users },
  { value: '6', label: 'cardiologistas especialistas', icon: Stethoscope },
  { value: '98%', label: 'satisfação dos pacientes', icon: HeartPulse },
];

export const services = [
  {
    icon: ScanHeart,
    title: 'Ecocardiograma',
    desc: 'Ultrassom do coração com imagem de alta definição para avaliar estrutura e função cardíaca.',
  },
  {
    icon: Activity,
    title: 'Eletrocardiograma',
    desc: 'Registro rápido e indolor da atividade elétrica do coração, com laudo no mesmo dia.',
  },
  {
    icon: Gauge,
    title: 'Teste Ergométrico',
    desc: 'Avaliação do coração sob esforço físico controlado, com acompanhamento médico integral.',
  },
  {
    icon: Waves,
    title: 'Holter 24h',
    desc: 'Monitoramento contínuo do ritmo cardíaco ao longo do dia para detectar arritmias.',
  },
  {
    icon: HeartPulse,
    title: 'MAPA 24h',
    desc: 'Medição da pressão arterial ao longo de 24 horas para diagnóstico preciso da hipertensão.',
  },
  {
    icon: Stethoscope,
    title: 'Consulta Cardiológica',
    desc: 'Avaliação clínica completa com cardiologistas experientes e escuta atenta.',
  },
];

export const differentials = [
  {
    icon: ShieldCheck,
    title: 'Precisão diagnóstica',
    desc: 'Equipamentos de última geração e laudos revisados por especialistas.',
  },
  {
    icon: Clock,
    title: 'Agilidade no atendimento',
    desc: 'Agendamento simples e resultados entregues com rapidez e clareza.',
  },
  {
    icon: HeartPulse,
    title: 'Cuidado humano',
    desc: 'Cada paciente é acolhido com empatia, do primeiro contato ao acompanhamento.',
  },
];

// Derivado da fonte única (src/lib/seed-data.ts) — os 6 médicos ficam
// sincronizados entre a landing e a área restrita.
export const doctors = MEDICOS.filter((m) => m.ativo).map((m) => ({
  name: m.nome,
  role: m.especialidade ?? 'Cardiologista',
  crm: m.crm,
  photo: m.foto ?? q('photo-1559839734-2b71ea197ec2', 700),
}));

export const testimonials = [
  {
    quote:
      'Fui acolhida do começo ao fim. O exame foi rápido e a médica explicou cada detalhe com calma. Saí tranquila e bem cuidada.',
    name: 'Marina Costa',
    role: 'Paciente · Juiz de Fora',
    avatar: q('photo-1494790108377-be9c29b29330', 200),
  },
  {
    quote:
      'Marquei pelo site em minutos e fui atendido no horário. Estrutura impecável e uma equipe que realmente se importa.',
    name: 'Carlos Eduardo',
    role: 'Paciente · Juiz de Fora',
    avatar: q('photo-1500648767791-00dcc994a43e', 200),
  },
  {
    quote:
      'Meu pai é hipertenso e o acompanhamento aqui mudou a rotina dele. Profissionalismo e carinho na medida certa.',
    name: 'Juliana Prado',
    role: 'Acompanhante',
    avatar: q('photo-1438761681033-6461ffad8d80', 200),
  },
];

export const nav = [
  { label: 'Especialidades', href: '#especialidades' },
  { label: 'A clínica', href: '#sobre' },
  { label: 'Corpo médico', href: '#corpo-medico' },
  { label: 'Depoimentos', href: '#depoimentos' },
  { label: 'Contato', href: '#agendamento' },
];
