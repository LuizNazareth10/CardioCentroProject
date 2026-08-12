/**
 * Testa o escape "Falar com atendente" — precisa funcionar em QUALQUER etapa
 * da conversa, não só no menu principal. Motivado pelo caso do Jeff: ele se
 * confundiu na numeração de um menu no meio do fluxo e não tinha como pedir
 * ajuda humana ali (só existia no menu inicial).
 *
 * Roda em memória (sem Firestore) — testa a lógica de agent.ts diretamente,
 * usando processarMensagem como o webhook usa.
 */
import { processarMensagem } from '../src/lib/whatsapp/agent';
import { carregarSessao } from '../src/lib/whatsapp/session';

const orig = console.log;
console.log = (...a: unknown[]) => { if (!String(a[0]).startsWith('[whatsapp:dev]')) orig(...a); };

let falhas = 0;
function check(n: string, c: boolean) { orig(`${c ? '✅' : '❌'} ${n}`); if (!c) falhas++; }

async function passo(from: string, valor: string, tipo: 'texto' | 'interativo' = 'interativo') {
  await processarMensagem(from, { tipo, valor });
}

async function estaEmHumano(from: string): Promise<boolean> {
  return (await carregarSessao(from)).etapa === 'humano';
}

async function run() {
  // ---------- escolhendo_exames: botão 'falar_humano' ----------
  const n1 = '5532900000001';
  await passo(n1, 'oi', 'texto');
  await passo(n1, 'agendar');
  await passo(n1, 'ex:eco-doppler');
  // aqui ele está no menu "Adicionar exame / Ver horários / Falar c/ atendente"
  await passo(n1, 'falar_humano');
  check('escolhendo_exames (pós-seleção): botão falar_humano escapa', await estaEmHumano(n1));

  // ---------- confirmando_idade: texto livre "atendente" ----------
  const n2 = '5532900000002';
  await passo(n2, 'oi', 'texto');
  await passo(n2, 'agendar');
  await passo(n2, 'ex:mapa');
  await passo(n2, 'concluir_exames'); // pergunta idade
  await passo(n2, 'quero falar com um atendente, por favor', 'texto');
  check('confirmando_idade: texto livre "atendente" escapa', await estaEmHumano(n2));

  // ---------- escolhendo_medico: botão ----------
  const n3 = '5532900000003';
  await passo(n3, 'oi', 'texto');
  await passo(n3, 'agendar');
  await passo(n3, 'ex:eco-doppler');
  await passo(n3, 'concluir_exames');
  await passo(n3, 'idade_adulto'); // pergunta preferência de médico
  await passo(n3, 'falar_humano');
  check('escolhendo_medico: botão falar_humano escapa', await estaEmHumano(n3));

  // ---------- escolhendo_horario: texto livre "humano" ----------
  const n4 = '5532900000004';
  await passo(n4, 'oi', 'texto');
  await passo(n4, 'agendar');
  await passo(n4, 'ex:eco-doppler');
  await passo(n4, 'concluir_exames');
  await passo(n4, 'idade_adulto');
  await passo(n4, 'med_qualquer'); // mostra horários
  await passo(n4, 'prefiro falar com humano', 'texto');
  check('escolhendo_horario: texto livre "humano" escapa', await estaEmHumano(n4));

  // ---------- menu principal: continua funcionando (comportamento antigo) ----------
  const n5 = '5532900000005';
  await passo(n5, 'oi', 'texto');
  await passo(n5, 'falar_humano');
  check('menu principal: botão falar_humano continua funcionando', await estaEmHumano(n5));

  // ---------- já em humano: mensagem comum NÃO reaciona nada, só registra ----------
  const n6 = '5532900000006';
  await passo(n6, 'oi', 'texto');
  await passo(n6, 'falar_humano');
  await passo(n6, 'oi de novo', 'texto'); // não deve tirar da fila humana
  check('já em humano: continua em humano após nova mensagem comum', await estaEmHumano(n6));

  // ---------- palavra "pessoa" solta não deveria disparar em contexto de nome ----------
  // (checa que o texto de nome comum continua indo pro fluxo normal, sem
  // falso positivo grosseiro nas palavras mais óbvias do dia a dia)
  const n7 = '5532900000007';
  await passo(n7, 'oi', 'texto');
  await passo(n7, 'agendar');
  await passo(n7, 'ex:eco-doppler');
  await passo(n7, 'concluir_exames');
  await passo(n7, 'idade_adulto');
  await passo(n7, 'med_qualquer');
  await passo(n7, 'slot:0');
  await passo(n7, 'Maria Silva', 'texto'); // nome comum, sem as palavras-gatilho
  check('nome comum sem palavra-gatilho não escapa para humano', !(await estaEmHumano(n7)));

  orig(falhas === 0 ? '\nResumo: TODOS OS TESTES PASSARAM 🎉' : `\nResumo: ${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('❌ Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
