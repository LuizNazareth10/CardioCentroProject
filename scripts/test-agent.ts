import { processarMensagem } from '../src/lib/whatsapp/agent';
import { listarAgendamentos } from '../src/lib/db';

// silencia os logs de "enviaria" para o teste ficar limpo
const orig = console.log;
console.log = (...a: unknown[]) => { if (!String(a[0]).startsWith('[whatsapp:dev]')) orig(...a); };

const from = '5532999952138';

async function passo(valor: string, tipo: 'texto' | 'interativo' = 'interativo') {
  await processarMensagem(from, { tipo, valor });
}

async function run() {
  let falhas = 0;
  const check = (n: string, c: boolean) => { orig(`${c ? '✅' : '❌'} ${n}`); if (!c) falhas++; };

  await passo('oi', 'texto');            // menu
  await passo('agendar');                // lista de exames
  await passo('ex:ecg');                 // adiciona ECG
  await passo('ex:ecg');                 // adiciona outro ECG (sessão)
  await passo('concluir_exames');        // pergunta médico
  await passo('med_qualquer');           // calcula horários
  await passo('slot:0');                 // escolhe 1ª opção -> pede nome
  await passo('João da Silva', 'texto'); // informa nome -> pede convênio
  await passo('conv:unimed');            // convênio -> confirmação
  await passo('confirmar_sim');          // confirma -> grava

  const ags = await listarAgendamentos();
  const doZap = ags.filter((a) => a.origem === 'whatsapp');
  check('Agendou via WhatsApp', doZap.length === 2);
  check('Mesmo paciente nos dois exames', doZap.length === 2 && doZap[0].pacienteId === doZap[1].pacienteId);
  check('Exames consecutivos (fim de um = início do outro)',
    doZap.length === 2 && [doZap[0], doZap[1]].sort((a, b) => a.inicio.localeCompare(b.inicio))
      .reduce((ok, _, i, arr) => i === 0 ? ok : ok && arr[i - 1].fim === arr[i].inicio, true));
  check('Convênio registrado', doZap.every((a) => a.convenioId === 'unimed'));

  orig('\nResumo:', falhas === 0 ? 'AGENTE OK 🎉' : `${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
run();
