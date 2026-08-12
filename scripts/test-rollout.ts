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

// ---- 6: CANAL ABERTO (allowlist vazia) — o regime de produção -------------
// Com EVOLUTION_NUMEROS_TESTE vazia, o webhook passa sempreAtende=false para
// TODO paciente real, e é só o canary que segura o volume. Estes testes
// protegem a promessa feita à clínica: "5% significa ~5%, e ninguém troca de
// lado no meio da conversa".
const populacao = Array.from({ length: 4000 }, (_, i) => `5532${String(900000000 + i * 7)}`);

function fatiaAtendida(pct: number): number {
  const n = populacao.filter((t) => decidirRollout(t, { modo: 'canary', canaryPct: pct }, false).atende).length;
  return (n / populacao.length) * 100;
}

const fatia5 = fatiaAtendida(5);
check(`Canary 5% atende perto de 5% da população real (obteve ${fatia5.toFixed(1)}%)`, fatia5 > 3 && fatia5 < 7.5);
check('Canary 0% com canal aberto não atende NINGUÉM', fatiaAtendida(0) === 0);
check('Canary 100% com canal aberto atende todo mundo', fatiaAtendida(100) === 100);

// crescer o percentual só ADICIONA gente — quem já era da IA continua sendo
// (senão um paciente trocaria de atendente ao subirmos 5% → 10%)
const em5 = new Set(populacao.filter((t) => decidirRollout(t, { modo: 'canary', canaryPct: 5 }, false).atende));
const em10 = new Set(populacao.filter((t) => decidirRollout(t, { modo: 'canary', canaryPct: 10 }, false).atende));
check('Subir 5%→10% não tira ninguém da IA (rollout é monotônico)', [...em5].every((t) => em10.has(t)));

// pausar com o canal aberto é silêncio TOTAL — não há allowlist para poupar
check('Pausado + canal aberto: nem o QA é atendido', !decidirRollout(QA, { modo: 'paused', canaryPct: 5 }, false).atende);

// ---- 7: silêncio de 4h+ dá cobertura total, mesmo fora do bucket -----------
// Conversa abandonada há 4h+ não está sendo respondida por ninguém — a IA
// assume mesmo fora da fatia normal do canary, pra não deixar o lead parado.
check(
  'Canary 5%: cliente FORA do bucket, mas 4h+ de silêncio → atende mesmo assim',
  decidirRollout(CLIENTE, { modo: 'canary', canaryPct: 5 }, false, 4).atende,
);
check(
  'Canary 5%: cliente FORA do bucket, exatamente no limiar (4.0h) → atende',
  decidirRollout(CLIENTE, { modo: 'canary', canaryPct: 5 }, false, 4.0).atende,
);
check(
  'Canary 5%: cliente FORA do bucket, com só 3h de silêncio → continua na regra normal (não atende)',
  !decidirRollout(CLIENTE, { modo: 'canary', canaryPct: 5 }, false, 3).atende,
);
check(
  'Canary 5%: cliente FORA do bucket, sem NUNCA ter conversado (null) → não força atendimento (não é "silêncio", é lead novo)',
  !decidirRollout(CLIENTE, { modo: 'canary', canaryPct: 5 }, false, null).atende,
);
check(
  'Canary 5%: sem passar horasSilencio (default) → comportamento de sempre preservado',
  !decidirRollout(CLIENTE, { modo: 'canary', canaryPct: 5 }, false).atende,
);
check(
  'Canary: silêncio 4h+ não afeta modo full (já atende todo mundo de qualquer forma)',
  decidirRollout(CLIENTE, { modo: 'full', canaryPct: 0 }, false, 10).atende,
);

console.log('\nResumo:', falhas === 0 ? 'TODOS OS TESTES PASSARAM 🎉' : `${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
