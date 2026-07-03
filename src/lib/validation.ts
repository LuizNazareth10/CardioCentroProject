import type { FichaMedica, Paciente, Sexo } from './types';

/**
 * Erro de validação de ENTRADA DO USUÁRIO — seguro para exibir ao cliente.
 * Qualquer outro erro (Firestore, credenciais, etc.) deve ser logado no
 * servidor e retornar uma mensagem genérica, nunca `.message` bruto.
 */
export class ValidationError extends Error {}

// =============================================================
// Validação e sanitização de entradas (defesa antes de gravar).
// Faixas clínicas plausíveis — rejeita valores absurdos digitados
// por engano (ex.: PA 400/200, FC 0, SatO₂ 110%).
// =============================================================

export const LIMITES = {
  paSistolica: [50, 300],
  paDiastolica: [30, 200],
  frequenciaCardiaca: [20, 260],
  saturacao: [50, 100],
  pesoKg: [1, 400],
  alturaCm: [30, 250],
  temperatura: [30, 45],
} as const;

function foraDaFaixa(valor: unknown, [min, max]: readonly [number, number]): boolean {
  return typeof valor === 'number' && Number.isFinite(valor) && (valor < min || valor > max);
}

/** valida os sinais vitais de uma triagem; retorna lista de erros legíveis */
export function validarTriagem(d: Record<string, unknown>): string[] {
  const erros: string[] = [];
  const checa = (campo: keyof typeof LIMITES, rotulo: string) => {
    if (foraDaFaixa(d[campo], LIMITES[campo])) {
      erros.push(`${rotulo} fora da faixa (${LIMITES[campo][0]}–${LIMITES[campo][1]}).`);
    }
  };
  checa('paSistolica', 'PA sistólica');
  checa('paDiastolica', 'PA diastólica');
  checa('frequenciaCardiaca', 'Frequência cardíaca');
  checa('saturacao', 'Saturação');
  checa('pesoKg', 'Peso');
  if (
    typeof d.paSistolica === 'number' && typeof d.paDiastolica === 'number' &&
    d.paDiastolica >= d.paSistolica
  ) {
    erros.push('PA diastólica deve ser menor que a sistólica.');
  }
  return erros;
}

const str = (v: unknown, max = 500): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

const num = (v: unknown, faixa: readonly [number, number]): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= faixa[0] && n <= faixa[1] ? n : undefined;
};

const bool = (v: unknown): boolean => v === true;

export function sanitizarFicha(raw: Record<string, unknown> = {}): FichaMedica {
  return {
    pesoKg: num(raw.pesoKg, LIMITES.pesoKg),
    alturaCm: num(raw.alturaCm, LIMITES.alturaCm),
    hipertensao: bool(raw.hipertensao),
    diabetes: bool(raw.diabetes),
    dislipidemia: bool(raw.dislipidemia),
    tabagismo: bool(raw.tabagismo),
    etilismo: bool(raw.etilismo),
    sedentarismo: bool(raw.sedentarismo),
    iamPrevio: bool(raw.iamPrevio),
    avcPrevio: bool(raw.avcPrevio),
    doencaRenal: bool(raw.doencaRenal),
    marcapasso: bool(raw.marcapasso),
    histFamiliarDac: bool(raw.histFamiliarDac),
    histFamiliarMorteSubita: bool(raw.histFamiliarMorteSubita),
    medicacoesEmUso: str(raw.medicacoesEmUso, 2000),
    alergias: str(raw.alergias, 1000),
    cirurgiasPrevias: str(raw.cirurgiasPrevias, 2000),
    queixaPrincipal: str(raw.queixaPrincipal, 1000),
    observacoesGerais: str(raw.observacoesGerais, 2000),
  };
}

export type PacienteEntrada = Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>;

/**
 * Sanitiza os dados de cadastro de paciente: whitelist de campos, trim,
 * limites de tamanho e faixas numéricas. Lança Error se faltar nome/telefone.
 */
/** Cadastro mínimo para agendamento pela recepção (ficha médica vem depois). */
export function sanitizarPacienteAgendamento(raw: Record<string, unknown>): PacienteEntrada {
  const nome = str(raw.nome, 120);
  const telefone = str(raw.telefone, 30);
  const dataNascimento = str(raw.dataNascimento, 10);
  const convenioId = str(raw.convenioId, 60);
  if (!nome) throw new ValidationError('Nome é obrigatório.');
  if (!telefone) throw new ValidationError('Telefone é obrigatório.');
  if (!dataNascimento) throw new ValidationError('Data de nascimento é obrigatória.');
  if (!convenioId) throw new ValidationError('Convênio é obrigatório.');
  const sexo = raw.sexo === 'M' || raw.sexo === 'F' || raw.sexo === 'O' ? (raw.sexo as Sexo) : undefined;
  return {
    nome,
    telefone,
    dataNascimento,
    convenioId,
    cpf: str(raw.cpf, 20),
    sexo,
    email: str(raw.email, 120),
    endereco: str(raw.endereco, 200),
    carteirinha: str(raw.carteirinha, 60),
    fichaMedica: sanitizarFicha({}),
  };
}

export function sanitizarPaciente(raw: Record<string, unknown>): PacienteEntrada {
  const nome = str(raw.nome, 120);
  const telefone = str(raw.telefone, 30);
  if (!nome || !telefone) throw new ValidationError('Nome e telefone são obrigatórios.');
  const sexo = raw.sexo === 'M' || raw.sexo === 'F' || raw.sexo === 'O' ? (raw.sexo as Sexo) : undefined;
  return {
    nome,
    telefone,
    cpf: str(raw.cpf, 20),
    dataNascimento: str(raw.dataNascimento, 10),
    sexo,
    email: str(raw.email, 120),
    endereco: str(raw.endereco, 200),
    convenioId: str(raw.convenioId, 60),
    carteirinha: str(raw.carteirinha, 60),
    fichaMedica: sanitizarFicha((raw.fichaMedica ?? {}) as Record<string, unknown>),
  };
}

/** Atualização parcial de cadastro / antropometria na ficha de identidade. */
export function sanitizarPacientePatch(raw: Record<string, unknown>): Partial<PacienteEntrada> {
  const patch: Partial<PacienteEntrada> = {};
  if ('cpf' in raw) {
    const cpf = str(raw.cpf, 20);
    if (cpf !== undefined) patch.cpf = cpf;
  }
  if ('dataNascimento' in raw) {
    const dataNascimento = str(raw.dataNascimento, 10);
    if (dataNascimento !== undefined) patch.dataNascimento = dataNascimento;
  }
  if ('sexo' in raw) {
    patch.sexo = raw.sexo === 'M' || raw.sexo === 'F' || raw.sexo === 'O' ? (raw.sexo as Sexo) : undefined;
  }
  if ('telefone' in raw) {
    const telefone = str(raw.telefone, 30);
    if (telefone) patch.telefone = telefone;
  }
  if ('email' in raw) {
    const email = str(raw.email, 120);
    if (email !== undefined) patch.email = email;
  }
  if ('endereco' in raw) {
    const endereco = str(raw.endereco, 200);
    if (endereco !== undefined) patch.endereco = endereco;
  }
  if ('carteirinha' in raw) {
    const carteirinha = str(raw.carteirinha, 60);
    if (carteirinha !== undefined) patch.carteirinha = carteirinha;
  }
  if ('convenioId' in raw) {
    const convenioId = str(raw.convenioId, 60);
    if (convenioId !== undefined) patch.convenioId = convenioId;
  }
  if (raw.fichaMedica && typeof raw.fichaMedica === 'object') {
    const fm = raw.fichaMedica as Record<string, unknown>;
    const pesoKg = num(fm.pesoKg, LIMITES.pesoKg);
    const alturaCm = num(fm.alturaCm, LIMITES.alturaCm);
    const antro: Partial<FichaMedica> = {};
    if (pesoKg !== undefined) antro.pesoKg = pesoKg;
    if (alturaCm !== undefined) antro.alturaCm = alturaCm;
    if (Object.keys(antro).length > 0) patch.fichaMedica = antro as FichaMedica;
  }
  return patch;
}
