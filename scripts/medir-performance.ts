/**
 * Mede o custo real das telas da área restrita contra o Firestore de
 * produção: para cada operação, quantos DOCUMENTOS foram lidos e quanto
 * tempo levou. É a evidência objetiva do antes/depois da otimização.
 *
 *   DB_METRICS=1 npx tsx scripts/medir-performance.ts
 *
 * (o DATA_BACKEND precisa ser firestore no .env.local)
 *
 * Contexto: a lentidão vinha de ler coleções inteiras e filtrar em memória.
 * Com ~19 mil pacientes e ~94 mil agendamentos, abrir a Agenda de UM dia
 * chegava a ~94 mil leituras. Depois da correção, cada tela lê só o que
 * mostra. Este script torna esse número visível.
 */
import * as nodeFs from 'fs';

function carregarEnvLocal() {
  const p = '.env.local';
  if (!nodeFs.existsSync(p)) return;
  for (const linha of nodeFs.readFileSync(p, 'utf8').split('\n')) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
carregarEnvLocal();
process.env.DB_METRICS = '1'; // garante instrumentação ligada

async function main() {
  if (process.env.DATA_BACKEND !== 'firestore') {
    console.error('DATA_BACKEND precisa ser "firestore" (confira o .env.local).');
    process.exit(1);
  }
  const db = await import('../src/lib/db');
  const { resumo, limparAmostras } = await import('../src/lib/db/metrics');

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const fim = new Date(`${hoje}T12:00:00Z`);
  fim.setUTCDate(fim.getUTCDate() + 90);
  const ate90 = `${fim.toISOString().slice(0, 10)}T23:59:59-03:00`;

  console.log(`\nMedindo operações típicas (data de hoje = ${hoje})…\n`);
  limparAmostras();

  // Painel: contagem de pacientes + agendamentos de hoje
  await db.contarPacientes();
  await db.listarAgendamentos({ de: `${hoje}T00:00:00-03:00`, ate: `${hoje}T23:59:59-03:00` });

  // Agenda do dia
  await db.listarAgendamentos({ de: `${hoje}T00:00:00-03:00`, ate: `${hoje}T23:59:59-03:00` });

  // Lista de pacientes (1ª página) + busca por nome + por telefone
  const pag = await db.listarPacientes({ limite: 50 });
  await db.listarPacientes({ busca: 'a', limite: 50 });
  await db.listarPacientes({ busca: '32', limite: 50 });

  // Detalhe de um paciente (histórico + próxima página, se houver)
  if (pag.pacientes[0]) {
    await db.listarAgendamentos({ pacienteId: pag.pacientes[0].id });
  }

  // Fila de atendimentos + leads
  await db.listarConversas({ limite: 50 });
  await db.listarLeads({ limite: 50 });

  // Busca de horários do agente (janela futura, não a coleção inteira)
  await db.listarAgendamentos({ de: `${hoje}T00:00:00-03:00`, ate: ate90 });

  const linhas = resumo();
  const totalDocs = linhas.reduce((s, l) => s + l.docsTotal, 0);

  console.log('Operação                                   chamadas   docs/chamada   docs totais');
  console.log('─'.repeat(84));
  for (const l of linhas) {
    console.log(
      `${l.op.padEnd(42)} ${String(l.chamadas).padStart(6)} ${String(l.docsPorChamada).padStart(13)} ${String(l.docsTotal).padStart(13)}`,
    );
  }
  console.log('─'.repeat(84));
  console.log(`${'TOTAL de documentos lidos'.padEnd(63)} ${String(totalDocs).padStart(13)}`);
  console.log(
    `\nReferência: a cota GRÁTIS do Firestore é 50.000 leituras/dia. ` +
      `Uma passada completa por todas as telas agora custa ${totalDocs} leitura(s).`,
  );
  console.log('(Antes da otimização, só a Agenda de um dia já lia dezenas de milhares.)\n');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
