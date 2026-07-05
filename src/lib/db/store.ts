import bcrypt from 'bcryptjs';
import type { Agendamento, Conversa, FichaMedica, Lead, Paciente, TipoAparelho, Triagem, Usuario } from '../types';
import { APARELHOS, CONVENIOS, EXAMES, MEDICOS } from '../seed-data';
import { hhmmToMin, semanaQuinzenalAtiva } from '../scheduling/time';

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
// Gerados dinamicamente a partir das janelas/aparelhos REAIS ativos hoje,
// para o painel e a agenda ficarem sempre coerentes com a grade do dia.
function hojeJF(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const HOJE = hojeJF();
const WD = new Date(`${HOJE}T12:00:00Z`).getUTCDay();
const SEMANA_ATIVA = semanaQuinzenalAtiva(HOJE);

function isoDeHoje(minutos: number): string {
  const hh = String(Math.floor(minutos / 60)).padStart(2, '0');
  const mm = String(minutos % 60).padStart(2, '0');
  return `${HOJE}T${hh}:${mm}:00-03:00`;
}

const statuses: Agendamento['status'][] = ['confirmado', 'agendado', 'realizado', 'agendado'];
const pacientesFake = pacientes.map((p) => ({ id: p.id, nome: p.nome, convenioId: p.convenioId }));

const agendamentos: Agendamento[] = [];
let idx = 0;
function proximoPaciente() {
  const p = pacientesFake[idx % pacientesFake.length];
  idx += 1;
  return p;
}

// 1) até 2 agendamentos por médico ativo hoje (respeita quinzenal)
for (const m of MEDICOS.filter((x) => x.ativo)) {
  const janelas = m.disponibilidade.filter((j) => j.weekday === WD && (!j.quinzenal || SEMANA_ATIVA));
  if (janelas.length === 0) continue;
  const j = janelas[0];
  const exIds = j.exames ?? m.examesHabilitados;
  let cursor = hhmmToMin(j.inicio);
  const fim = hhmmToMin(j.fim);
  for (let n = 0; n < 2; n++) {
    const exameId = exIds[n % exIds.length];
    const dur = m.duracoes?.[exameId] ?? EXAMES.find((e) => e.id === exameId)?.duracaoMin ?? 15;
    if (cursor + dur > fim) break;
    const pac = proximoPaciente();
    agendamentos.push({
      id: uid('ag'), pacienteId: pac.id, pacienteNome: pac.nome,
      medicoId: m.id, exameId, convenioId: pac.convenioId ?? 'particular',
      inicio: isoDeHoje(cursor), fim: isoDeHoje(cursor + dur),
      status: statuses[(idx + n) % statuses.length], origem: n % 2 === 0 ? 'sistema' : 'whatsapp',
      criadoEm: agora,
    });
    cursor += dur + 15; // deixa um vão livre entre eles
  }
}

// 2) alguns agendamentos de aparelho (Mapa/Holter) nos slots de hoje
for (const tipo of ['mapa', 'holter'] as TipoAparelho[]) {
  const cfg = APARELHOS[tipo];
  const horarios = WD === 5 || WD === 0 || WD === 6 ? [] : cfg.slots[WD as 1 | 2 | 3 | 4] ?? [];
  horarios.slice(0, 2).forEach((hhmm, n) => {
    const t = hhmmToMin(hhmm);
    const pac = proximoPaciente();
    agendamentos.push({
      id: uid('ag'), pacienteId: pac.id, pacienteNome: pac.nome,
      medicoId: tipo, exameId: cfg.exameId, convenioId: pac.convenioId ?? 'particular',
      inicio: isoDeHoje(t), fim: isoDeHoje(t + cfg.duracaoMin),
      status: n === 0 ? 'confirmado' : 'agendado', origem: n % 2 === 0 ? 'whatsapp' : 'sistema',
      criadoEm: agora,
    });
  });
}

// ---- leads fictícios (prévia visual do painel /leads) ----
const leads: Lead[] = [
  {
    id: 'lead_demo1', nome: 'Fernanda Oliveira', telefone: '(32) 98811-2233',
    email: 'fernanda.o@email.com', exameInteresse: 'Ecocardiograma com Doppler Colorido',
    mensagem: 'Tenho pedido médico, prefiro de manhã.', turnoPreferencial: 'manha',
    origem: 'formulario', status: 'novo', temperatura: 'morno',
    criadoEm: agora, atualizadoEm: agora,
  },
  {
    id: 'lead_demo2', nome: 'Roberto Cunha', telefone: '(32) 98822-3344',
    exameInteresse: 'Holter 24h', origem: 'whatsapp', status: 'agendado',
    temperatura: 'quente', criadoEm: agora, atualizadoEm: agora,
  },
];

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
  conversas: [] as Conversa[],
  leads,
};

export const novoId = uid;
