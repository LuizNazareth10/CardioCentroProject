import type { Agendamento, Conversa, Lead, MensagemConversa, Paciente, StatusAtendimento, Triagem, Usuario } from '../types';
import { sanitizarFicha } from '../validation';
import { medir } from './metrics';
import { memoria, novoId } from './store';

// =============================================================
// API ÚNICA DE DADOS usada por toda a aplicação.
// Backends: memória (dev/demo) e Firestore (produção).
//
// REGRA DE OURO DESTE ARQUIVO: nenhuma função lê uma coleção inteira.
// Todo filtro (data, paciente, telefone, busca) vai DENTRO da query do
// Firestore, nunca em `.filter()` depois do `.get()`. Com ~19 mil
// pacientes e ~94 mil agendamentos reais, ler tudo e filtrar em memória
// custava dezenas de milhares de leituras por clique — era a causa da
// lentidão da área restrita e estourava a cota diária do Firestore.
// =============================================================

const isFirestore = process.env.DATA_BACKEND === 'firestore';

/** teto de segurança: nenhuma query devolve mais que isto sem paginar */
const LIMITE_PADRAO = 50;

// ---- helper firestore (lazy import p/ não quebrar no modo memory) ----
async function fs() {
  const { db } = await import('./firestore');
  return db();
}

const soDigitos = (v?: string) => (v ?? '').replace(/\D/g, '');

/** minúsculas, sem acento e sem pontuação — base das buscas por prefixo */
export function normalizarBusca(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Campos derivados que tornam a busca indexável. Sem eles, procurar um
 * paciente por nome/CPF/telefone exigiria varrer a coleção inteira.
 * Recalculados a TODA gravação — nunca editados à mão.
 */
export function derivarCamposBusca(p: Pick<Paciente, 'nome' | 'cpf' | 'telefone'>) {
  return {
    nomeBusca: normalizarBusca(p.nome ?? ''),
    cpfDigitos: soDigitos(p.cpf),
    telefoneSufixo: soDigitos(p.telefone).slice(-8),
  };
}

/** `` é o último code point utilizável — fecha um intervalo de prefixo */
const FIM_PREFIXO = '';

// ============== PACIENTES ==============

export interface PaginaPacientes {
  pacientes: Paciente[];
  /** passe de volta em `cursor` para carregar a página seguinte; null = acabou */
  proximoCursor: string | null;
}

/**
 * Lista pacientes PAGINADO.
 *
 * IMPORTANTE (robustez): TODAS as queries daqui usam ordenação/filtro por
 * um ÚNICO campo, que o Firestore indexa AUTOMATICAMENTE — nenhuma depende
 * de índice composto (que precisaria ser publicado à mão e, se faltar, faz
 * a tela travar). Foi essa a causa da tela de Pacientes ficar "Carregando…".
 *
 * - lista base   → ordena pelo campo `id` (sempre presente, único).
 * - busca nome   → prefixo de `nomeBusca` (requer o backfill dos campos).
 * - busca número → prefixo de `cpfDigitos` ou `telefoneSufixo`.
 *
 * Limitação consciente: a busca por nome é por PREFIXO (começo do nome),
 * não por substring. "silva" não acha "José Silva"; "josé s" acha.
 */
export async function listarPacientes(opts?: {
  busca?: string;
  limite?: number;
  cursor?: string;
}): Promise<PaginaPacientes> {
  const limite = Math.min(opts?.limite ?? LIMITE_PADRAO, 200);
  const busca = opts?.busca?.trim();

  if (!isFirestore) {
    const filtrados = filtrarPacientesMemoria(memoria.pacientes, busca).sort((a, b) =>
      normalizarBusca(a.nome).localeCompare(normalizarBusca(b.nome)),
    );
    const inicio = opts?.cursor ? filtrados.findIndex((p) => p.id === opts.cursor) + 1 : 0;
    const pagina = filtrados.slice(inicio, inicio + limite);
    return {
      pacientes: pagina,
      proximoCursor: inicio + limite < filtrados.length && pagina.length ? pagina[pagina.length - 1].id : null,
    };
  }

  return medir(
    `listarPacientes(${busca ? 'busca' : 'lista'})`,
    async () => {
      const col = (await fs()).collection('pacientes');
      const digitos = soDigitos(busca);

      // --- busca numérica: CPF ou telefone, por prefixo (campo único) ---
      if (busca && digitos.length >= 3 && digitos.length >= busca.replace(/\s/g, '').length - 2) {
        const [porCpf, porTelefone] = await Promise.all([
          col.orderBy('cpfDigitos').startAt(digitos).endAt(digitos + FIM_PREFIXO).limit(limite).get(),
          col.orderBy('telefoneSufixo').startAt(digitos).endAt(digitos + FIM_PREFIXO).limit(limite).get(),
        ]);
        const porId = new Map<string, Paciente>();
        [...porCpf.docs, ...porTelefone.docs].forEach((d) => {
          const p = d.data() as Paciente;
          porId.set(p.id, p);
        });
        const pacientes = [...porId.values()]
          .sort((a, b) => (a.nomeBusca ?? '').localeCompare(b.nomeBusca ?? ''))
          .slice(0, limite);
        return { pacientes, proximoCursor: null }; // busca numérica não pagina
      }

      // --- busca por nome: prefixo de nomeBusca (campo único) ---
      if (busca) {
        const alvo = normalizarBusca(busca);
        const snap = await col
          .orderBy('nomeBusca')
          .startAt(alvo)
          .endAt(alvo + FIM_PREFIXO)
          .limit(limite)
          .get();
        return { pacientes: snap.docs.map((d) => d.data() as Paciente), proximoCursor: null };
      }

      // --- lista base: ordena por `id` (campo único, índice automático) ---
      let q = col.orderBy('id');
      if (opts?.cursor) q = q.startAfter(opts.cursor);
      const snap = await q.limit(limite).get();
      const pacientes = snap.docs.map((d) => d.data() as Paciente);
      return {
        pacientes,
        proximoCursor: pacientes.length === limite ? pacientes[pacientes.length - 1].id : null,
      };
    },
    (r) => r.pacientes.length,
  );
}

/** filtro por substring — só no backend de memória, onde o custo é irrelevante */
function filtrarPacientesMemoria(arr: Paciente[], busca?: string) {
  if (!busca) return [...arr];
  const q = normalizarBusca(busca);
  const d = soDigitos(busca);
  return arr.filter(
    (p) =>
      normalizarBusca(p.nome).includes(q) ||
      (d.length >= 3 && soDigitos(p.cpf).includes(d)) ||
      (d.length >= 3 && soDigitos(p.telefone).includes(d)),
  );
}

/** Total de pacientes via AGREGAÇÃO — 1 leitura, não 19 mil. */
export async function contarPacientes(): Promise<number> {
  if (!isFirestore) return memoria.pacientes.length;
  return medir(
    'contarPacientes()',
    async () => (await (await fs()).collection('pacientes').count().get()).data().count,
    () => 1,
  );
}

export async function obterPaciente(id: string): Promise<Paciente | null> {
  if (isFirestore) {
    const doc = await (await fs()).collection('pacientes').doc(id).get();
    return doc.exists ? (doc.data() as Paciente) : null;
  }
  return memoria.pacientes.find((p) => p.id === id) ?? null;
}

/**
 * Acha um paciente pelo telefone (últimos 8 dígitos, tolera DDI/DDD/9º
 * dígito). Query indexada — usada pelo agente do WhatsApp a cada conversa.
 */
export async function obterPacientePorTelefone(telefone: string): Promise<Paciente | null> {
  const sufixo = soDigitos(telefone).slice(-8);
  if (!sufixo) return null;
  if (!isFirestore) {
    return memoria.pacientes.find((p) => soDigitos(p.telefone).slice(-8) === sufixo) ?? null;
  }
  return medir(
    'obterPacientePorTelefone()',
    async () => {
      const snap = await (await fs()).collection('pacientes').where('telefoneSufixo', '==', sufixo).limit(1).get();
      return snap.empty ? null : (snap.docs[0].data() as Paciente);
    },
    (r) => (r ? 1 : 0),
  );
}

/**
 * Acha um paciente já cadastrado com o mesmo CPF (chave forte) ou o mesmo
 * telefone, para não criar um segundo registro da mesma pessoa. Duas
 * queries indexadas — antes isto varria os 19 mil pacientes a CADA
 * cadastro, inclusive nos criados pelo agente do WhatsApp.
 */
async function acharPacienteDuplicado(dados: Pick<Paciente, 'cpf' | 'telefone'>): Promise<Paciente | null> {
  const cpf = soDigitos(dados.cpf);
  const sufixo = soDigitos(dados.telefone).slice(-8);
  if (!cpf && !sufixo) return null;

  if (!isFirestore) {
    const porCpf = cpf ? memoria.pacientes.find((p) => soDigitos(p.cpf) === cpf) : null;
    if (porCpf) return porCpf;
    return sufixo ? memoria.pacientes.find((p) => soDigitos(p.telefone).slice(-8) === sufixo) ?? null : null;
  }

  const col = (await fs()).collection('pacientes');
  if (cpf) {
    const snap = await col.where('cpfDigitos', '==', cpf).limit(1).get();
    if (!snap.empty) return snap.docs[0].data() as Paciente;
  }
  if (sufixo) {
    const snap = await col.where('telefoneSufixo', '==', sufixo).limit(1).get();
    if (!snap.empty) return snap.docs[0].data() as Paciente;
  }
  return null;
}

export async function criarPaciente(
  dados: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>,
): Promise<Paciente> {
  const existente = await acharPacienteDuplicado(dados);
  if (existente) return existente;
  const agora = new Date().toISOString();
  const paciente: Paciente = {
    ...dados,
    ...derivarCamposBusca(dados),
    id: novoId('pac'),
    criadoEm: agora,
    atualizadoEm: agora,
  };
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
  // nome/cpf/telefone podem ter mudado → os campos de busca acompanham
  Object.assign(novo, derivarCamposBusca(novo));
  if (isFirestore) {
    await (await fs()).collection('pacientes').doc(id).set(novo, { merge: true });
  } else {
    const i = memoria.pacientes.findIndex((p) => p.id === id);
    if (i >= 0) memoria.pacientes[i] = novo;
  }
  return novo;
}

// ============== AGENDAMENTOS ==============

/**
 * Lista agendamentos.
 *
 * ROBUSTEZ: cada modo de consulta usa um ÚNICO campo indexável (índice
 * automático) — nunca um índice composto (que precisa de deploy manual e,
 * se faltar, quebra a tela). Concretamente:
 *   - por período (`de`/`ate`) → range no campo `inicio` + orderBy `inicio`.
 *   - por paciente            → igualdade em `pacienteId`, ordenado em memória.
 * (A combinação paciente + período não é usada.)
 *
 * `de`/`ate` são ISO datetime; comparados lexicograficamente equivalem à
 * ordem cronológica no mesmo fuso.
 */
export async function listarAgendamentos(filtro?: {
  de?: string;
  ate?: string;
  pacienteId?: string;
  limite?: number;
}): Promise<Agendamento[]> {
  if (!isFirestore) {
    let arr = [...memoria.agendamentos].sort((a, b) => a.inicio.localeCompare(b.inicio));
    if (filtro?.de) arr = arr.filter((a) => a.inicio >= filtro.de!);
    if (filtro?.ate) arr = arr.filter((a) => a.inicio <= filtro.ate!);
    if (filtro?.pacienteId) arr = arr.filter((a) => a.pacienteId === filtro.pacienteId);
    return filtro?.limite ? arr.slice(0, filtro.limite) : arr;
  }

  // por PACIENTE: igualdade em campo único, ordena em memória (um paciente
  // tem poucos agendamentos) — evita o índice composto (pacienteId, inicio).
  if (filtro?.pacienteId) {
    return medir(
      'listarAgendamentos(paciente)',
      async () => {
        const snap = await (await fs())
          .collection('agendamentos')
          .where('pacienteId', '==', filtro.pacienteId)
          .get();
        const arr = snap.docs.map((d) => d.data() as Agendamento).sort((a, b) => a.inicio.localeCompare(b.inicio));
        return filtro.limite ? arr.slice(0, filtro.limite) : arr;
      },
      (r) => r.length,
    );
  }

  // por PERÍODO (ou tudo): range no campo único `inicio`.
  return medir(
    `listarAgendamentos(${filtro?.de || filtro?.ate ? 'período' : 'TUDO'})`,
    async () => {
      let q = (await fs()).collection('agendamentos') as FirebaseFirestore.Query;
      if (filtro?.de) q = q.where('inicio', '>=', filtro.de);
      if (filtro?.ate) q = q.where('inicio', '<=', filtro.ate);
      q = q.orderBy('inicio');
      if (filtro?.limite) q = q.limit(filtro.limite);
      const snap = await q.get();
      return snap.docs.map((d) => d.data() as Agendamento);
    },
    (r) => r.length,
  );
}

/**
 * Agendamentos de UM médico num intervalo — revalidação de conflito.
 * Consulta pelo range de `inicio` (campo único, do dia pesquisado) e filtra
 * o médico em memória: assim não precisa do índice composto (medicoId,
 * inicio) e ainda lê só os agendamentos daquele dia.
 */
export async function listarAgendamentosDoMedico(
  medicoId: string,
  de: string,
  ate: string,
): Promise<Agendamento[]> {
  if (!isFirestore) {
    return memoria.agendamentos.filter((a) => a.medicoId === medicoId && a.inicio >= de && a.inicio <= ate);
  }
  return medir(
    'listarAgendamentosDoMedico()',
    async () => {
      const snap = await (await fs())
        .collection('agendamentos')
        .where('inicio', '>=', de)
        .where('inicio', '<=', ate)
        .orderBy('inicio')
        .get();
      return snap.docs.map((d) => d.data() as Agendamento).filter((a) => a.medicoId === medicoId);
    },
    (r) => r.length,
  );
}

/** Contagem por agregação — 1 leitura em vez da coleção inteira. */
export async function contarAgendamentos(filtro?: { de?: string; ate?: string }): Promise<number> {
  if (!isFirestore) {
    return (await listarAgendamentos(filtro)).length;
  }
  return medir(
    'contarAgendamentos()',
    async () => {
      let q = (await fs()).collection('agendamentos') as FirebaseFirestore.Query;
      if (filtro?.de) q = q.where('inicio', '>=', filtro.de);
      if (filtro?.ate) q = q.where('inicio', '<=', filtro.ate);
      return (await q.count().get()).data().count;
    },
    () => 1,
  );
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
    const db_ = await fs();
    const batch = db_.batch();
    const col = db_.collection('agendamentos');
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
    // igualdade em campo único + ordenação em memória (um paciente tem
    // poucas triagens) — evita o índice composto (pacienteId, data).
    const snap = await (await fs())
      .collection('triagens')
      .where('pacienteId', '==', pacienteId)
      .get();
    return snap.docs
      .map((d) => d.data() as Triagem)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 50);
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

/**
 * Fila de atendimento humano. Ordenada e limitada NO BANCO. A ordenação
 * por status (aguardando primeiro) é aplicada depois, sobre a página —
 * é barato porque a página é pequena.
 */
export async function listarConversas(opts?: { limite?: number }): Promise<Conversa[]> {
  const limite = Math.min(opts?.limite ?? LIMITE_PADRAO, 200);
  let arr: Conversa[];
  if (isFirestore) {
    arr = await medir(
      'listarConversas()',
      async () => {
        const snap = await (await fs())
          .collection('conversas')
          .orderBy('atualizadoEm', 'desc')
          .limit(limite)
          .get();
        return snap.docs.map((d) => d.data() as Conversa);
      },
      (r) => r.length,
    );
  } else {
    arr = [...memoria.conversas]
      .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
      .slice(0, limite);
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

/**
 * Anexa uma mensagem à conversa (cria se não existir).
 *
 * Usa `arrayUnion`, que faz o append NO SERVIDOR: não precisa ler o
 * documento antes nem reenviar o histórico inteiro a cada mensagem —
 * o que ficava progressivamente mais caro conforme a conversa crescia.
 */
export async function registrarMensagem(
  telefone: string,
  msg: MensagemConversa,
  meta?: { nome?: string; status?: StatusAtendimento },
): Promise<void> {
  const agora = new Date().toISOString();
  if (isFirestore) {
    const { FieldValue } = await import('firebase-admin/firestore');
    const doc: Record<string, unknown> = {
      telefone,
      mensagens: FieldValue.arrayUnion(JSON.parse(JSON.stringify(msg))),
      atualizadoEm: agora,
    };
    if (meta?.nome !== undefined) doc.nome = meta.nome;
    if (meta?.status !== undefined) doc.status = meta.status;
    // `status` só é semeado na criação; um merge posterior sem status preserva o atual
    const ref = (await fs()).collection('conversas').doc(telefone);
    await ref.set({ status: meta?.status ?? 'aguardando', ...doc }, { merge: true });
    return;
  }
  const atual = memoria.conversas.find((c) => c.telefone === telefone);
  if (atual) {
    atual.mensagens.push(msg);
    atual.atualizadoEm = agora;
    if (meta?.nome !== undefined) atual.nome = meta.nome;
    if (meta?.status !== undefined) atual.status = meta.status;
    return;
  }
  memoria.conversas.push({
    telefone,
    nome: meta?.nome,
    status: meta?.status ?? 'aguardando',
    mensagens: [msg],
    atualizadoEm: agora,
  });
}

export async function definirStatusConversa(telefone: string, status: StatusAtendimento): Promise<void> {
  if (isFirestore) {
    await (await fs())
      .collection('conversas')
      .doc(telefone)
      .set({ status, atualizadoEm: new Date().toISOString() }, { merge: true });
    return;
  }
  const i = memoria.conversas.findIndex((c) => c.telefone === telefone);
  if (i >= 0) memoria.conversas[i] = { ...memoria.conversas[i], status, atualizadoEm: new Date().toISOString() };
}

// ============== LEADS (CRM básico) ==============
export async function listarLeads(opts?: { limite?: number }): Promise<Lead[]> {
  const limite = Math.min(opts?.limite ?? LIMITE_PADRAO, 200);
  if (isFirestore) {
    return medir(
      'listarLeads()',
      async () => {
        const snap = await (await fs()).collection('leads').orderBy('criadoEm', 'desc').limit(limite).get();
        return snap.docs.map((d) => d.data() as Lead);
      },
      (r) => r.length,
    );
  }
  return [...memoria.leads].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, limite);
}

export async function criarLead(
  dados: Omit<Lead, 'id' | 'criadoEm' | 'atualizadoEm'>,
): Promise<Lead> {
  const agora = new Date().toISOString();
  const lead: Lead = {
    ...dados,
    telefoneSufixo: soDigitos(dados.telefone).slice(-8),
    id: novoId('lead'),
    criadoEm: agora,
    atualizadoEm: agora,
  };
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
 * Cria ou atualiza um lead do WhatsApp, deduplicando pelo telefone via
 * query indexada (antes: varria todos os leads a cada interação).
 */
export async function registrarLeadWhatsapp(
  telefone: string,
  dados: Partial<Pick<Lead, 'nome' | 'exameInteresse' | 'status' | 'temperatura' | 'mensagem'>>,
): Promise<void> {
  const sufixo = soDigitos(telefone).slice(-8);

  let existente: Lead | null = null;
  if (isFirestore) {
    // filtra por campo ÚNICO (telefoneSufixo, índice automático) e refina
    // origem/status em memória — evita depender de um índice composto.
    const snap = await (await fs())
      .collection('leads')
      .where('telefoneSufixo', '==', sufixo)
      .limit(10)
      .get();
    existente =
      snap.docs
        .map((d) => d.data() as Lead)
        .find((l) => l.origem === 'whatsapp' && l.status !== 'arquivado') ?? null;
  } else {
    existente =
      memoria.leads.find(
        (l) => l.origem === 'whatsapp' && l.status !== 'arquivado' && soDigitos(l.telefone).endsWith(sufixo),
      ) ?? null;
  }

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
