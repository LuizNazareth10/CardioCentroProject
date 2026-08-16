/**
 * Sincroniza a base de produção com os 3 CSVs exportados do sistema de origem,
 * na janela 2026-05-01 .. 2026-12-31.
 *
 * DIFERENÇA CRÍTICA para `reset-retroalimentacao.ts`: aquele script APAGA as
 * coleções e reimporta do zero. Este aqui NUNCA apaga nada — insere o que é
 * novo e faz upsert conservador no que já existe. Rodar duas vezes não duplica.
 *
 * Uso:
 *   npx tsx scripts/sincronizar-retroalimentacao.ts --dry-run   (não escreve; relatório completo)
 *   npx tsx scripts/sincronizar-retroalimentacao.ts             (executa; grava backup antes)
 *
 * ---------------------------------------------------------------------------
 * Decisões (confirmadas com o dono do produto em 2026-08-16):
 *
 *  1. Linhas SEM prontuário são recuperadas: o paciente é resolvido por
 *     nome/telefone e, se não existir, é criado. O import de julho pulava
 *     essas linhas — o que deixava 225 dos 252 MAPA/Holter futuros invisíveis,
 *     e a IA oferecia esses aparelhos como livres.
 *
 *  2. Agendamentos futuros importados nascem com `lembreteEnviadoEm` já
 *     preenchido, para o cron diário NÃO disparar uma rajada de WhatsApp para
 *     pacientes que marcaram pelo outro sistema. Para religar o lembrete de um
 *     agendamento, basta apagar esse campo.
 *
 *  3. Procedimentos fora do catálogo (consulta, retorno, ECG, linhas sem
 *     código) continuam NÃO virando agendamento — mantida a decisão de
 *     2026-07-20. Só o paciente é criado/atualizado.
 *
 *  4. Linhas cujo "paciente" é na verdade um bloqueio de agenda ("NÃO MARCAR",
 *     "DRA SONIELE TEM EXAME", ...) ocupam o horário através de UM cadastro
 *     reservado (PACIENTE_BLOQUEIO_ID), não viram 365 pacientes. O texto
 *     original vai para `observacao`.
 *
 *  5. NADA é apagado. Agendamentos que existem em produção e sumiram do CSV
 *     (110 na janela, dos quais 10 marcados pela IA no WhatsApp) são
 *     preservados e apenas relatados.
 *
 *  6. O upsert é CONSERVADOR: nunca sobrescreve estado criado por humano ou
 *     pela IA — `status`, `origem`, `grupoId`, `lembreteEnviadoEm`, `chegouEm`,
 *     `finalizadoEm`, `remarcadoEm`, `inicioAnterior` ficam como estão.
 *     Só `convenioId`, `medicoId` e `observacao` são atualizados, e apenas
 *     quando o CSV traz valor não vazio.
 * ---------------------------------------------------------------------------
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { APARELHOS, CONVENIOS, EXAMES } from '../src/lib/seed-data';
import { derivarCamposBusca } from '../src/lib/db';
import { normalizarBusca, soDigitos } from '../src/lib/busca';
import type { Agendamento, FichaMedica, Paciente, Sexo, StatusAgendamento } from '../src/lib/types';

// ---------------------------------------------------------------
// parâmetros
// ---------------------------------------------------------------
const DIR_CSV = process.env.DIR_CSV ?? 'C:/Users/Luiz/Downloads';
const ARQ_PACIENTES = `${DIR_CSV}/pacientesvalidos.CSV`;
const ARQ_EXAMES = `${DIR_CSV}/examesvalidos.CSV`;
const ARQ_MAPAS = `${DIR_CSV}/mapasholters.CSV`;

const JANELA_DE = '2026-05-01';
const JANELA_ATE = '2026-12-31';

const DRY_RUN = process.argv.includes('--dry-run');
/** grava um JSON com TUDO que seria escrito, para conferência antes do run real */
const DETALHE = process.argv.includes('--detalhe');

/** cadastro único que carrega os bloqueios de agenda (decisão 4) */
const PACIENTE_BLOQUEIO_ID = 'pac_bloqueio_agenda';

// ---------------------------------------------------------------
// setup
// ---------------------------------------------------------------
function carregarEnvLocal() {
  const p = '.env.local';
  if (!fs.existsSync(p)) return;
  for (const linha of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
carregarEnvLocal();

const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 não configurada');
const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
const db = getFirestore(
  initializeApp({ credential: cert(serviceAccount), projectId: process.env.GCP_PROJECT_ID }),
);
db.settings({ ignoreUndefinedProperties: true });

// ---------------------------------------------------------------
// CSV (aspas, aspas escapadas "", newline embutido) — arquivos em latin1
// ---------------------------------------------------------------
function parseCsv(content: string, delimiter = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < content.length) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === delimiter) { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

type Linha = Record<string, string>;
function lerCsv(caminho: string): Linha[] {
  if (!fs.existsSync(caminho)) throw new Error(`CSV não encontrado: ${caminho}`);
  const rows = parseCsv(fs.readFileSync(caminho, 'latin1'));
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const o: Linha = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
}

// ---------------------------------------------------------------
// mapeamentos de domínio
// ---------------------------------------------------------------
const OUTROS_ID = CONVENIOS.find((c) => c.nome === 'Outros')?.id ?? 'outros';
const chaveConvenio = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

function acharConvenioId(texto: string): string {
  const n = chaveConvenio(texto ?? '');
  if (!n) return OUTROS_ID;
  const exato = CONVENIOS.find((c) => chaveConvenio(c.nome) === n);
  if (exato) return exato.id;
  const parcial = CONVENIOS.find((c) => {
    const cn = chaveConvenio(c.nome);
    return cn.includes(n) || n.includes(cn);
  });
  return parcial?.id ?? OUTROS_ID;
}

const MEDICO_POR_NOME: Record<string, string> = {
  'RICARDO MARCIO DAHER RUSSO': 'med-daher',
  'PEDRO PAULO DE OLIVEIRA': 'med-pedro-paulo',
  'JULIO CESAR MORAES LOVISI': 'med-lovisi',
  'FERNANDA LANZONI DE AQUINO': 'med-lanzoni',
  'PAULO VENDEL ZORZO': 'med-zorzo',
  'SONIELLE DE JESUS OLIVEIRA ALBERTINO': 'med-sonielle',
  'LUISA CARVALHO LOVISI': 'med-luisa-lovisi',
  'TASSIANA CRISTINA MENDES MIRANDA CAMPOS': 'med-tassiana-campos',
  'VAGNER DE CAMPOS SILVA': 'med-vagner-silva',
};

/** só os 6 exames do catálogo; o resto não vira agendamento (decisão 3) */
const EXAME_POR_CODIGO: Record<string, string> = {
  '4.09.01.10-6': 'eco-doppler',
  '82010064': 'eco-doppler',
  '4.09.01.80-7': 'eco-doppler',
  '82010056': 'eco-doppler',
  '4.01.01.04-5': 'ergometrico',
  '82010013': 'ergometrico',
  '4.01.01.03-7': 'ergometrico',
  '4.09.01.36-0': 'duplex-carotidas',
  '82010137': 'duplex-carotidas',
  '4.09.01.36-2': 'duplex-carotidas',
  '4.01.01.06-1': 'cardiopulmonar',
  '2.01.02.03-8': 'mapa',
  '82010153': 'mapa',
};

const DURACAO: Record<string, number> = Object.fromEntries(EXAMES.map((e) => [e.id, e.duracaoMin]));

/**
 * Textos que a recepção escreve no lugar do nome para BLOQUEAR o horário.
 * Não são pacientes; ocupam a agenda através do cadastro de bloqueio.
 * Casamento por igualdade do texto normalizado — deliberadamente estreito,
 * para nunca engolir um paciente de verdade.
 */
const TEXTOS_BLOQUEIO = new Set(
  [
    'nao marcar',
    'nao marca',
    'dra soniele tem exame',
    'dra fernnada chega 13:40h',
    'jf voley (dr. julio)',
  ].map((s) => normalizarBusca(s)),
);
const ehBloqueio = (nome: string) => TEXTOS_BLOQUEIO.has(normalizarBusca(nome));

// ---------------------------------------------------------------
// helpers de tempo
// ---------------------------------------------------------------
const naJanela = (data: string) => !!data && data >= JANELA_DE && data <= JANELA_ATE;
const dataValida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const horaValida = (h: string) => /^\d{2}:\d{2}$/.test(h);

/**
 * MAPA/Holter: encaixa a hora do CSV no horário exato da grade quando ela está
 * a 1–2 minutos dele.
 *
 * O motor mede ocupação de APARELHO por igualdade da string de hora
 * (`a.inicio.slice(11,16) === hhmm` em engine.ts), e não por sobreposição de
 * intervalo como faz para médico. O sistema de origem grava o Holter das 08:45
 * como 08:46 — sem esse encaixe o agendamento importado não ocuparia o slot, e
 * a IA ofereceria a mesma vaga de aparelho de novo (capacidade 1 por slot).
 *
 * Só corrige o desencontro de minuto: horários realmente fora da grade (a
 * clínica faz MAPA das 16:00 às 17:00, que não existe em APARELHOS) ficam com
 * a hora real — mexer neles falsificaria o horário do paciente, e como o motor
 * nunca oferece esses horários também não há risco de sobrepor.
 */
const TOLERANCIA_SLOT_MIN = 2;
function encaixarNaGradeDoAparelho(exameId: string, data: string, hora: string): string {
  const cfg = APARELHOS[exameId as 'mapa' | 'holter'];
  if (!cfg) return hora;
  const wd = new Date(`${data}T12:00:00Z`).getUTCDay();
  const slots = cfg.slots[wd as keyof typeof cfg.slots] ?? [];
  if (!slots.length) return hora;
  const emMin = (h: string) => {
    const [a, b] = h.split(':').map(Number);
    return a * 60 + b;
  };
  const alvo = emMin(hora);
  let melhor: { slot: string; dist: number } | null = null;
  for (const s of slots) {
    const dist = Math.abs(emMin(s) - alvo);
    if (!melhor || dist < melhor.dist) melhor = { slot: s, dist };
  }
  return melhor && melhor.dist > 0 && melhor.dist <= TOLERANCIA_SLOT_MIN ? melhor.slot : hora;
}

function minParaHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
function proximoDia(dataIso: string): string {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------
// helpers de paciente
// ---------------------------------------------------------------
function fichaVazia(): FichaMedica {
  return {
    hipertensao: false, diabetes: false, dislipidemia: false, tabagismo: false,
    etilismo: false, sedentarismo: false, iamPrevio: false, avcPrevio: false,
    doencaRenal: false, marcapasso: false, histFamiliarDac: false, histFamiliarMorteSubita: false,
  };
}

function escolherTelefone(f: Linha): string {
  const pares = [1, 2, 3, 4].map((n) => ({
    tipo: (f[`tipo_de_telefone_${n}`] ?? '').toUpperCase(),
    num: (f[`telefone_${n}`] ?? '').trim(),
  }));
  return (
    pares.find((p) => p.tipo === 'WHATSAPP' && p.num)?.num ??
    pares.find((p) => p.tipo === 'CELULAR' && p.num)?.num ??
    pares.find((p) => p.num)?.num ??
    ''
  );
}

function montarEndereco(f: Linha): string | undefined {
  const partes = [
    [f.tipo_logradouro, f.logradouro].filter(Boolean).join(' ').trim(),
    f.numero, f.complemento, f.bairro, f.uf, f.cep,
  ].map((s) => (s ?? '').trim()).filter(Boolean);
  return partes.length ? partes.join(', ') : undefined;
}

function sexoDe(v: string): Sexo | undefined {
  if (v === 'Masculino') return 'M';
  if (v === 'Feminino') return 'F';
  return undefined;
}

/**
 * DDD + número local, mesma leitura usada por `obterPacientePorTelefone` em
 * lib/db — dois pacientes de DDDs diferentes com o mesmo final NÃO podem ser
 * fundidos num cadastro só.
 */
function partesTelefone(telefone: string): { ddd: string; local: string } {
  const d = soDigitos(telefone).replace(/^55/, '');
  return { local: d.slice(-8), ddd: d.slice(0, -8).replace(/9$/, '').slice(-2) };
}
function telefoneCompativel(a: string, b: string): boolean {
  const x = partesTelefone(a);
  const y = partesTelefone(b);
  if (!x.local || x.local !== y.local) return false;
  if (x.ddd && y.ddd) return x.ddd === y.ddd;
  return true; // um dos lados sem DDD (comum na base antiga) — não dá para desempatar
}

// ---------------------------------------------------------------
// IDENTIDADE DE PACIENTE
//
// O telefone NUNCA identifica sozinho. Família inteira compartilha o mesmo
// número: casar só pelo sufixo funde duas pessoas diferentes e, num upsert,
// RENOMEIA o cadastro antigo com o nome de outra pessoa — perda irreversível
// de prontuário. (Numa passagem anterior isto atingiria 438 pacientes:
// "JACQUELINE APARECIDA TEIXEIRA" viraria "ADILIA BERTGES TEIXEIRA".)
//
// Regra: o NOME sempre tem que concordar, e qualquer contradição objetiva
// (CPF diferente, nascimento diferente) descarta o casamento. Errar para o
// lado de criar um cadastro a mais é reversível; sobrescrever não é.
// ---------------------------------------------------------------
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von']);

function tokensNome(nome: string): string[] {
  return normalizarBusca(nome ?? '')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !PARTICULAS.has(t));
}

function tokensEmComum(a: string, b: string): number {
  const ta = new Set(tokensNome(a));
  return tokensNome(b).filter((t) => ta.has(t)).length;
}

/** leitura de campo por nome, sem afrouxar o tipo do resto do script */
const campoDe = (p: Paciente): Record<string, unknown> => p as unknown as Record<string, unknown>;

/** CPF só vale como chave forte quando tem 11 dígitos de verdade */
function cpf11(v?: string): string {
  const d = soDigitos(v);
  return d.length === 11 ? d : '';
}

type Identidade = { nome: string; cpf?: string; dataNascimento?: string };

/** evidência OBJETIVA de que são pessoas diferentes */
function contradiz(a: Identidade, b: Identidade): boolean {
  const ca = cpf11(a.cpf);
  const cb = cpf11(b.cpf);
  if (ca && cb && ca !== cb) return true;
  if (a.dataNascimento && b.dataNascimento && a.dataNascimento !== b.dataNascimento) return true;
  return false;
}

/** nomes concordam: iguais, ou 2+ sobrenomes/prenomes em comum (tolera typo) */
function nomeConcorda(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (normalizarBusca(a) === normalizarBusca(b)) return true;
  return tokensEmComum(a, b) >= 2;
}

function mesmaPessoa(prod: Identidade, csv: Identidade): boolean {
  if (contradiz(prod, csv)) return false;
  return nomeConcorda(prod.nome, csv.nome);
}

/** id determinístico: rodar de novo gera o MESMO id, então não duplica */
function idDeterministico(prefixo: string, ...partes: string[]): string {
  const h = crypto.createHash('sha1').update(partes.join('|')).digest('hex').slice(0, 16);
  return `${prefixo}_${h}`;
}

// ---------------------------------------------------------------
// escrita em lotes (com backup prévio)
// ---------------------------------------------------------------
async function commitEmLotes(
  ops: Array<{ colecao: string; id: string; dados: FirebaseFirestore.DocumentData; merge: boolean }>,
  rotulo: string,
) {
  for (let i = 0; i < ops.length; i += 400) {
    const lote = ops.slice(i, i + 400);
    const batch = db.batch();
    for (const op of lote) {
      const ref = db.collection(op.colecao).doc(op.id);
      if (op.merge) batch.set(ref, op.dados, { merge: true });
      else batch.set(ref, op.dados);
    }
    await batch.commit();
    console.log(`  ${rotulo}: ${Math.min(i + 400, ops.length)}/${ops.length}`);
  }
}

// ===============================================================
// main
// ===============================================================
async function main() {
  const t0 = Date.now();
  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Sincronização ${JANELA_DE} .. ${JANELA_ATE}`);
  console.log(`projeto: ${process.env.GCP_PROJECT_ID}\n`);

  const agora = new Date().toISOString();
  const hojeJF = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  // -------------------------------------------------------------
  // 1) CSVs
  // -------------------------------------------------------------
  const csvPacientes = lerCsv(ARQ_PACIENTES);
  const csvExames = lerCsv(ARQ_EXAMES).filter((r) => naJanela(r.data));
  const csvMapas = lerCsv(ARQ_MAPAS).filter((r) => naJanela(r.data));
  console.log(`CSV: ${csvPacientes.length} pacientes | ${csvExames.length} exames na janela | ${csvMapas.length} mapas/holters na janela`);

  const pacientePorProntuario = new Map<string, Linha>();
  for (const p of csvPacientes) if (p.prontuario) pacientePorProntuario.set(p.prontuario, p);

  // -------------------------------------------------------------
  // 2) fotografia da produção
  // -------------------------------------------------------------
  console.log('\nlendo produção...');
  const snapPac = await db.collection('pacientes').get();
  const pacientesProd = snapPac.docs.map((d) => d.data() as Paciente);
  console.log(`  pacientes: ${pacientesProd.length}`);

  const snapAg = await db
    .collection('agendamentos')
    .where('inicio', '>=', `${JANELA_DE}T00:00:00-03:00`)
    .where('inicio', '<=', `${JANELA_ATE}T23:59:59-03:00`)
    .get();
  const agendamentosProd = snapAg.docs.map((d) => d.data() as Agendamento);
  console.log(`  agendamentos na janela: ${agendamentosProd.length}`);

  // índices de busca de paciente
  const porCpf = new Map<string, Paciente>();
  const porSufixo = new Map<string, Paciente[]>();
  const porNomeNasc = new Map<string, Paciente>();
  const porNome = new Map<string, Paciente[]>();
  for (const p of pacientesProd) {
    const cpf = soDigitos(p.cpf);
    if (cpf && !porCpf.has(cpf)) porCpf.set(cpf, p);
    const suf = soDigitos(p.telefone).slice(-8);
    if (suf.length === 8) {
      if (!porSufixo.has(suf)) porSufixo.set(suf, []);
      porSufixo.get(suf)!.push(p);
    }
    const nb = p.nomeBusca ?? normalizarBusca(p.nome);
    if (nb) {
      if (!porNome.has(nb)) porNome.set(nb, []);
      porNome.get(nb)!.push(p);
      if (p.dataNascimento) porNomeNasc.set(`${nb}|${p.dataNascimento}`, p);
    }
  }

  /** pacientes criados nesta execução, para casar duas linhas do mesmo desconhecido */
  const criadosPorChave = new Map<string, Paciente>();

  const motivoMatch = { cpf: 0, nomeNascimento: 0, nomeTelefone: 0, nomeUnico: 0, cpfRecusado: 0, telefoneRecusado: 0 };
  /** campos de identidade: só preenchem lacuna, nunca sobrescrevem */
  const PROTEGIDOS = new Set(['dataNascimento', 'sexo']);
  const divergenciasProtegidas: string[] = [];

  /**
   * Acha o cadastro que é MESMA PESSOA. Ordem: CPF (chave legal) → nome +
   * nascimento → nome + telefone → nome exato e único. Em todos os caminhos o
   * nome precisa concordar e nada pode contradizer; senão devolve null e a
   * linha vira cadastro novo (erro reversível).
   */
  function acharExistente(dados: { cpf?: string; telefone?: string; nome: string; nascimento?: string }): Paciente | null {
    const csv: Identidade = { nome: dados.nome, cpf: dados.cpf, dataNascimento: dados.nascimento };
    const nb = normalizarBusca(dados.nome);

    // (1) CPF — chave legal única. Ainda assim exige que o nome concorde:
    // CPF digitado errado no sistema de origem apontaria para outra pessoa.
    const cpf = cpf11(dados.cpf);
    if (cpf && porCpf.has(cpf)) {
      const cand = porCpf.get(cpf)!;
      if (nomeConcorda(cand.nome, dados.nome)) { motivoMatch.cpf++; return cand; }
      motivoMatch.cpfRecusado++;
    }

    // (2) nome exato + data de nascimento
    if (nb && dados.nascimento) {
      const cand = porNomeNasc.get(`${nb}|${dados.nascimento}`);
      if (cand && !contradiz(cand, csv)) { motivoMatch.nomeNascimento++; return cand; }
    }

    // (3) telefone CONFIRMA, nunca identifica: só vale se o nome concordar
    const suf = soDigitos(dados.telefone).slice(-8);
    if (suf.length === 8) {
      const cands = porSufixo.get(suf) ?? [];
      const compat = cands.filter((c) => telefoneCompativel(dados.telefone ?? '', c.telefone));
      const bom = compat.find((c) => mesmaPessoa(c, csv));
      if (bom) { motivoMatch.nomeTelefone++; return bom; }
      if (compat.length) motivoMatch.telefoneRecusado++;
    }

    // (4) nome exato e ÚNICO na base, sem contradição
    const mesmos = (porNome.get(nb) ?? []).filter((c) => !contradiz(c, csv));
    if (mesmos.length === 1) { motivoMatch.nomeUnico++; return mesmos[0]; }
    return null;
  }

  function indexar(p: Paciente) {
    const cpf = soDigitos(p.cpf);
    if (cpf && !porCpf.has(cpf)) porCpf.set(cpf, p);
    const suf = soDigitos(p.telefone).slice(-8);
    if (suf.length === 8) {
      if (!porSufixo.has(suf)) porSufixo.set(suf, []);
      porSufixo.get(suf)!.push(p);
    }
    const nb = p.nomeBusca ?? normalizarBusca(p.nome);
    if (nb) {
      if (!porNome.has(nb)) porNome.set(nb, []);
      porNome.get(nb)!.push(p);
      if (p.dataNascimento) porNomeNasc.set(`${nb}|${p.dataNascimento}`, p);
    }
  }

  // -------------------------------------------------------------
  // 3) pacientes: novos + upsert conservador
  // -------------------------------------------------------------
  const opsPacientes: Array<{ colecao: string; id: string; dados: FirebaseFirestore.DocumentData; merge: boolean }> = [];
  const backupPacientes: Paciente[] = [];
  /** só para auditoria em --detalhe: o que muda em cada paciente já existente */
  const diffsPacientes: Array<{ id: string; nome: string; mudancas: Record<string, { de: unknown; para: unknown }> }> = [];
  const prontuarioParaId = new Map<string, string>();
  let pacNovos = 0, pacAtualizados = 0, pacIguais = 0;

  /**
   * PASSO 1 — resolve cada linha do CSV para um cadastro alvo, sem gravar.
   *
   * O sistema de origem tem a MESMA pessoa cadastrada sob dois prontuários
   * ("AITON" e "AILTON ALVES PEREIRA", "ANA JULIA" e "ANA JÚLIA GARCIA
   * PAIVA"). As duas linhas resolvem para o mesmo cadastro e, aplicadas em
   * sequência, ficam se sobrescrevendo — o campo final virava a ordem do
   * arquivo, e cada nova execução regravava 115 documentos à toa.
   *
   * Agrupando por alvo e deixando vencer a inscrição MAIS RECENTE
   * (data_de_cadastro), o resultado é determinístico e a segunda execução não
   * escreve nada. Os prontuários do grupo inteiro continuam apontando para o
   * mesmo cadastro, então os agendamentos de ambos caem na pessoa certa.
   */
  type Alvo = { existente: Paciente | null; linhas: Linha[] };
  const alvos = new Map<string, Alvo>();

  for (const f of csvPacientes) {
    const nome = f.paciente?.trim();
    if (!nome) continue;
    const telefone = escolherTelefone(f);
    const existente = acharExistente({
      cpf: f.cpf, telefone, nome, nascimento: f.data_de_nascimento || undefined,
    });
    const chave = existente
      ? existente.id
      : idDeterministico('pac_imp', f.prontuario || `${normalizarBusca(nome)}|${soDigitos(f.cpf)}`);
    if (!alvos.has(chave)) alvos.set(chave, { existente, linhas: [] });
    alvos.get(chave)!.linhas.push(f);
    prontuarioParaId.set(f.prontuario, chave);
    // registra já nos índices para a próxima linha do mesmo desconhecido
    // casar aqui dentro em vez de virar um segundo cadastro
    if (!existente && alvos.get(chave)!.linhas.length === 1) {
      indexar({
        id: chave,
        nome,
        telefone,
        cpf: f.cpf || undefined,
        dataNascimento: f.data_de_nascimento || undefined,
        fichaMedica: fichaVazia(),
        criadoEm: agora,
        atualizadoEm: agora,
        ...derivarCamposBusca({ nome, cpf: f.cpf || undefined, telefone }),
      });
    }
  }

  /** inscrição mais recente vence; sem data, a última do arquivo */
  function linhaVencedora(linhas: Linha[]): Linha {
    return linhas.reduce((a, b) => ((b.data_de_cadastro ?? '') >= (a.data_de_cadastro ?? '') ? b : a));
  }

  // PASSO 2 — aplica um único resultado por cadastro
  for (const [chave, alvo] of alvos) {
    const f = linhaVencedora(alvo.linhas);
    const nome = f.paciente.trim();
    const telefone = escolherTelefone(f);
    const existente = alvo.existente;

    // campos que o CSV traz; vazios NUNCA apagam o que já existe
    const campos: Partial<Paciente> = {
      nome,
      cpf: f.cpf || undefined,
      dataNascimento: f.data_de_nascimento || undefined,
      sexo: sexoDe(f.sexo),
      telefone: telefone || undefined,
      email: f.email || undefined,
      endereco: montarEndereco(f),
      convenioId: f.convenio_1 ? acharConvenioId(f.convenio_1) : undefined,
      carteirinha: f.numero_de_matricula_carteira_1 || undefined,
    };

    if (existente) {
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (v === undefined || v === '') continue;
        // Campos que DEFINEM identidade: preenchem lacuna, mas nunca
        // sobrescrevem valor existente. Quando o CSV discorda do cadastro não
        // há como saber qual lado está certo (ex.: nascimento saltando 29 anos,
        // sexo invertido) — e trocar isso num prontuário é dano silencioso.
        // Divergências ficam no relatório para a clínica conferir à mão.
        if (PROTEGIDOS.has(k) && campoDe(existente)[k]) {
          if (campoDe(existente)[k] !== v) {
            divergenciasProtegidas.push(
              `${existente.id} "${existente.nome}" ${k}: cadastro="${campoDe(existente)[k]}" csv="${v}"`,
            );
          }
          continue;
        }
        if (campoDe(existente)[k] !== v) patch[k] = v;
      }
      if (Object.keys(patch).length === 0) { pacIguais++; continue; }
      void chave;
      // rede de segurança: um patch NUNCA pode trocar o nome do cadastro pelo
      // de outra pessoa. Se chegou aqui com nome discordante, é bug — aborta
      // tudo em vez de gravar prontuário trocado.
      if (typeof patch.nome === 'string' && !nomeConcorda(existente.nome, patch.nome)) {
        throw new Error(
          `ABORTADO: tentativa de renomear ${existente.id} de "${existente.nome}" para "${patch.nome}" ` +
            '— nomes não concordam. Nenhuma escrita foi feita.',
        );
      }
      diffsPacientes.push({
        id: existente.id,
        nome: existente.nome,
        mudancas: Object.fromEntries(
          Object.keys(patch).map((k) => [k, { de: campoDe(existente)[k], para: patch[k] }]),
        ),
      });
      const fundido = { ...existente, ...patch } as Paciente;
      Object.assign(patch, derivarCamposBusca(fundido), { atualizadoEm: agora });
      backupPacientes.push(existente);
      opsPacientes.push({ colecao: 'pacientes', id: existente.id, dados: patch, merge: true });
      pacAtualizados++;
      continue;
    }

    // novo
    const criadoEm = f.data_de_cadastro ? `${f.data_de_cadastro}T00:00:00-03:00` : agora;
    const novo: Paciente = {
      id: chave,
      ...(campos as Omit<Paciente, 'id' | 'fichaMedica' | 'criadoEm' | 'atualizadoEm' | 'telefone'>),
      telefone: telefone ?? '',
      fichaMedica: fichaVazia(),
      criadoEm,
      atualizadoEm: agora,
      ...derivarCamposBusca({ nome, cpf: f.cpf || undefined, telefone }),
    };
    opsPacientes.push({ colecao: 'pacientes', id: novo.id, dados: novo, merge: false });
    criadosPorChave.set(novo.id, novo);
    pacNovos++;
  }
  console.log(`\npacientes: ${pacNovos} novos | ${pacAtualizados} atualizados | ${pacIguais} sem mudança`);
  console.log(`  casados por: CPF=${motivoMatch.cpf} nome+nasc=${motivoMatch.nomeNascimento} ` +
    `nome+tel=${motivoMatch.nomeTelefone} nome único=${motivoMatch.nomeUnico}`);
  console.log(`  RECUSADOS (viraram cadastro novo em vez de sobrescrever): ` +
    `CPF com nome divergente=${motivoMatch.cpfRecusado} | mesmo telefone e pessoa diferente=${motivoMatch.telefoneRecusado}`);
  console.log(`  divergências em campo de identidade (preservado o cadastro, ver relatório): ${divergenciasProtegidas.length}`);

  // -------------------------------------------------------------
  // 4) paciente reservado dos bloqueios de agenda
  // -------------------------------------------------------------
  const pacienteBloqueio: Paciente = {
    id: PACIENTE_BLOQUEIO_ID,
    nome: 'BLOQUEIO — agenda',
    telefone: '',
    fichaMedica: fichaVazia(),
    criadoEm: agora,
    atualizadoEm: agora,
    ...derivarCamposBusca({ nome: 'BLOQUEIO — agenda', telefone: '' }),
  };

  // -------------------------------------------------------------
  // 5) índice dos agendamentos já em produção
  // -------------------------------------------------------------
  const agPorChaveId = new Map<string, Agendamento>();   // pacienteId|inicio|exameId
  const agPorChaveNome = new Map<string, Agendamento>(); // nomeNormalizado|inicio|exameId
  for (const a of agendamentosProd) {
    agPorChaveId.set(`${a.pacienteId}|${a.inicio}|${a.exameId}`, a);
    agPorChaveNome.set(`${normalizarBusca(a.pacienteNome ?? '')}|${a.inicio}|${a.exameId}`, a);
  }

  // -------------------------------------------------------------
  // 6) agendamentos
  // -------------------------------------------------------------
  const opsAgendamentos: Array<{ colecao: string; id: string; dados: FirebaseFirestore.DocumentData; merge: boolean }> = [];
  const backupAgendamentos: Agendamento[] = [];
  const chavesVistas = new Set<string>();

  const cont = {
    novos: 0, atualizados: 0, iguais: 0,
    foraCatalogo: 0, medicoDesconhecido: 0, dataHoraInvalida: 0,
    bloqueios: 0, semPacienteResolvido: 0, pacientesCriadosDeAgendamento: 0,
    duplicataNoCsv: 0, preservadoWhatsapp: 0, horaEncaixadaNaGrade: 0,
  };

  /** resolve (ou cria) o paciente de uma linha de agendamento */
  function resolverPacienteDaLinha(r: Linha): { id: string; nome: string } | null {
    const nomeLinha = (r.paciente ?? '').trim();

    if (nomeLinha && ehBloqueio(nomeLinha)) {
      cont.bloqueios++;
      return { id: PACIENTE_BLOQUEIO_ID, nome: pacienteBloqueio.nome };
    }

    // (a) prontuário — caminho forte
    if (r.prontuario) {
      const id = prontuarioParaId.get(r.prontuario);
      if (id) {
        const doCsv = pacientePorProntuario.get(r.prontuario);
        return { id, nome: (doCsv?.paciente ?? nomeLinha).trim() };
      }
    }
    if (!nomeLinha) return null;

    // (b) sem prontuário: só temos nome (+ telefone da linha). `acharExistente`
    // exige que o nome concorde, então o telefone aqui apenas confirma.
    const telefones = (r.telefones ?? '').split(/[\s,;/]+/).map(soDigitos).filter((t) => t.length >= 8);
    for (const tel of telefones) {
      const achado = acharExistente({ telefone: tel, nome: nomeLinha });
      if (achado) return { id: achado.id, nome: achado.nome };
    }
    // (c) nome exato e único
    const achado = acharExistente({ nome: nomeLinha, telefone: telefones[0] });
    if (achado) return { id: achado.id, nome: achado.nome };

    // (d) cria a partir do próprio agendamento (decisão 1)
    const chave = `${normalizarBusca(nomeLinha)}|${telefones[0] ?? ''}`;
    const jaCriado = criadosPorChave.get(chave);
    if (jaCriado) return { id: jaCriado.id, nome: jaCriado.nome };

    const novo: Paciente = {
      id: idDeterministico('pac_ag', chave),
      nome: nomeLinha,
      telefone: telefones[0] ?? '',
      convenioId: r.convenio ? acharConvenioId(r.convenio) : undefined,
      fichaMedica: fichaVazia(),
      criadoEm: agora,
      atualizadoEm: agora,
      ...derivarCamposBusca({ nome: nomeLinha, telefone: telefones[0] ?? '' }),
    };
    opsPacientes.push({ colecao: 'pacientes', id: novo.id, dados: novo, merge: false });
    indexar(novo);
    criadosPorChave.set(chave, novo);
    cont.pacientesCriadosDeAgendamento++;
    return { id: novo.id, nome: novo.nome };
  }

  /** aplica uma linha já normalizada (insert ou upsert conservador) */
  function aplicar(params: {
    pacienteId: string; pacienteNome: string; medicoId: string; exameId: string;
    convenioId: string; data: string; hora: string; observacao?: string; chaveOrigem: string;
  }) {
    const dur = DURACAO[params.exameId] ?? 15;
    const [hh, mm] = params.hora.split(':').map(Number);
    const inicioMin = hh * 60 + mm;
    const fimMin = inicioMin + dur;
    const inicio = `${params.data}T${params.hora}:00-03:00`;
    const fim = `${fimMin >= 1440 ? proximoDia(params.data) : params.data}T${minParaHHMM(fimMin % 1440)}:00-03:00`;

    // dedup dentro do próprio CSV
    const chaveCsv = `${params.pacienteId}|${inicio}|${params.exameId}`;
    if (chavesVistas.has(chaveCsv)) { cont.duplicataNoCsv++; return; }
    chavesVistas.add(chaveCsv);

    const existente =
      agPorChaveId.get(chaveCsv) ??
      agPorChaveNome.get(`${normalizarBusca(params.pacienteNome)}|${inicio}|${params.exameId}`);

    if (existente) {
      // NUNCA mexe no que a IA criou
      if (existente.origem === 'whatsapp') { cont.preservadoWhatsapp++; return; }
      const patch: Record<string, unknown> = {};
      if (params.convenioId && params.convenioId !== existente.convenioId) patch.convenioId = params.convenioId;
      if (params.medicoId && params.medicoId !== existente.medicoId) patch.medicoId = params.medicoId;
      if (params.observacao && params.observacao !== existente.observacao) patch.observacao = params.observacao;
      if (Object.keys(patch).length === 0) { cont.iguais++; return; }
      backupAgendamentos.push(existente);
      opsAgendamentos.push({ colecao: 'agendamentos', id: existente.id, dados: patch, merge: true });
      cont.atualizados++;
      return;
    }

    const futuro = params.data >= hojeJF;
    const status: StatusAgendamento = new Date(inicio).getTime() < Date.now() ? 'realizado' : 'agendado';
    const novo: Agendamento = {
      id: idDeterministico('ag_imp', params.chaveOrigem),
      pacienteId: params.pacienteId,
      pacienteNome: params.pacienteNome,
      medicoId: params.medicoId,
      exameId: params.exameId,
      convenioId: params.convenioId,
      inicio,
      fim,
      status,
      origem: 'sistema',
      observacao: params.observacao || undefined,
      criadoEm: agora,
      // decisão 2: não dispara lembrete retroativo para quem marcou no outro sistema
      ...(futuro && status === 'agendado' ? { lembreteEnviadoEm: agora } : {}),
    };
    opsAgendamentos.push({ colecao: 'agendamentos', id: novo.id, dados: novo, merge: false });
    agPorChaveId.set(chaveCsv, novo);
    cont.novos++;
  }

  // ---- 6a) examesvalidos ----
  for (const r of csvExames) {
    const exameId = EXAME_POR_CODIGO[r.codigo_procedimento];
    if (!exameId) { cont.foraCatalogo++; continue; }
    if (!dataValida(r.data) || !horaValida(r.hora)) { cont.dataHoraInvalida++; continue; }
    const [hh, mm] = r.hora.split(':').map(Number);
    if (hh > 23 || mm > 59) { cont.dataHoraInvalida++; continue; }
    const medicoBase = MEDICO_POR_NOME[r.medico];
    if (!medicoBase) { cont.medicoDesconhecido++; continue; }

    const pac = resolverPacienteDaLinha(r);
    if (!pac) { cont.semPacienteResolvido++; continue; }

    aplicar({
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      // mapa/holter são APARELHO: medicoId vira o aparelho virtual (ver engine.ts)
      medicoId: exameId === 'mapa' || exameId === 'holter' ? exameId : medicoBase,
      exameId,
      convenioId: acharConvenioId(r.convenio),
      data: r.data,
      hora: r.hora,
      observacao: r.complemento || undefined,
      chaveOrigem: `exa|${r.prontuario}|${normalizarBusca(r.paciente ?? '')}|${r.data}|${r.hora}|${exameId}`,
    });
  }

  // ---- 6b) mapasholters ----
  for (const r of csvMapas) {
    const sala = (r.sala_equipamento_fila ?? '').toUpperCase();
    const exameId = sala === 'HOLTER' ? 'holter' : sala === 'MAPA' ? 'mapa' : null;
    if (!exameId) { cont.foraCatalogo++; continue; }
    if (!dataValida(r.data) || !horaValida(r.hora)) { cont.dataHoraInvalida++; continue; }
    const [hh, mm] = r.hora.split(':').map(Number);
    if (hh > 23 || mm > 59) { cont.dataHoraInvalida++; continue; }

    const pac = resolverPacienteDaLinha(r);
    if (!pac) { cont.semPacienteResolvido++; continue; }

    const horaGrade = encaixarNaGradeDoAparelho(exameId, r.data, r.hora);
    if (horaGrade !== r.hora) cont.horaEncaixadaNaGrade++;

    aplicar({
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      medicoId: exameId, // aparelho virtual
      exameId,
      convenioId: acharConvenioId(r.convenio),
      data: r.data,
      hora: horaGrade,
      observacao: r.complemento || undefined,
      chaveOrigem: `mh|${r.prontuario}|${normalizarBusca(r.paciente ?? '')}|${r.data}|${r.hora}|${exameId}`,
    });
  }

  // bloqueio só é gravado se for usado
  if (cont.bloqueios > 0) {
    opsPacientes.unshift({ colecao: 'pacientes', id: PACIENTE_BLOQUEIO_ID, dados: pacienteBloqueio, merge: true });
  }

  // -------------------------------------------------------------
  // 7) relatório
  // -------------------------------------------------------------
  const orfaos = agendamentosProd.filter(
    (a) => !chavesVistas.has(`${a.pacienteId}|${a.inicio}|${a.exameId}`),
  );

  console.log('\n--- agendamentos ---');
  console.log(`  novos                        : ${cont.novos}`);
  console.log(`  atualizados (upsert)         : ${cont.atualizados}`);
  console.log(`  já iguais                    : ${cont.iguais}`);
  console.log(`  preservados (criados pela IA): ${cont.preservadoWhatsapp}`);
  console.log(`  bloqueios de agenda          : ${cont.bloqueios}`);
  console.log(`  fora do catálogo (ignorados) : ${cont.foraCatalogo}`);
  console.log(`  médico desconhecido          : ${cont.medicoDesconhecido}`);
  console.log(`  data/hora inválida           : ${cont.dataHoraInvalida}`);
  console.log(`  sem paciente resolvível      : ${cont.semPacienteResolvido}`);
  console.log(`  duplicata dentro do CSV      : ${cont.duplicataNoCsv}`);
  console.log(`  hora de aparelho encaixada na grade (±${TOLERANCIA_SLOT_MIN}min): ${cont.horaEncaixadaNaGrade}`);
  console.log(`\n  pacientes criados a partir de agendamento: ${cont.pacientesCriadosDeAgendamento}`);
  console.log(`  total de escritas em pacientes          : ${opsPacientes.length}`);
  console.log(`  total de escritas em agendamentos       : ${opsAgendamentos.length}`);
  console.log(`\n  PRESERVADOS (em produção, ausentes do CSV — nada é apagado): ${orfaos.length}`);
  const porOrigem: Record<string, number> = {};
  orfaos.forEach((a) => { porOrigem[a.origem] = (porOrigem[a.origem] ?? 0) + 1; });
  console.log(`    por origem: ${JSON.stringify(porOrigem)}`);

  if (DETALHE) {
    fs.mkdirSync('retroalimentacao/backups', { recursive: true });
    const arq = `retroalimentacao/backups/previa-${agora.replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(arq, JSON.stringify({
      geradoEm: agora,
      resumo: cont,
      motivoMatch,
      divergenciasDeIdentidadePreservadas: divergenciasProtegidas,
      campoMaisAlterado: diffsPacientes
        .flatMap((d) => Object.keys(d.mudancas))
        .reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {}),
      pacientesAlterados: diffsPacientes,
      pacientesCriados: opsPacientes.filter((o) => !o.merge).map((o) => o.dados),
      agendamentosCriados: opsAgendamentos.filter((o) => !o.merge).map((o) => o.dados),
      agendamentosAtualizados: opsAgendamentos.filter((o) => o.merge).map((o) => ({ id: o.id, patch: o.dados })),
      preservados: orfaos,
    }, null, 1), 'utf8');
    console.log(`\nprévia completa gravada em: ${arq}`);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] nada foi gravado.');
    console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    process.exit(0);
  }

  // -------------------------------------------------------------
  // 8) backup do que será tocado, ANTES de escrever
  // -------------------------------------------------------------
  const dirBackup = 'retroalimentacao/backups';
  fs.mkdirSync(dirBackup, { recursive: true });
  const carimbo = agora.replace(/[:.]/g, '-');
  const arquivoBackup = path.join(dirBackup, `backup-${carimbo}.json`);
  fs.writeFileSync(
    arquivoBackup,
    JSON.stringify(
      {
        geradoEm: agora,
        projeto: process.env.GCP_PROJECT_ID,
        janela: [JANELA_DE, JANELA_ATE],
        observacao: 'estado ANTERIOR dos documentos que este import alterou (docs novos não constam)',
        pacientesAlterados: backupPacientes,
        agendamentosAlterados: backupAgendamentos,
        idsCriadosPacientes: opsPacientes.filter((o) => !o.merge).map((o) => o.id),
        idsCriadosAgendamentos: opsAgendamentos.filter((o) => !o.merge).map((o) => o.id),
      },
      null,
      1,
    ),
    'utf8',
  );
  console.log(`\nbackup gravado: ${arquivoBackup}`);

  // -------------------------------------------------------------
  // 9) escrita
  // -------------------------------------------------------------
  console.log('\ngravando...');
  await commitEmLotes(opsPacientes, 'pacientes');
  await commitEmLotes(opsAgendamentos, 'agendamentos');

  // -------------------------------------------------------------
  // 10) conferência
  // -------------------------------------------------------------
  const totalPac = (await db.collection('pacientes').count().get()).data().count;
  const totalAgJanela = (
    await db.collection('agendamentos')
      .where('inicio', '>=', `${JANELA_DE}T00:00:00-03:00`)
      .where('inicio', '<=', `${JANELA_ATE}T23:59:59-03:00`)
      .count().get()
  ).data().count;
  console.log(`\nfinal: ${totalPac} pacientes | ${totalAgJanela} agendamentos na janela`);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
