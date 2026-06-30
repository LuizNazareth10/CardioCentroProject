import bcrypt from 'bcryptjs';
import type { Agendamento, Paciente, Triagem, Usuario } from '../types';
import { CONVENIOS } from '../seed-data';

// =============================================================
// Store em memória (modo DATA_BACKEND=memory).
// Útil para rodar local sem nuvem. Em produção, troca-se para
// Firestore (mesma interface pública em src/lib/db/index.ts).
// OBS: dados resetam ao reiniciar o servidor — é esperado.
// =============================================================

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// usuário inicial: admin@cardiocentro.com / cardio123
const senhaHashAdmin = bcrypt.hashSync('cardio123', 10);

export const memoria = {
  usuarios: [
    {
      id: 'user_admin',
      nome: 'Recepção CardioCentro',
      email: 'admin@cardiocentro.com',
      papel: 'admin',
      senhaHash: senhaHashAdmin,
      ativo: true,
    },
  ] as Usuario[],

  pacientes: [
    {
      id: 'pac_demo',
      nome: 'Maria das Dores Silva',
      cpf: '123.456.789-00',
      dataNascimento: '1958-03-12',
      sexo: 'F',
      telefone: '(32) 99999-0000',
      email: 'maria@email.com',
      endereco: 'Rua Halfeld, 100 — Centro, Juiz de Fora',
      convenioId: CONVENIOS.find((c) => c.nome === 'Unimed')?.id,
      carteirinha: '0099887766',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      fichaMedica: {
        pesoKg: 72,
        alturaCm: 160,
        hipertensao: true,
        diabetes: false,
        dislipidemia: true,
        tabagismo: false,
        etilismo: false,
        sedentarismo: true,
        iamPrevio: false,
        avcPrevio: false,
        doencaRenal: false,
        marcapasso: false,
        histFamiliarDac: true,
        histFamiliarMorteSubita: false,
        medicacoesEmUso: 'Losartana 50mg 1x/dia; Sinvastatina 20mg à noite',
        alergias: 'Dipirona',
        cirurgiasPrevias: 'Colecistectomia (2015)',
        queixaPrincipal: 'Acompanhamento de hipertensão',
        observacoesGerais: '',
      },
    },
  ] as Paciente[],

  agendamentos: [] as Agendamento[],
  triagens: [] as Triagem[],
};

export const novoId = uid;
