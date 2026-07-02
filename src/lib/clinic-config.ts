import { CONTATO, CONVENIOS, EXAMES, MEDICOS } from './seed-data';
import type { Convenio, Exame, Medico } from './types';

export type ContatoConfig = {
  nomeClinica: string;
  subtitulo: string;
  cidade: string;
  endereco: string;
  bairro: string;
  enderecoCompleto: string;
  email: string;
  telefoneFixo: string;
  telefone: string;
  telefoneLink: string;
  whatsapp: string;
  whatsappDescricao: string;
  whatsappNumero: string;
  whatsappMensagem: string;
  whatsappLink: string;
  horarios: string[];
  instagram: string;
  instagramHandle: string;
  mapaQuery: string;
};

export type ExameOverride = Partial<Pick<Exame, 'nome' | 'duracaoMin' | 'preparo' | 'ativo'>>;

export interface ClinicConfigOverrides {
  exames?: Record<string, ExameOverride>;
  convenios?: Convenio[];
  contato?: Partial<ContatoConfig>;
  atualizadoEm?: string;
}

export interface ClinicConfig {
  medicos: Medico[];
  exames: Exame[];
  convenios: Convenio[];
  contato: ContatoConfig;
  editavel: boolean;
  atualizadoEm?: string;
}

const isFirestore = process.env.DATA_BACKEND === 'firestore';

async function fs() {
  const { db } = await import('./db/firestore');
  return db();
}

function mergeExames(overrides?: Record<string, ExameOverride>): Exame[] {
  if (!overrides) return [...EXAMES];
  return EXAMES.map((e) => ({ ...e, ...overrides[e.id] }));
}

function mergeContato(overrides?: Partial<ContatoConfig>): ContatoConfig {
  const base: ContatoConfig = { ...CONTATO, horarios: [...CONTATO.horarios] };
  if (!overrides) return base;
  return { ...base, ...overrides, horarios: overrides.horarios ?? base.horarios };
}

export async function carregarClinicConfig(): Promise<ClinicConfig> {
  const base: ClinicConfig = {
    medicos: [...MEDICOS],
    exames: mergeExames(),
    convenios: [...CONVENIOS],
    contato: mergeContato(),
    editavel: isFirestore,
  };

  if (!isFirestore) return base;

  try {
    const doc = await (await fs()).collection('config').doc('clinic').get();
    if (!doc.exists) return base;
    const data = doc.data() as ClinicConfigOverrides;
    return {
      medicos: [...MEDICOS],
      exames: mergeExames(data.exames),
      convenios: data.convenios?.length ? data.convenios : [...CONVENIOS],
      contato: mergeContato(data.contato),
      editavel: true,
      atualizadoEm: data.atualizadoEm,
    };
  } catch (e) {
    console.error('[clinic-config] erro ao carregar:', e);
    return base;
  }
}

export async function salvarClinicConfig(overrides: ClinicConfigOverrides): Promise<void> {
  if (!isFirestore) {
    throw new Error('Edição persistente requer DATA_BACKEND=firestore em produção.');
  }
  const payload: ClinicConfigOverrides = {
    ...overrides,
    atualizadoEm: new Date().toISOString(),
  };
  await (await fs()).collection('config').doc('clinic').set(payload, { merge: true });
}
