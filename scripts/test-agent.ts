import { processarMensagem } from '../src/lib/whatsapp/agent';
import { listarAgendamentos } from '../src/lib/db';

// silencia os logs de "enviaria" para o teste ficar limpo
const orig = console.log;
console.log = (...a: unknown[]) => { if (!String(a[0]).startsWith('[whatsapp:dev]')) orig(...a); };

const from = '5532999952138';

async function passo(valor: string, tipo: 'texto' | 'interativo' = 'interativo') {
  await processarMensagem(from, { tipo, valor });
}

/** agendamentos criados pelo paciente deste teste (o seed já traz outros) */
async function doPaciente() {
  const ags = await listarAgendamentos();
  return ags.filter((a) => a.origem === 'whatsapp' && a.pacienteNome === 'João da Silva');
}

async function run() {
  let falhas = 0;
  const check = (n: string, c: boolean) => { orig(`${c ? '✅' : '❌'} ${n}`); if (!c) falhas++; };

  // ---------- agendamento de uma sessão com 2 exames ----------
  await passo('oi', 'texto');               // menu
  await passo('agendar');                   // lista de exames
  await passo('ex:eco-doppler');            // adiciona Eco
  await passo('ex:duplex-carotidas');       // adiciona Carótida (sessão)
  await passo('concluir_exames');           // pergunta médico
  await passo('med_qualquer');              // calcula horários
  await passo('slot:0');                    // escolhe 1ª opção -> pede nome
  await passo('João da Silva', 'texto');    // informa nome -> pede convênio
  await passo('conv:unimed');               // Unimed -> AVISA sobre Mix/Fácil
  await passo('plano_ok');                  // plano do paciente não é restrito
  await passo('confirmar_sim');             // confirma -> grava

  const doZap = await doPaciente();
  check('Agendou os 2 exames via WhatsApp', doZap.length === 2);
  check('Mesmo paciente nos dois exames', doZap.length === 2 && doZap[0].pacienteId === doZap[1].pacienteId);
  check('Exames consecutivos (fim de um = início do outro)',
    doZap.length === 2 && [doZap[0], doZap[1]].sort((a, b) => a.inicio.localeCompare(b.inicio))
      .reduce((ok, _, i, arr) => i === 0 ? ok : ok && arr[i - 1].fim === arr[i].inicio, true));
  check('Convênio registrado', doZap.length === 2 && doZap.every((a) => a.convenioId === 'unimed'));

  // ---------- convênio com plano NÃO atendido cai para a recepção ----------
  const outro = '5532988887777';
  await processarMensagem(outro, { tipo: 'texto', valor: 'oi' });
  await processarMensagem(outro, { tipo: 'interativo', valor: 'agendar' });
  await processarMensagem(outro, { tipo: 'interativo', valor: 'ex:eco-doppler' });
  await processarMensagem(outro, { tipo: 'interativo', valor: 'concluir_exames' });
  await processarMensagem(outro, { tipo: 'interativo', valor: 'med_qualquer' });
  await processarMensagem(outro, { tipo: 'interativo', valor: 'slot:0' });
  await processarMensagem(outro, { tipo: 'texto', valor: 'Maria Bradesco' });
  await processarMensagem(outro, { tipo: 'interativo', valor: 'conv:bradesco' });
  await processarMensagem(outro, { tipo: 'interativo', valor: 'plano_restrito' }); // é Sistel
  await processarMensagem(outro, { tipo: 'interativo', valor: 'confirmar_sim' });  // não deve gravar
  const daMaria = (await listarAgendamentos()).filter((a) => a.pacienteNome === 'Maria Bradesco');
  check('Plano não atendido não vira agendamento (vai p/ recepção)', daMaria.length === 0);

  // ---------- remarcação pelo WhatsApp ----------
  const antes = (await doPaciente()).slice().sort((a, b) => a.inicio.localeCompare(b.inicio));
  const inicioAntigo = antes[0]?.inicio;

  await passo('oi', 'texto');        // menu reconhece o agendamento futuro
  await passo('remarcar');           // pede confirmação
  await passo('remarcar_sim');       // busca novos horários
  await passo('slot:0');             // escolhe o novo horário
  await passo('confirmar_sim');      // confirma a remarcação

  const depois = (await doPaciente()).slice().sort((a, b) => a.inicio.localeCompare(b.inicio));
  check('Remarcação move (não duplica) os agendamentos', depois.length === 2);
  check('Ids preservados na remarcação',
    depois.length === 2 && antes.length === 2 && depois.every((d) => antes.some((a) => a.id === d.id)));
  check('Horário realmente mudou', !!inicioAntigo && depois[0]?.inicio !== inicioAntigo);
  check('Guardou o rastro do horário anterior',
    depois.every((d) => d.remarcadoEm && d.inicioAnterior));
  check('Sessão continua consecutiva após remarcar',
    depois.length === 2 && depois[0].fim === depois[1].inicio);
  check('Status volta para "agendado" após remarcar',
    depois.every((d) => d.status === 'agendado' && !d.lembreteEnviadoEm));

  orig('\nResumo:', falhas === 0 ? 'AGENTE OK 🎉' : `${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
run();
