/**
 * Testes do rollout do agente (src/lib/whatsapp/rollout.ts).
 *
 * Protege a regra pedida pela clínica durante a fase de testes: "pausado"
 * deve silenciar todo mundo, MENOS os números de teste (allowlist) — sem
 * essa exceção, nem o próprio QA da clínica recebe resposta, que foi
 * exatamente o incidente que motivou este teste. Rodar com `npm run test:rollout`.
 */
import { decidirRollout } from '../src/lib/whatsapp/rollout';

let falhas = 0;
function check(nome: string, cond: boolean) {
  console.log(`${cond ? '✅' : '❌'} ${nome}`);
  if (!cond) falhas++;
}

const QA = '5532999952138';
const CLIENTE = '5532988887777';

// ---- 1: pausado — silêncio para todo mundo, MENOS a allowlist ----
check('Pausado: cliente comum NÃO é atendido', !decidirRollout(CLIENTE, { modo: 'paused', canaryPct: 0 }, false).atende);
check('Pausado: número de teste (allowlist) É atendido', decidirRollout(QA, { modo: 'paused', canaryPct: 0 }, true).atende);
check('Pausado: allowlist recebe resposta REAL (não shadow)', !decidirRollout(QA, { modo: 'paused', canaryPct: 0 }, true).shadow);

// ---- 2: shadow — rascunho para TODOS, sem exceção (nem para a allowlist) ----
const shadowQa = decidirRollout(QA, { modo: 'shadow', canaryPct: 0 }, true);
check('Shadow: atende (roda o agente)', shadowQa.atende);
check('Shadow: mesmo a allowlist só recebe rascunho', shadowQa.shadow);
check('Shadow: cliente comum também só rascunho', decidirRollout(CLIENTE, { modo: 'shadow', canaryPct: 0 }, false).shadow);

// ---- 3: canary — só a % configurada, além da allowlist sempre ----
check('Canary 0%: cliente fora do bucket não é atendido', !decidirRollout(CLIENTE, { modo: 'canary', canaryPct: 0 }, false).atende);
check('Canary 0%: allowlist sempre atendida mesmo com 0%', decidirRollout(QA, { modo: 'canary', canaryPct: 0 }, true).atende);
check('Canary 100%: todo mundo atendido', decidirRollout(CLIENTE, { modo: 'canary', canaryPct: 100 }, false).atende);

// ---- 4: full — atende todo mundo ----
check('Full: cliente comum atendido', decidirRollout(CLIENTE, { modo: 'full', canaryPct: 0 }, false).atende);
check('Full: allowlist atendida', decidirRollout(QA, { modo: 'full', canaryPct: 0 }, true).atende);

// ---- 5: o mesmo número cai sempre no mesmo bucket (canary não é aleatório a cada mensagem) ----
const b1 = decidirRollout(CLIENTE, { modo: 'canary', canaryPct: 50 }, false).bucket;
const b2 = decidirRollout(CLIENTE, { modo: 'canary', canaryPct: 50 }, false).bucket;
check('Bucket é estável para o mesmo número', b1 === b2);

console.log('\nResumo:', falhas === 0 ? 'TODOS OS TESTES PASSARAM 🎉' : `${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
