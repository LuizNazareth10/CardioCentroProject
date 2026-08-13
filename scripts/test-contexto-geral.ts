/**
 * Três buracos de contexto vistos em conversas reais:
 *
 * 1. A RECEPÇÃO pergunta "podemos confirmar seu exame de amanhã?" pelo
 *    celular e o paciente responde horas depois. As mensagens da recepção não
 *    ficam guardadas, então o agente não sabe a que o "sim" se refere — e
 *    respondia com o menu genérico de agendamento (caso Maria Tereza, que
 *    respondeu às 21h a uma pergunta das 9h).
 * 2. Dúvidas gerais (endereço, exames, horário, convênios) precisam de
 *    resposta direta, sem abrir o fluxo de marcação e sem depender da IA.
 * 3. Confirmação de exame não podia depender de `lembreteEnviadoEm`: em
 *    produção os 141 agendamentos futuros estavam todos sem esse campo, então
 *    nenhuma confirmação de paciente era registrada.
 */
delete process.env.ANTHROPIC_API_KEY;

import { processarMensagem } from '../src/lib/whatsapp/agent';
import { carregarSessao } from '../src/lib/whatsapp/session';
import { respostaFAQ } from '../src/lib/whatsapp/messages';
import { criarPaciente, criarAgendamentos, listarAgendamentos } from '../src/lib/db';
import { comTransporte, type TransporteExterno } from '../src/lib/whatsapp/client';

const orig = console.log;
console.log = (...a: unknown[]) => { if (!String(a[0]).startsWith('[whatsapp:dev]')) orig(...a); };

let falhas = 0;
function check(n: string, c: boolean) { orig(`${c ? '✅' : '❌'} ${n}`); if (!c) falhas++; }

function captura(sink: Array<Record<string, unknown>>): TransporteExterno {
  return {
    async enviarTexto(_to, texto) { sink.push({ tipo: 'texto', texto }); },
    async enviarBotoes(_to, texto, botoes) { sink.push({ tipo: 'botoes', texto, botoes }); },
    async enviarLista(_to, texto, _b, secoes) { sink.push({ tipo: 'lista', texto, secoes }); },
    async baixarMidia() { return null; },
  };
}

async function run() {
  // ---------- 1) FAQ: resposta direta, sem chamar IA ----------
  check('endereço é reconhecido', /Delfim Moreira/.test(respostaFAQ('qual o endereço da clínica?') ?? ''));
  check('endereço sem acento também', /Delfim Moreira/.test(respostaFAQ('qual o endereco de voces') ?? ''));
  check('"onde fica" também', /Delfim Moreira/.test(respostaFAQ('onde fica a clinica?') ?? ''));
  check('lista de exames', /Ecocardiograma/.test(respostaFAQ('quais exames vocês fazem?') ?? ''));
  check('horário de funcionamento', /hor/i.test(respostaFAQ('que horas vocês abrem?') ?? ''));
  check('convênios', /Convênios/.test(respostaFAQ('vocês aceitam quais convênios?') ?? ''));
  check('pedido de agendamento NÃO é tratado como dúvida', respostaFAQ('quero marcar um exame') === null);
  check('texto qualquer não vira FAQ', respostaFAQ('meu nome é Ana Paula') === null);

  // pergunta de endereço não pode abrir o pipeline de marcação
  const n1 = '5532920000001';
  const envios1: Array<Record<string, unknown>> = [];
  await comTransporte(captura(envios1), async () => {
    await processarMensagem(n1, { tipo: 'texto', valor: 'oi' });
    envios1.length = 0;
    await processarMensagem(n1, { tipo: 'texto', valor: 'qual o endereço da clínica?' });
  });
  check('responde o endereço de verdade', JSON.stringify(envios1).includes('Delfim Moreira'));
  check('e NÃO manda a lista de exames (não abriu marcação)', !envios1.some((x) => x.tipo === 'lista'));
  check('a sessão não entrou em escolha de exames', (await carregarSessao(n1)).etapa !== 'escolhendo_exames');

  // ---------- 2) "sim" solto SEM exame marcado → recepção, não menu genérico ----------
  const n2 = '5532920000002';
  await processarMensagem(n2, { tipo: 'texto', valor: 'oi' });
  await processarMensagem(n2, { tipo: 'texto', valor: 'sim' });
  check('"sim" sem contexto e sem exame marcado → transborda p/ recepção', (await carregarSessao(n2)).etapa === 'humano');

  const n3 = '5532920000003';
  await processarMensagem(n3, { tipo: 'texto', valor: 'oi' });
  await processarMensagem(n3, { tipo: 'texto', valor: 'não vou poder ir' });
  check('"não vou poder ir" também vai para a recepção (nunca cancela sozinho)', (await carregarSessao(n3)).etapa === 'humano');

  // ---------- 3) "sim" COM exame marcado nas próximas 48h → confirma ----------
  const tel = '5532920000004';
  const pac = await criarPaciente({
    nome: 'MARIA TEREZA TESTE', telefone: tel, cpf: '33333333333',
    nascimento: '1950-01-01', convenioId: 'particular',
  } as never);
  const amanha = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();
  await criarAgendamentos([{
    pacienteId: pac.id, exameId: 'eco-doppler', medicoId: 'med-daher',
    inicio: amanha, fim: new Date(Date.parse(amanha) + 15 * 60000).toISOString(),
    status: 'agendado', convenioId: 'particular',
  }] as never);

  await processarMensagem(tel, { tipo: 'texto', valor: 'oi' });
  await processarMensagem(tel, { tipo: 'texto', valor: 'confirmo' });
  const ags = await listarAgendamentos({ pacienteId: pac.id });
  check(
    'confirma o exame das próximas 48h MESMO sem lembreteEnviadoEm',
    ags.some((a) => a.status === 'confirmado'),
  );
  check('e não transborda quando conseguiu confirmar', (await carregarSessao(tel)).etapa !== 'humano');

  // ---------- 4) pedido de agendamento não é confundido com confirmação ----------
  const n5 = '5532920000005';
  await processarMensagem(n5, { tipo: 'texto', valor: 'oi' });
  await processarMensagem(n5, { tipo: 'texto', valor: 'sim, quero agendar um exame' });
  check('"sim, quero agendar" segue para marcação, não para a recepção', (await carregarSessao(n5)).etapa !== 'humano');

  orig(falhas === 0 ? '\nResumo: TODOS OS TESTES PASSARAM 🎉' : `\nResumo: ${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

run().catch((e) => { console.error('❌ Falhou:', e instanceof Error ? e.message : e); process.exit(1); });
