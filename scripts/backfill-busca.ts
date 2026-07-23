/**
 * Backfill dos campos de busca indexáveis.
 *
 * POR QUE ISTO É OBRIGATÓRIO: a camada de dados passou a filtrar no
 * Firestore (`where nomeBusca / cpfDigitos / telefoneSufixo`) em vez de
 * ler a coleção inteira. Os ~19 mil pacientes e os leads que já estavam
 * no banco foram gravados ANTES desses campos existirem — sem o backfill
 * eles simplesmente não aparecem em nenhuma busca.
 *
 * Rodar UMA vez após o deploy desta versão:
 *   npx tsx scripts/backfill-busca.ts            # aplica
 *   npx tsx scripts/backfill-busca.ts --dry-run  # só relata
 *
 * É idempotente: documentos que já têm os campos corretos são pulados,
 * então pode ser re-executado sem risco.
 */
import * as nodeFs from 'fs';
import { derivarCamposBusca } from '../src/lib/db';
import type { Lead, Paciente } from '../src/lib/types';

// mesma convenção dos outros scripts: lê .env.local sem depender de dotenv
function carregarEnvLocal() {
  const p = '.env.local';
  if (!nodeFs.existsSync(p)) return;
  for (const linha of nodeFs.readFileSync(p, 'utf8').split('\n')) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
carregarEnvLocal();

const DRY_RUN = process.argv.includes('--dry-run');
const TAMANHO_LOTE = 400; // limite do batch do Firestore é 500

async function db() {
  const { db } = await import('../src/lib/db/firestore');
  return db();
}

const soDigitos = (v?: string) => (v ?? '').replace(/\D/g, '');

async function backfillPacientes(): Promise<{ lidos: number; atualizados: number }> {
  const firestore = await db();
  const snap = await firestore.collection('pacientes').get();
  let atualizados = 0;
  let lote = firestore.batch();
  let noLote = 0;

  for (const doc of snap.docs) {
    const p = doc.data() as Paciente;
    const campos = derivarCamposBusca(p);
    const jaOk =
      p.nomeBusca === campos.nomeBusca &&
      p.cpfDigitos === campos.cpfDigitos &&
      p.telefoneSufixo === campos.telefoneSufixo;
    if (jaOk) continue;

    atualizados++;
    if (DRY_RUN) continue;

    lote.set(doc.ref, campos, { merge: true });
    noLote++;
    if (noLote >= TAMANHO_LOTE) {
      await lote.commit();
      console.log(`  … ${atualizados} pacientes atualizados`);
      lote = firestore.batch();
      noLote = 0;
    }
  }
  if (!DRY_RUN && noLote > 0) await lote.commit();
  return { lidos: snap.size, atualizados };
}

async function backfillLeads(): Promise<{ lidos: number; atualizados: number }> {
  const firestore = await db();
  const snap = await firestore.collection('leads').get();
  let atualizados = 0;
  let lote = firestore.batch();
  let noLote = 0;

  for (const doc of snap.docs) {
    const l = doc.data() as Lead;
    const sufixo = soDigitos(l.telefone).slice(-8);
    if (l.telefoneSufixo === sufixo) continue;

    atualizados++;
    if (DRY_RUN) continue;

    lote.set(doc.ref, { telefoneSufixo: sufixo }, { merge: true });
    noLote++;
    if (noLote >= TAMANHO_LOTE) {
      await lote.commit();
      lote = firestore.batch();
      noLote = 0;
    }
  }
  if (!DRY_RUN && noLote > 0) await lote.commit();
  return { lidos: snap.size, atualizados };
}

async function main() {
  if (process.env.DATA_BACKEND !== 'firestore') {
    console.error('DATA_BACKEND precisa ser "firestore" (confira o .env.local).');
    process.exit(1);
  }
  console.log(DRY_RUN ? '— SIMULAÇÃO (nada será gravado) —\n' : '— APLICANDO —\n');

  console.log('Pacientes…');
  const pac = await backfillPacientes();
  console.log(`  ${pac.lidos} lidos · ${pac.atualizados} ${DRY_RUN ? 'precisam de update' : 'atualizados'}\n`);

  console.log('Leads…');
  const leads = await backfillLeads();
  console.log(`  ${leads.lidos} lidos · ${leads.atualizados} ${DRY_RUN ? 'precisam de update' : 'atualizados'}\n`);

  console.log('Pronto.');
  if (DRY_RUN) console.log('Rode sem --dry-run para aplicar.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
