/**
 * Reseta o ambiente de teste: apaga TODOS os pacientes, agendamentos e
 * triagens de produção (Firestore) e reimporta do zero a partir de
 * retroalimentacao/pacientes.CSV e retroalimentacao/agendas.CSV.
 *
 * Uso:
 *   npx tsx scripts/reset-retroalimentacao.ts --dry-run   (não escreve nada, só relatório)
 *   npx tsx scripts/reset-retroalimentacao.ts             (executa de verdade)
 *
 * Decisões de modelagem (confirmadas com o dono do produto em 2026-07-20):
 *   - Médicos "TASSIANA MIRANDA CAMPOS" e "VAGNER DE CAMPOS SILVA" (que não
 *     tinham entrada no catálogo) foram adicionados como médicos inativos
 *     em src/lib/seed-data.ts (med-tassiana-campos, med-vagner-silva).
 *   - Procedimentos que não são um dos 6 exames do catálogo (consulta,
 *     retorno, ECG simples, linhas sem procedimento) NÃO são importados
 *     como agendamento — só o paciente é criado.
 *   - Status: agendamentos com `inicio` no passado (< agora) viram
 *     'realizado'; no futuro, 'agendado'. O CSV não tem status real
 *     (cancelado/faltou), então essa é uma aproximação conhecida.
 *   - Linhas de agendas.CSV sem `prontuario`, ou com `prontuario` que não
 *     bate com nenhum paciente importado, são puladas (não há como linkar).
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import { CONVENIOS, EXAMES } from '../src/lib/seed-data';
import type { Agendamento, FichaMedica, Paciente, Sexo, StatusAgendamento } from '../src/lib/types';

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

const DRY_RUN = process.argv.includes('--dry-run');

const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 não configurada');
const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
const app = initializeApp({ credential: cert(serviceAccount), projectId: process.env.GCP_PROJECT_ID });
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------
// parser CSV correto (aspas, aspas escapadas "", newline embutido)
// ---------------------------------------------------------------
function parseCsv(content: string, delimiter = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = content.length;
  while (i < len) {
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

function linhasComoObjetos(rows: string[][]): Array<Record<string, string>> {
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
}

// ---------------------------------------------------------------
// convênio: mesma lógica de casamento tolerante usada no agente do WhatsApp
// ---------------------------------------------------------------
function normalizarTexto(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}
const OUTROS_ID = CONVENIOS.find((c) => c.nome === 'Outros')!.id;
function acharConvenioId(texto: string): string {
  const n = normalizarTexto(texto);
  if (!n) return OUTROS_ID;
  const exato = CONVENIOS.find((c) => normalizarTexto(c.nome) === n);
  if (exato) return exato.id;
  const parcial = CONVENIOS.find((c) => {
    const cn = normalizarTexto(c.nome);
    return cn.includes(n) || n.includes(cn);
  });
  return parcial?.id ?? OUTROS_ID;
}

// ---------------------------------------------------------------
// médico: mapa fixo dos 9 nomes encontrados em agendas.CSV
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// procedimento -> exame do catálogo (só os 6 reais; resto é ignorado)
// ---------------------------------------------------------------
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

function fichaVazia(): FichaMedica {
  return {
    hipertensao: false, diabetes: false, dislipidemia: false, tabagismo: false,
    etilismo: false, sedentarismo: false, iamPrevio: false, avcPrevio: false,
    doencaRenal: false, marcapasso: false, histFamiliarDac: false, histFamiliarMorteSubita: false,
  };
}

function escolherTelefone(f: Record<string, string>): string {
  const pares = [1, 2, 3, 4].map((n) => ({ tipo: (f[`tipo_de_telefone_${n}`] ?? '').toUpperCase(), num: f[`telefone_${n}`] ?? '' }));
  const whats = pares.find((p) => p.tipo === 'WHATSAPP' && p.num.trim());
  if (whats) return whats.num.trim();
  const cel = pares.find((p) => p.tipo === 'CELULAR' && p.num.trim());
  if (cel) return cel.num.trim();
  const qualquer = pares.find((p) => p.num.trim());
  return qualquer ? qualquer.num.trim() : '';
}

function montarEndereco(f: Record<string, string>): string | undefined {
  const partes = [
    [f.tipo_logradouro, f.logradouro].filter(Boolean).join(' ').trim(),
    f.numero,
    f.complemento,
    f.bairro,
    f.uf,
    f.cep,
  ].map((s) => (s ?? '').trim()).filter(Boolean);
  return partes.length ? partes.join(', ') : undefined;
}

function minParaHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function proximoDia(dataIso: string): string {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function sexoDe(v: string): Sexo | undefined {
  if (v === 'Masculino') return 'M';
  if (v === 'Feminino') return 'F';
  return undefined;
}

// ---------------------------------------------------------------
// apaga TODOS os docs de uma coleção, em lotes
// ---------------------------------------------------------------
async function apagarColecaoInteira(dbi: Firestore, colecao: string): Promise<number> {
  let total = 0;
  while (true) {
    const snap = await dbi.collection(colecao).limit(450).get();
    if (snap.empty) break;
    const batch = dbi.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    console.log(`  apagados ${total} de ${colecao}...`);
  }
  return total;
}

async function gravarEmLotes<T extends { id: string }>(dbi: Firestore, colecao: string, itens: T[]) {
  for (let i = 0; i < itens.length; i += 450) {
    const lote = itens.slice(i, i + 450);
    const batch = dbi.batch();
    for (const item of lote) batch.set(dbi.collection(colecao).doc(item.id), item);
    await batch.commit();
    console.log(`  gravados ${Math.min(i + 450, itens.length)}/${itens.length} em ${colecao}`);
  }
}

// ---------------------------------------------------------------
// main
// ---------------------------------------------------------------
async function main() {
  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Reset de retroalimentação — projeto: ${process.env.GCP_PROJECT_ID}\n`);

  // ---- 1) parse pacientes.CSV ----
  const pacRows = linhasComoObjetos(parseCsv(fs.readFileSync('retroalimentacao/pacientes.CSV', 'latin1')));
  console.log('pacientes.CSV: ', pacRows.length, 'linhas');

  const prontuarioParaPacienteId = new Map<string, string>();
  const pacientes: Paciente[] = [];
  let pacientesSemNome = 0;

  for (const f of pacRows) {
    const nome = f.paciente?.trim();
    if (!nome) { pacientesSemNome++; continue; }
    const id = uid('pac');
    prontuarioParaPacienteId.set(f.prontuario, id);
    const criadoEm = f.data_de_cadastro ? `${f.data_de_cadastro}T00:00:00-03:00` : new Date().toISOString();
    pacientes.push({
      id,
      nome,
      cpf: f.cpf || undefined,
      dataNascimento: f.data_de_nascimento || undefined,
      sexo: sexoDe(f.sexo),
      telefone: escolherTelefone(f),
      email: f.email || undefined,
      endereco: montarEndereco(f),
      convenioId: f.convenio_1 ? acharConvenioId(f.convenio_1) : undefined,
      carteirinha: f.numero_de_matricula_carteira_1 || undefined,
      fichaMedica: fichaVazia(),
      criadoEm,
      atualizadoEm: criadoEm,
    });
  }
  console.log('pacientes válidos:', pacientes.length, '| sem nome (pulados):', pacientesSemNome);

  // ---- 2) parse agendas.CSV ----
  const agRows = linhasComoObjetos(parseCsv(fs.readFileSync('retroalimentacao/agendas.CSV', 'latin1')));
  console.log('\nagendas.CSV:', agRows.length, 'linhas');

  const agora = new Date().toISOString();
  const agendamentos: Agendamento[] = [];
  let semProntuario = 0, prontuarioNaoEncontrado = 0, procedimentoIgnorado = 0, medicoDesconhecido = 0, dataHoraInvalida = 0;

  for (const f of agRows) {
    if (!f.prontuario) { semProntuario++; continue; }
    const pacienteId = prontuarioParaPacienteId.get(f.prontuario);
    if (!pacienteId) { prontuarioNaoEncontrado++; continue; }
    const exameId = EXAME_POR_CODIGO[f.codigo_procedimento];
    if (!exameId) { procedimentoIgnorado++; continue; }
    const medicoId = MEDICO_POR_NOME[f.medico];
    if (!medicoId) { medicoDesconhecido++; continue; }
    if (!f.data || !f.hora) { dataHoraInvalida++; continue; }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data) || !/^\d{2}:\d{2}$/.test(f.hora)) { dataHoraInvalida++; continue; }
    const dur = EXAMES.find((e) => e.id === exameId)?.duracaoMin ?? 15;
    const [hh, mm] = f.hora.split(':').map(Number);
    if (hh > 23 || mm > 59) { dataHoraInvalida++; continue; }
    const inicioMin = hh * 60 + mm;
    const fimMin = inicioMin + dur;
    // constrói local (-03:00) direto por string, sem passar por Date/UTC —
    // mantém o mesmo formato de `inicio` mesmo virando a meia-noite.
    const dataFim = fimMin >= 1440 ? proximoDia(f.data) : f.data;
    const inicio = `${f.data}T${f.hora}:00-03:00`;
    const fim = `${dataFim}T${minParaHHMM(fimMin % 1440)}:00-03:00`;

    const status: StatusAgendamento = new Date(inicio) < new Date(agora) ? 'realizado' : 'agendado';
    const paciente = pacientes.find((p) => p.id === pacienteId)!;

    agendamentos.push({
      id: uid('ag'),
      pacienteId,
      pacienteNome: paciente.nome,
      medicoId: exameId === 'mapa' || exameId === 'holter' ? exameId : medicoId,
      exameId,
      convenioId: acharConvenioId(f.convenio),
      inicio,
      fim,
      status,
      origem: 'sistema',
      observacao: f.complemento || undefined,
      criadoEm: agora,
    });
  }

  console.log('agendamentos válidos:', agendamentos.length);
  console.log('  sem prontuario:', semProntuario);
  console.log('  prontuario não encontrado no pacientes.CSV:', prontuarioNaoEncontrado);
  console.log('  procedimento fora do catálogo (ignorado):', procedimentoIgnorado);
  console.log('  médico desconhecido:', medicoDesconhecido);
  console.log('  data/hora inválida:', dataHoraInvalida);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Nada foi apagado nem gravado. Resumo final esperado:');
    console.log('  pacientes a gravar:', pacientes.length);
    console.log('  agendamentos a gravar:', agendamentos.length);
    process.exit(0);
  }

  // ---- 3) apaga tudo ----
  console.log('\nApagando coleções existentes...');
  const apagadosAg = await apagarColecaoInteira(db, 'agendamentos');
  const apagadosPac = await apagarColecaoInteira(db, 'pacientes');
  const apagadosTri = await apagarColecaoInteira(db, 'triagens');
  console.log(`Apagados: ${apagadosPac} pacientes, ${apagadosAg} agendamentos, ${apagadosTri} triagens.`);

  // ---- 4) grava do zero ----
  console.log('\nGravando pacientes...');
  await gravarEmLotes(db, 'pacientes', pacientes);
  console.log('\nGravando agendamentos...');
  await gravarEmLotes(db, 'agendamentos', agendamentos);

  // ---- 5) confere ----
  const totalPac = (await db.collection('pacientes').count().get()).data().count;
  const totalAg = (await db.collection('agendamentos').count().get()).data().count;
  console.log(`\nTotal final: ${totalPac} pacientes, ${totalAg} agendamentos.`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
