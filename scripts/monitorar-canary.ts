/**
 * Acompanha em tempo real os eventos do canary (agente_eventos) e os
 * agendamentos criados pelo agente, direto do Firestore — sem depender do
 * painel web nem da CLI da Vercel.
 *
 *   npm run monitorar          # mostra os últimos eventos e continua ouvindo
 *
 * Requer .env.local com GOOGLE_SERVICE_ACCOUNT_B64 / GCP_PROJECT_ID / DATA_BACKEND=firestore.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function carregarEnvLocal() {
  const p = join(process.cwd(), '.env.local');
  if (!existsSync(p)) return;
  for (const linha of readFileSync(p, 'utf8').split('\n')) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
carregarEnvLocal();

async function main() {
  if (process.env.DATA_BACKEND !== 'firestore') {
    console.error('❌ DATA_BACKEND precisa ser "firestore" (confira o .env.local).');
    process.exit(1);
  }
  const { db } = await import('../src/lib/db/firestore');

  console.log('\n👀 Monitorando agente_eventos (Ctrl+C para sair)\n');

  let ultimoTs: string | null = null;

  async function checar() {
    const snap = await db().collection('agente_eventos').orderBy('ts', 'desc').limit(20).get();
    const eventos = snap.docs.map((d) => d.data() as Record<string, unknown>).reverse();
    for (const e of eventos) {
      const ts = String(e.ts ?? '');
      if (ultimoTs && ts <= ultimoTs) continue;
      const hora = ts.slice(11, 19);
      const desfecho = String(e.desfecho ?? '?');
      const icone =
        desfecho === 'atendido' ? '🤖' : desfecho === 'erro' ? '🔴' : desfecho === 'shadow' ? '🕵️' : '👤';
      console.log(
        `${icone} ${hora}  ${String(e.numero ?? '?').padEnd(10)} bucket=${e.bucket}  ${desfecho}  ${e.motivo ?? ''}${e.ms ? ` (${e.ms}ms)` : ''}${e.erro ? `  ⚠️ ${e.erro}` : ''}`,
      );
    }
    if (eventos.length) ultimoTs = String(eventos[eventos.length - 1].ts);
  }

  await checar();
  setInterval(checar, 5000);
}

main().catch((e) => {
  console.error('❌ Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
