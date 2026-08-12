/**
 * Testa a distinção "eco do próprio agente" x "recepção digitando", que
 * decide se a conversa vira handoff humano (foiEnviadoPeloAgente,
 * evolution.ts). Usa o Firestore REAL porque as duas coleções envolvidas
 * (evolution_msgs_agente, evolution_envios_em_voo) não têm fallback em memória.
 *
 * O caso que motivou estes testes derrubou atendimentos em produção: o
 * Baileys emite o webhook do `fromMe` da mensagem que o agente acabou de
 * mandar ANTES de `/message/sendText` retornar o id para gravarmos. Quando o
 * webhook ganhava essa corrida, o agente lia a própria resposta como se
 * fosse a recepção e se calava sozinho até a sessão expirar.
 *
 * Requer .env.local com GOOGLE_SERVICE_ACCOUNT_B64 / GCP_PROJECT_ID /
 * DATA_BACKEND=firestore.
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

let falhas = 0;
function checar(nome: string, cond: boolean) {
  if (cond) console.log(`✅ ${nome}`);
  else { console.log(`❌ ${nome}`); falhas++; }
}

const NUM = '5599999990009';
const ID_GRAVADO = '_TESTE_ECO_GRAVADO_';
const ID_DESCONHECIDO = '_TESTE_ECO_DESCONHECIDO_';

async function main() {
  if (process.env.DATA_BACKEND !== 'firestore') {
    console.error('❌ DATA_BACKEND precisa ser "firestore" (confira o .env.local).');
    process.exit(1);
  }
  const { db } = await import('../src/lib/db/firestore');
  const { foiEnviadoPeloAgente } = await import('../src/lib/whatsapp/evolution');

  const envios = db().collection('evolution_envios_em_voo').doc(NUM);
  const msgs = db().collection('evolution_msgs_agente').doc(ID_GRAVADO);

  try {
    // limpa qualquer resíduo
    await envios.delete().catch(() => {});
    await msgs.delete().catch(() => {});

    // ---- 1) id já gravado → eco, sem depender de janela nenhuma ----
    await msgs.set({ enviadoEm: new Date().toISOString() });
    checar('id conhecido é reconhecido como eco do agente', (await foiEnviadoPeloAgente(ID_GRAVADO, NUM)) === true);

    // ---- 2) A CORRIDA: id ainda NÃO gravado, mas o agente acabou de enviar ----
    await envios.set({ em: Date.now() });
    checar(
      'CORRIDA: id ainda não gravado + envio agora → ainda é eco (não vira handoff)',
      (await foiEnviadoPeloAgente(ID_DESCONHECIDO, NUM)) === true,
    );

    // ---- 3) recepção de verdade: nenhum envio recente do agente ----
    await envios.delete();
    checar(
      'sem envio recente do agente → é a recepção (vira handoff)',
      (await foiEnviadoPeloAgente(ID_DESCONHECIDO, NUM)) === false,
    );

    // ---- 4) envio ANTIGO não segura o handoff para sempre ----
    await envios.set({ em: Date.now() - 60_000 }); // 1 min atrás, fora da janela
    checar(
      'envio antigo (1 min) não conta como eco → recepção assume normalmente',
      (await foiEnviadoPeloAgente(ID_DESCONHECIDO, NUM)) === false,
    );

    // ---- 5) envio recente para OUTRO número não vale para este ----
    await envios.delete();
    const outro = db().collection('evolution_envios_em_voo').doc('5599999990008');
    await outro.set({ em: Date.now() });
    checar(
      'envio recente para outro número não protege esta conversa',
      (await foiEnviadoPeloAgente(ID_DESCONHECIDO, NUM)) === false,
    );
    await outro.delete();

    // ---- 6) sem id não arrisca handoff (comportamento antigo, preservado) ----
    checar('mensagem sem id nenhum → não vira handoff', (await foiEnviadoPeloAgente(undefined, NUM)) === true);
  } finally {
    await envios.delete().catch(() => {});
    await msgs.delete().catch(() => {});
  }

  console.log(falhas === 0 ? '\nResumo: TODOS OS TESTES PASSARAM 🎉' : `\nResumo: ${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => { console.error('❌ Falhou:', e instanceof Error ? e.message : e); process.exit(1); });
