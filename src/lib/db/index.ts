import type { Agendamento, Conversa, Lead, MensagemConversa, Paciente, StatusAtendimento, Triagem, Usuario } from '../types';
import { sanitizarFicha } from '../validation';
import { memoria, novoId } from './store';

// =============================================================
// API ÚNICA DE DADOS usada por toda a aplicação.
// Implementação atual: memória (dev/demo). Para produção, cada
// função tem o equivalente Firestore comentado/derivável a partir
// de ./firestore. Mantemos a MESMA assinatura para troca limpa.
// =============================================================

const isFirestore = process.env.DATA_BACKEND === 'firestore';

// ---- helper firestore (lazy import p/ não quebrar no modo memory) ----
async function fs() {
  const { db } = await import('./firestore');
  return db();
}

// ============== PACIENTES ==============
export async function listarPacientes(busca?: string): Promise<Paciente[]> {
  if (isFirestore) {
    const snap = await (await fs()).collection('pacientes').orderBy('nome').get();
    let arr = snap.docs.map((d) => d.data() as Paciente);
    if (busca) arr = filtrarPacientes(arr, busca);
    return arr;
  }
  return filtrarPacientes(memoria.pacientes, busca);
}

function filtrarPacientes(arr: Paciente[], busca?: string) {
  if (!busca) return arr;
  const q = busca.toLowerCase();
  return arr.filter(
    (p) =>
      p.nome.toLowerCase().includes(q) ||
      (p.cpf ?? '').includes(busca) ||
      p.telefone.includes(busca),
  );
}

export async function obterPaciente(id: string): Promise<Paciente | null> {
  if (isFirestore) {
    const doc = await (await fs()).collection('pacientes').doc(id).get();
    return doc.exists ? (doc.data() as Paciente) : null;
  }
  return memoria.pacientes.find((p) => p.id === id) ?? null;
}

export async function criarPaciente(
  dados: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>,
): Promise<Paciente> {
  const agora = new Date().toISOString();
  const paciente: Paciente = { ...dados, id: novoId('pac'), criadoEm: agora, atualizadoEm: agora };
  if (isFirestore) {
    await (await fs()).collection('pacientes').doc(paciente.id).set(paciente);
  } else {
    memoria.pacientes.push(paciente);
  }
  return paciente;
}

export async function atualizarPaciente(id: string, patch: Partial<Paciente>): Promise<Paciente | null> {
  const atual = await obterPaciente(id);
  if (!atual) return null;
  const limpo = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Partial<Paciente>;
  const fichaBase = atual.fichaMedica ?? sanitizarFicha({});
  const novo: Paciente = {
    ...atual,
    ...limpo,
    fichaMedica: limpo.fichaMedica ? { ...fichaBase, ...limpo.fichaMedica } : fichaBase,
    atualizadoEm: new Date().toISOString(),
  };
  if (isFirestore) {
    await (await fs()).collection('pacientes').doc(id).set(novo, { merge: true });
  } else {
    const i = memoria.pacientes.findIndex((p) => p.id === id);
    if (i >= 0) memoria.pacientes[i] = novo;
  }
  return novo;
}

// ============== AGENDAMENTOS ==============
export async function listarAgendamentos(filtro?: {
  de?: string;
  ate?: string;
  pacienteId?: string;
}): Promise<Agendamento[]> {
  let arr: Agendamento[];
  if (isFirestore) {
    const snap = await (await fs()).collection('agendamentos').orderBy('inicio').get();
    arr = snap.docs.map((d) => d.data() as Agendamento);
  } else {
    arr = [...memoria.agendamentos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  }
  if (filtro?.de) arr = arr.filter((a) => a.inicio >= filtro.de!);
  if (filtro?.ate) arr = arr.filter((a) => a.inicio <= filtro.ate!);
  if (filtro?.pacienteId) arr = arr.filter((a) => a.pacienteId === filtro.pacienteId);
  return arr;
}

export async function criarAgendamentos(itens: Omit<Agendamento, 'id' | 'criadoEm'>[]): Promise<Agendamento[]> {
  const grupoId = itens.length > 1 ? novoId('grp') : undefined;
  const criados = itens.map((it) => ({
    ...it,
    id: novoId('ag'),
    grupoId: it.grupoId ?? grupoId,
    criadoEm: new Date().toISOString(),
  }));
  if (isFirestore) {
    const batch = (await fs()).batch();
    const col = (await fs()).collection('agendamentos');
    criados.forEach((c) => batch.set(col.doc(c.id), c));
    await batch.commit();
  } else {
    memoria.agendamentos.push(...criados);
  }
  return criados;
}

export async function atualizarAgendamento(id: string, patch: Partial<Agendamento>): Promise<void> {
  if (isFirestore) {
    await (await fs()).collection('agendamentos').doc(id).set(patch, { merge: true });
  } else {
    const i = memoria.agendamentos.findIndex((a) => a.id === id);
    if (i >= 0) memoria.agendamentos[i] = { ...memoria.agendamentos[i], ...patch };
  }
}

// ============== TRIAGENS ==============
export async function listarTriagens(pacienteId: string): Promise<Triagem[]> {
  if (isFirestore) {
    const snap = await (await fs())
      .collection('triagens')
      .where('pacienteId', '==', pacienteId)
      .get();
    return snap.docs.map((d) => d.data() as Triagem).sort((a, b) => b.data.localeCompare(a.data));
  }
  return memoria.triagens
    .filter((t) => t.pacienteId === pacienteId)
    .sort((a, b) => b.data.localeCompare(a.data));
}

export async function criarTriagem(dados: Omit<Triagem, 'id'>): Promise<Triagem> {
  const triagem: Triagem = { ...dados, id: novoId('tri') };
  if (isFirestore) {
    await (await fs()).collection('triagens').doc(triagem.id).set(triagem);
  } else {
    memoria.triagens.push(triagem);
  }
  return triagem;
}

// ============== ATENDIMENTOS (handoff WhatsApp) ==============
export async function listarConversas(): Promise<Conversa[]> {
  let arr: Conversa[];
  if (isFirestore) {
    const snap = await (await fs()).collection('conversas').get();
    arr = snap.docs.map((d) => d.data() as Conversa);
  } else {
    arr = [...memoria.conversas];
  }
  // mais recentes primeiro; resolvidos por último
  const peso = (s: StatusAtendimento) => (s === 'aguardando' ? 0 : s === 'em_atendimento' ? 1 : 2);
  return arr.sort((a, b) => peso(a.status) - peso(b.status) || b.atualizadoEm.localeCompare(a.atualizadoEm));
}

export async function obterConversa(telefone: string): Promise<Conversa | null> {
  if (isFirestore) {
    const doc = await (await fs()).collection('conversas').doc(telefone).get();
    return doc.exists ? (doc.data() as Conversa) : null;
  }
  return memoria.conversas.find((c) => c.telefone === telefone) ?? null;
}

/** anexa uma mensagem à conversa (cria se não existir) e ajusta metadados */
export async function registrarMensagem(
  telefone: string,
  msg: MensagemConversa,
  meta?: { nome?: string; status?: StatusAtendimento },
): Promise<Conversa> {
  const atual = (await obterConversa(telefone)) ?? {
    telefone, nome: meta?.nome, status: 'aguardando' as StatusAtendimento,
    mensagens: [], atualizadoEm: new Date().toISOString(),
  };
  const nova: Conversa = {
    ...atual,
    nome: meta?.nome ?? atual.nome,
    status: meta?.status ?? atual.status,
    mensagens: [...atual.mensagens, msg],
    atualizadoEm: new Date().toISOString(),
  };
  if (isFirestore) {
    await (await fs()).collection('conversas').doc(telefone).set(nova);
  } else {
    const i = memoria.conversas.findIndex((c) => c.telefone === telefone);
    if (i >= 0) memoria.conversas[i] = nova;
    else memoria.conversas.push(nova);
  }
  return nova;
}

export async function definirStatusConversa(telefone: string, status: StatusAtendimento): Promise<void> {
  const atual = await obterConversa(telefone);
  if (!atual) return;
  const nova = { ...atual, status, atualizadoEm: new Date().toISOString() };
  if (isFirestore) {
    await (await fs()).collection('conversas').doc(telefone).set(nova, { merge: true });
  } else {
    const i = memoria.conversas.findIndex((c) => c.telefone === telefone);
    if (i >= 0) memoria.conversas[i] = nova;
  }
}

// ============== LEADS (CRM básico) ==============
export async function listarLeads(): Promise<Lead[]> {
  let arr: Lead[];
  if (isFirestore) {
    const snap = await (await fs()).collection('leads').get();
    arr = snap.docs.map((d) => d.data() as Lead);
  } else {
    arr = [...memoria.leads];
  }
  // mais recentes primeiro
  return arr.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function criarLead(
  dados: Omit<Lead, 'id' | 'criadoEm' | 'atualizadoEm'>,
): Promise<Lead> {
  const agora = new Date().toISOString();
  const lead: Lead = { ...dados, id: novoId('lead'), criadoEm: agora, atualizadoEm: agora };
  if (isFirestore) {
    await (await fs()).collection('leads').doc(lead.id).set(lead);
  } else {
    memoria.leads.push(lead);
  }
  return lead;
}

export async function atualizarLead(id: string, patch: Partial<Lead>): Promise<void> {
  const limpo = Object.fromEntries(
    Object.entries({ ...patch, atualizadoEm: new Date().toISOString() }).filter(([, v]) => v !== undefined),
  );
  if (isFirestore) {
    await (await fs()).collection('leads').doc(id).set(limpo, { merge: true });
  } else {
    const i = memoria.leads.findIndex((l) => l.id === id);
    if (i >= 0) memoria.leads[i] = { ...memoria.leads[i], ...limpo } as Lead;
  }
}

/**
 * Cria ou atualiza um lead a partir do WhatsApp, deduplicando pelo telefone
 * (últimos 8 dígitos). Usado pelo agente para registrar temperatura sem
 * gerar um lead novo a cada interação do mesmo número.
 */
export async function registrarLeadWhatsapp(
  telefone: string,
  dados: Partial<Pick<Lead, 'nome' | 'exameInteresse' | 'status' | 'temperatura' | 'mensagem'>>,
): Promise<void> {
  const sufixo = telefone.replace(/\D/g, '').slice(-8);
  const todos = await listarLeads();
  const existente = todos.find(
    (l) => l.origem === 'whatsapp' && l.status !== 'arquivado' && l.telefone.replace(/\D/g, '').endsWith(sufixo),
  );
  if (existente) {
    // nunca rebaixa: lead que já agendou permanece quente/agendado
    const patch: Partial<Lead> = { ...dados };
    if (existente.status === 'agendado' && dados.status !== 'agendado') {
      delete patch.status;
      delete patch.temperatura;
    }
    await atualizarLead(existente.id, patch);
    return;
  }
  await criarLead({
    nome: dados.nome ?? 'Contato WhatsApp',
    telefone,
    exameInteresse: dados.exameInteresse,
    mensagem: dados.mensagem,
    origem: 'whatsapp',
    status: dados.status ?? 'novo',
    temperatura: dados.temperatura ?? 'morno',
  });
}

// ============== USUÁRIOS ==============
export async function obterUsuarioPorEmail(email: string): Promise<Usuario | null> {
  if (isFirestore) {
    const snap = await (await fs()).collection('usuarios').where('email', '==', email).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as Usuario);
  }
  return memoria.usuarios.find((u) => u.email === email) ?? null;
}
