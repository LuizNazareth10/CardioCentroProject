/**
 * Testa resolverOpcaoEvolution (evolution-opcoes.ts) contra o Firestore real
 * — a leitura de `evolution_opcoes` não tem fallback em memória. Cobre o
 * caso que travou o agendamento do Jeff: várias seleções na mesma mensagem
 * ("1 2 3") só valem quando o menu ativo é de exames.
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

const NUM_EXAMES = '5599999990001';
const NUM_BOTOES = '5599999990002';

async function main() {
  if (process.env.DATA_BACKEND !== 'firestore') {
    console.error('❌ DATA_BACKEND precisa ser "firestore" (confira o .env.local).');
    process.exit(1);
  }
  const { db } = await import('../src/lib/db/firestore');
  const { resolverOpcaoEvolution, salvarOpcoesEvolution } = await import('../src/lib/whatsapp/evolution-opcoes');

  // menu de EXAMES (todo id começa com "ex:", + "Falar c/ atendente" no fim —
  // é exatamente o shape real que enviarListaExames manda hoje) — cenário do Jeff
  await salvarOpcoesEvolution(NUM_EXAMES, [
    { id: 'ex:eco-doppler', titulo: 'Eco Doppler' },
    { id: 'ex:duplex-carotidas', titulo: 'Duplex Carótidas' },
    { id: 'ex:ergometrico', titulo: 'Teste Ergométrico' },
    { id: 'ex:cardiopulmonar', titulo: 'Teste Cardiopulmonar' },
    { id: 'ex:holter', titulo: 'Holter 24h' },
    { id: 'ex:mapa', titulo: 'MAPA 24h' },
    { id: 'falar_humano', titulo: 'Falar c/ atendente' },
  ]);

  // menu de BOTÕES (3 opções, não é exame) — não deve aceitar múltipla escolha
  await salvarOpcoesEvolution(NUM_BOTOES, [
    { id: 'idade_adulto', titulo: 'Adulto' },
    { id: 'idade_crianca', titulo: 'Criança' },
    { id: 'falar_humano', titulo: 'Falar c/ atendente' },
  ]);

  try {
    checar('1 exame único ainda funciona (compat)', JSON.stringify(await resolverOpcaoEvolution(NUM_EXAMES, '1')) === JSON.stringify(['ex:eco-doppler']));

    checar(
      'exatamente o caso do Jeff: "1 3 6" separados por espaço → 3 exames, na ordem digitada',
      JSON.stringify(await resolverOpcaoEvolution(NUM_EXAMES, '1 3 6')) ===
        JSON.stringify(['ex:eco-doppler', 'ex:ergometrico', 'ex:mapa']),
    );

    checar(
      'separado por vírgula ("1,3,6")',
      JSON.stringify(await resolverOpcaoEvolution(NUM_EXAMES, '1,3,6')) ===
        JSON.stringify(['ex:eco-doppler', 'ex:ergometrico', 'ex:mapa']),
    );

    checar(
      'com "e" no meio ("1, 3 e 6")',
      JSON.stringify(await resolverOpcaoEvolution(NUM_EXAMES, '1, 3 e 6')) ===
        JSON.stringify(['ex:eco-doppler', 'ex:ergometrico', 'ex:mapa']),
    );

    checar(
      'número repetido não duplica ("1 1 3")',
      JSON.stringify(await resolverOpcaoEvolution(NUM_EXAMES, '1 1 3')) === JSON.stringify(['ex:eco-doppler', 'ex:ergometrico']),
    );

    checar(
      'número fora do intervalo é ignorado, mantém os válidos ("1 3 99")',
      JSON.stringify(await resolverOpcaoEvolution(NUM_EXAMES, '1 3 99')) === JSON.stringify(['ex:eco-doppler', 'ex:ergometrico']),
    );

    const soInvalidos = await resolverOpcaoEvolution(NUM_EXAMES, '50 99');
    checar('só números inválidos → null (cai pra IA como antes)', soInvalidos === null);

    checar(
      'menu de 2 botões: "1 2" NÃO ativa múltipla escolha (não é menu de exames)',
      (await resolverOpcaoEvolution(NUM_BOTOES, '1 2')) === null,
    );

    checar(
      'menu de botões: número único isolado continua funcionando',
      JSON.stringify(await resolverOpcaoEvolution(NUM_BOTOES, '2')) === JSON.stringify(['idade_crianca']),
    );

    checar('texto livre sem número nenhum → null', (await resolverOpcaoEvolution(NUM_EXAMES, 'quero fazer eco e mapa')) === null);

    checar(
      '"Falar c/ atendente" sozinho, pelo número dele na lista de exames (7)',
      JSON.stringify(await resolverOpcaoEvolution(NUM_EXAMES, '7')) === JSON.stringify(['falar_humano']),
    );

    checar(
      'misturar exame(s) + o número do escape ("1 3 7") prioriza o escape, ignora o resto',
      JSON.stringify(await resolverOpcaoEvolution(NUM_EXAMES, '1 3 7')) === JSON.stringify(['falar_humano']),
    );

    checar(
      'menu de botões com escape: número do escape isolado (3) funciona',
      JSON.stringify(await resolverOpcaoEvolution(NUM_BOTOES, '3')) === JSON.stringify(['falar_humano']),
    );
  } finally {
    await db().collection('evolution_opcoes').doc(NUM_EXAMES).delete();
    await db().collection('evolution_opcoes').doc(NUM_BOTOES).delete();
  }

  console.log(falhas === 0 ? '\nResumo: TODOS OS TESTES PASSARAM 🎉' : `\nResumo: ${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
