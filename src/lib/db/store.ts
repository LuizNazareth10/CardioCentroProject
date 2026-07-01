import bcrypt from 'bcryptjs';
import type { Agendamento, FichaMedica, Paciente, Triagem, Usuario } from '../types';
import { CONVENIOS, EXAMES } from '../seed-data';

// =============================================================
// Store em memória (modo DATA_BACKEND=memory).
// Útil para rodar local sem nuvem. Em produção, troca-se para
// Firestore (mesma interface pública em src/lib/db/index.ts).
// OBS: dados resetam ao reiniciar o servidor — é esperado.
//
// Vem PRÉ-POPULADO com pacientes e agendamentos FICTÍCIOS (do dia
// de hoje) apenas para dar uma prévia visual da área restrita.
// =============================================================

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const convId = (nome: string) => CONVENIOS.find((c) => c.nome === nome)?.id;

// ficha médica com defaults (todos os fatores em falso) + overrides
function ficha(over: Partial<FichaMedica> = {}): FichaMedica {
  return {
    hipertensao: false, diabetes: false, dislipidemia: false, tabagismo: false,
    etilismo: false, sedentarismo: false, iamPrevio: false, avcPrevio: false,
    doencaRenal: false, marcapasso: false, histFamiliarDac: false,
    histFamiliarMorteSubita: false, ...over,
  };
}

// usuário inicial: admin@cardiocentro.com / cardio123
const senhaHashAdmin = bcrypt.hashSync('cardio123', 10);

const agora = new Date().toISOString();

// ---- pacientes fictícios ----
const pacientes: Paciente[] = [
  {
    id: 'pac_maria', nome: 'Maria das Dores Silva', cpf: '123.456.789-00',
    dataNascimento: '1958-03-12', sexo: 'F', telefone: '(32) 99971-0011',
    email: 'maria.silva@email.com', endereco: 'Rua Halfeld, 100 — Centro, Juiz de Fora',
    convenioId: convId('Unimed'), carteirinha: '0099887766', criadoEm: agora, atualizadoEm: agora,
    fichaMedica: ficha({
      pesoKg: 72, alturaCm: 160, hipertensao: true, dislipidemia: true, sedentarismo: true,
      histFamiliarDac: true, medicacoesEmUso: 'Losartana 50mg 1x/dia; Sinvastatina 20mg à noite',
      alergias: 'Dipirona', cirurgiasPrevias: 'Colecistectomia (2015)',
      queixaPrincipal: 'Acompanhamento de hipertensão',
    }),
  },
  {
    id: 'pac_joao', nome: 'João Batista Ferreira', cpf: '234.567.890-11',
    dataNascimento: '1949-07-25', sexo: 'M', telefone: '(32) 99962-2233',
    email: 'joao.ferreira@email.com', endereco: 'Av. Rio Branco, 2300 — Centro, Juiz de Fora',
    convenioId: convId('IPSEMG'), carteirinha: '1122334455', criadoEm: agora, atualizadoEm: agora,
    fichaMedica: ficha({
      pesoKg: 84, alturaCm: 172, hipertensao: true, diabetes: true, iamPrevio: true,
      medicacoesEmUso: 'AAS 100mg; Metformina 850mg 2x/dia; Atenolol 25mg',
      queixaPrincipal: 'Revisão pós-infarto', observacoesGerais: 'Angioplastia em 2021.',
    }),
  },
  {
    id: 'pac_rosangela', nome: 'Rosângela Aparecida Lima', cpf: '345.678.901-22',
    dataNascimento: '1966-11-03', sexo: 'F', telefone: '(32) 99953-4455',
    convenioId: convId('CASSI'), criadoEm: agora, atualizadoEm: agora,
    fichaMedica: ficha({
      pesoKg: 68, alturaCm: 158, hipertensao: true,
      queixaPrincipal: 'MAPA para investigar hipertensão do avental branco',
    }),
  },
  {
    id: 'pac_sebastiao', nome: 'Sebastião Pereira Gomes', cpf: '456.789.012-33',
    dataNascimento: '1972-01-19', sexo: 'M', telefone: '(32) 99944-5566',
    convenioId: convId('Particular'), criadoEm: agora, atualizadoEm: agora,
    fichaMedica: ficha({
      pesoKg: 91, alturaCm: 178, sedentarismo: true, tabagismo: true,
      queixaPrincipal: 'Avaliação para início de atividade física',
    }),
  },
  {
    id: 'pac_claudia', nome: 'Cláudia Regina Santos', cpf: '567.890.123-44',
    dataNascimento: '1985-05-30', sexo: 'F', telefone: '(32) 99935-6677',
    email: 'claudia.santos@email.com', convenioId: convId('Bradesco'),
    criadoEm: agora, atualizadoEm: agora,
    fichaMedica: ficha({ pesoKg: 64, alturaCm: 165, queixaPrincipal: 'Palpitações ocasionais' }),
  },
  {
    id: 'pac_geraldo', nome: 'Geraldo Magela Costa', cpf: '678.901.234-55',
    dataNascimento: '1954-09-08', sexo: 'M', telefone: '(32) 99926-7788',
    convenioId: convId('CEMIG Saúde'), criadoEm: agora, atualizadoEm: agora,
    fichaMedica: ficha({
      pesoKg: 79, alturaCm: 170, hipertensao: true, dislipidemia: true, avcPrevio: true,
      queixaPrincipal: 'Duplex de carótidas de rotina',
    }),
  },
  {
    id: 'pac_vera', nome: 'Vera Lúcia Andrade', cpf: '789.012.345-66',
    dataNascimento: '1961-02-14', sexo: 'F', telefone: '(32) 99917-8899',
    email: 'vera.andrade@email.com', convenioId: convId('Sul América'),
    criadoEm: agora, atualizadoEm: agora,
    fichaMedica: ficha({ pesoKg: 70, alturaCm: 162, queixaPrincipal: 'Holter por episódios de taquicardia' }),
  },
  {
    id: 'pac_antonio', nome: 'Antônio Carlos Moura', cpf: '890.123.456-77',
    dataNascimento: '1978-12-22', sexo: 'M', telefone: '(32) 99908-9900',
    convenioId: convId('AMAGIS'), criadoEm: agora, atualizadoEm: agora,
    fichaMedica: ficha({ pesoKg: 88, alturaCm: 181, dislipidemia: true, queixaPrincipal: 'Primeira consulta cardiológica' }),
  },
];

// ---- agendamentos fictícios do dia de hoje ----
function hojeJF(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function slot(hhmm: string, exameId: string): { inicio: string; fim: string } {
  const dur = EXAMES.find((e) => e.id === exameId)?.duracaoMin ?? 30;
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + dur;
  const fh = String(Math.floor(total / 60)).padStart(2, '0');
  const fm = String(total % 60).padStart(2, '0');
  const dia = hojeJF();
  return { inicio: `${dia}T${hhmm}:00-03:00`, fim: `${dia}T${fh}:${fm}:00-03:00` };
}

type SeedAg = {
  pacienteId: string; pacienteNome: string; medicoId: string; exameId: string;
  convenioId?: string; hora: string; status: Agendamento['status']; origem: Agendamento['origem'];
};

const seedAgs: SeedAg[] = [
  { pacienteId: 'pac_joao', pacienteNome: 'João Batista Ferreira', medicoId: 'med-6', exameId: 'consulta', convenioId: convId('IPSEMG'), hora: '07:30', status: 'realizado', origem: 'sistema' },
  { pacienteId: 'pac_maria', pacienteNome: 'Maria das Dores Silva', medicoId: 'med-1', exameId: 'eco-doppler', convenioId: convId('Unimed'), hora: '08:00', status: 'confirmado', origem: 'whatsapp' },
  { pacienteId: 'pac_rosangela', pacienteNome: 'Rosângela Aparecida Lima', medicoId: 'med-3', exameId: 'mapa', convenioId: convId('CASSI'), hora: '08:30', status: 'agendado', origem: 'sistema' },
  { pacienteId: 'pac_geraldo', pacienteNome: 'Geraldo Magela Costa', medicoId: 'med-6', exameId: 'duplex-carotidas', convenioId: convId('CEMIG Saúde'), hora: '09:00', status: 'confirmado', origem: 'sistema' },
  { pacienteId: 'pac_claudia', pacienteNome: 'Cláudia Regina Santos', medicoId: 'med-1', exameId: 'consulta', convenioId: convId('Bradesco'), hora: '09:30', status: 'agendado', origem: 'whatsapp' },
  { pacienteId: 'pac_sebastiao', pacienteNome: 'Sebastião Pereira Gomes', medicoId: 'med-4', exameId: 'ergometrico', convenioId: convId('Particular'), hora: '10:00', status: 'agendado', origem: 'sistema' },
  { pacienteId: 'pac_vera', pacienteNome: 'Vera Lúcia Andrade', medicoId: 'med-2', exameId: 'holter', convenioId: convId('Sul América'), hora: '13:30', status: 'agendado', origem: 'whatsapp' },
  { pacienteId: 'pac_antonio', pacienteNome: 'Antônio Carlos Moura', medicoId: 'med-5', exameId: 'consulta', convenioId: convId('AMAGIS'), hora: '14:00', status: 'agendado', origem: 'sistema' },
  { pacienteId: 'pac_maria', pacienteNome: 'Maria das Dores Silva', medicoId: 'med-5', exameId: 'ecg', convenioId: convId('Unimed'), hora: '15:00', status: 'agendado', origem: 'sistema' },
];

const agendamentos: Agendamento[] = seedAgs.map((a) => {
  const { inicio, fim } = slot(a.hora, a.exameId);
  return {
    id: uid('ag'), pacienteId: a.pacienteId, pacienteNome: a.pacienteNome,
    medicoId: a.medicoId, exameId: a.exameId, convenioId: a.convenioId ?? 'particular',
    inicio, fim, status: a.status, origem: a.origem, criadoEm: agora,
  };
});

export const memoria = {
  usuarios: [
    {
      id: 'user_admin',
      nome: 'Recepção Cardiocentro',
      email: 'admin@cardiocentro.com',
      papel: 'admin',
      senhaHash: senhaHashAdmin,
      ativo: true,
    },
  ] as Usuario[],

  pacientes,
  agendamentos,
  triagens: [] as Triagem[],
};

export const novoId = uid;
