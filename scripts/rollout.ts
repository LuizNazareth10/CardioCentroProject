/**
 * Inspeciona e fixa o ROLLOUT do agente direto no Firestore.
 *
 * Existe porque o valor gravado no Firestore tem PRIORIDADE sobre as variáveis
 * AGENTE_MODO / AGENTE_CANARY_PCT (ver mergeAgente em src/lib/clinic-config.ts).
 * Antes de abrir o canal do WhatsApp ao público, é preciso PROVAR que o modo
 * efetivo é o esperado — um `full` esquecido pela tela faria a IA atender 100%
 * dos pacientes no primeiro minuto do pareamento.
 *
 *   npm run rollout                 # mostra o estado efetivo (só leitura)
 *   npm run rollout canary 5        # fixa canary em 5%
 *   npm run rollout paused          # kill-switch
 *   npm run rollout shadow          # rascunho, não envia nada
 *   npm run rollout full            # atende todo mundo (pede confirmação)
 *
 * Requer GOOGLE_SERVICE_ACCOUNT_B64, GCP_PROJECT_ID e DATA_BACKEND=firestore
 * (lidos do ambiente ou do .env.local).
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// carrega .env.local manualmente (funciona igual em bash/PowerShell)
function carregarEnvLocal() {
  const p = join(process.cwd(), '.env.local');
  if (!existsSync(p)) return;
  for (const linha of readFileSync(p, 'utf8').split('\n')) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
carregarEnvLocal();

const MODOS = ['full', 'shadow', 'canary', 'paused'] as const;
type Modo = (typeof MODOS)[number];

const [modoArg, pctArg] = process.argv.slice(2);

async function main() {
  if (process.env.DATA_BACKEND !== 'firestore') {
    console.error('❌ DATA_BACKEND precisa ser "firestore" (confira o .env.local).');
    process.exit(1);
  }

  const { db } = await import('../src/lib/db/firestore');
  const ref = db().collection('config').doc('clinic');
  const snap = await ref.get();
  const atual = (snap.data() as { agente?: { modo?: string; canaryPct?: number; ativo?: boolean } } | undefined)?.agente;

  // ---------- leitura ----------
  if (!modoArg) {
    console.log('\n📊 Rollout efetivo do agente\n');
    console.log(`   Firestore (config/clinic):  ${descrever(atual)}`);
    console.log(`   Ambiente (fallback):        modo=${process.env.AGENTE_MODO ?? '(não definido → full)'} · pct=${process.env.AGENTE_CANARY_PCT ?? '0'}`);
    console.log(`   Allowlist de QA:            ${process.env.EVOLUTION_NUMEROS_TESTE?.trim() || '(vazia → canal ABERTO ao público)'}`);
    console.log('');
    if (atual?.modo) {
      console.log(`   → Vale o do Firestore: ${atual.modo}${atual.modo === 'canary' ? ` ${atual.canaryPct ?? 0}%` : ''}`);
    } else {
      console.log(`   → Firestore não define modo; vale o ambiente.`);
    }
    if (atual?.ativo === false) {
      console.log('   ⚠️  agente.ativo=false — modo manual: TODA mensagem vai para a fila humana,');
      console.log('       independentemente do modo de rollout acima.');
    }
    console.log('\n   Para fixar:  npm run rollout canary 5\n');
    return;
  }

  // ---------- escrita ----------
  if (!MODOS.includes(modoArg as Modo)) {
    console.error(`❌ Modo inválido: "${modoArg}". Use um de: ${MODOS.join(' · ')}`);
    process.exit(1);
  }
  const modo = modoArg as Modo;

  let canaryPct = Number(pctArg);
  if (modo === 'canary') {
    if (!Number.isFinite(canaryPct) || canaryPct < 0 || canaryPct > 100) {
      console.error('❌ canary exige uma porcentagem 0–100. Ex.: npm run rollout canary 5');
      process.exit(1);
    }
  } else {
    canaryPct = atual?.canaryPct ?? 0; // preserva o valor para quando voltar ao canary
  }

  if (modo === 'full' && process.env.ROLLOUT_CONFIRMA_FULL !== '1') {
    console.error('\n⚠️  "full" faz a IA atender 100% dos pacientes do WhatsApp da clínica.');
    console.error('   Se é isso mesmo, rode de novo com:');
    console.error('     ROLLOUT_CONFIRMA_FULL=1 npm run rollout full\n');
    process.exit(1);
  }

  await ref.set(
    { agente: { ...(atual ?? {}), modo, canaryPct }, atualizadoEm: new Date().toISOString() },
    { merge: true },
  );

  console.log(`\n✅ Rollout gravado: ${modo}${modo === 'canary' ? ` ${canaryPct}%` : ''}`);
  console.log('   Vale nas PRÓXIMAS mensagens — sem redeploy.\n');
}

function descrever(a?: { modo?: string; canaryPct?: number }): string {
  if (!a?.modo) return '(não definido)';
  return a.modo === 'canary' ? `canary ${a.canaryPct ?? 0}%` : a.modo;
}

main().catch((e) => {
  console.error('❌ Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
