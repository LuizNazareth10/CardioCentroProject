/**
 * Dois erros relatados pela clínica, ambos vistos em conversas reais:
 *
 * 1. O agente chamava o paciente pelo nome ERRADO. Causas somadas: a busca
 *    por telefone casava só os 8 últimos dígitos (ignorando o DDD) e pegava
 *    o primeiro resultado; e a saudação usava o nome do cadastro (ou o
 *    pushName do WhatsApp) — ambos casados pelo TELEFONE, e quem escreve nem
 *    sempre é o titular da linha. Agora só trata por nome depois que a
 *    própria pessoa se identifica no fluxo (`nomeInformado`); nem cadastro
 *    nem pushName são usados para saudação.
 * 2. Quando a leitura da foto do pedido médico falhava, o agente mandava só
 *    texto, sem NENHUM botão: quem tinha acabado de fotografar o pedido
 *    ficava sem caminho e sem como pedir ajuda humana.
 */
delete process.env.ANTHROPIC_API_KEY;

import { processarMensagem } from '../src/lib/whatsapp/agent';
import { carregarSessao, salvarSessao } from '../src/lib/whatsapp/session';
import { criarPaciente, obterPacientePorTelefone } from '../src/lib/db';
import { comTransporte, type TransporteExterno } from '../src/lib/whatsapp/client';

const orig = console.log;
console.log = (...a: unknown[]) => { if (!String(a[0]).startsWith('[whatsapp:dev]')) orig(...a); };

let falhas = 0;
function check(n: string, c: boolean) { orig(`${c ? '✅' : '❌'} ${n}`); if (!c) falhas++; }

/** captura o que o agente enviaria, sem mandar nada para fora */
function captura(sink: Array<Record<string, unknown>>): TransporteExterno {
  return {
    async enviarTexto(to, texto) { sink.push({ tipo: 'texto', texto }); },
    async enviarBotoes(to, texto, botoes) { sink.push({ tipo: 'botoes', texto, botoes }); },
    async enviarLista(to, texto, _b, secoes) { sink.push({ tipo: 'lista', texto, secoes }); },
    async baixarMidia() { return null; }, // simula falha ao abrir a imagem
  };
}

async function run() {
  // ---------- 1) busca por telefone respeita o DDD ----------
  await criarPaciente({
    nome: 'FERNANDO DE TAL', telefone: '5532991685272', cpf: '11111111111',
    nascimento: '1970-01-01', convenioId: 'particular',
  } as never);
  await criarPaciente({
    nome: 'MARA DE TAL', telefone: '5521991685272', cpf: '22222222222',
    nascimento: '1980-01-01', convenioId: 'particular',
  } as never);

  const doDdd32 = await obterPacientePorTelefone('5532991685272');
  const doDdd21 = await obterPacientePorTelefone('5521991685272');
  check('mesmo final, DDD 32 → acha o paciente do DDD 32', doDdd32?.nome === 'FERNANDO DE TAL');
  check('mesmo final, DDD 21 → acha o paciente do DDD 21 (não o primeiro do índice)', doDdd21?.nome === 'MARA DE TAL');

  const semNono = await obterPacientePorTelefone('553291685272'); // sem o 9º dígito
  check('o 9º dígito não atrapalha o casamento', semNono?.nome === 'FERNANDO DE TAL');

  // ---------- 2) saudação só usa nome que o próprio paciente digitou ----------
  const n1 = '5532991685272';
  const s1 = await carregarSessao(n1);
  s1.nome = 'FERNANDO DE TAL';   // veio do cadastro (casado por telefone), NÃO informado por quem escreve
  await salvarSessao(n1, s1);

  const envios1: Array<Record<string, unknown>> = [];
  await comTransporte(captura(envios1), () => processarMensagem(n1, { tipo: 'texto', valor: 'oi' }));
  const textos1 = JSON.stringify(envios1);
  check('NÃO usa o nome do cadastro achado por telefone ("Fernando") sem confirmação', !/Fernando/i.test(textos1));

  // telefone SEM cadastro: fluxo pede o nome explicitamente, e só a partir
  // daí (nomeInformado) a saudação usa o nome digitado.
  const n1b = '5532991685299';
  const envios1b: Array<Record<string, unknown>> = [];
  await comTransporte(captura(envios1b), async () => {
    await processarMensagem(n1b, { tipo: 'interativo', valor: 'agendar' });
    await processarMensagem(n1b, { tipo: 'interativo', valor: 'ex:eco-doppler' });
    await processarMensagem(n1b, { tipo: 'interativo', valor: 'concluir_exames' });
    await processarMensagem(n1b, { tipo: 'interativo', valor: 'idade_adulto' });
    await processarMensagem(n1b, { tipo: 'interativo', valor: 'med_qualquer' });
    await processarMensagem(n1b, { tipo: 'interativo', valor: 'slot:0' });
  });
  check('sem cadastro, o fluxo pede o nome explicitamente', (await carregarSessao(n1b)).etapa === 'identificacao');
  check('e a sessão ainda não marca nomeInformado', !(await carregarSessao(n1b)).nomeInformado);

  const envios1c: Array<Record<string, unknown>> = [];
  await comTransporte(captura(envios1c), () => processarMensagem(n1b, { tipo: 'texto', valor: 'Natiaê' }));
  const textos1c = JSON.stringify(envios1c);
  check('depois que a própria pessoa digita o nome, a saudação usa esse nome ("Natiaê")', textos1c.includes('Natiaê'));
  check('sessão marca nomeInformado a partir do que foi digitado', Boolean((await carregarSessao(n1b)).nomeInformado));

  // ---------- 3) falha ao abrir a foto oferece transbordo ----------
  const n2 = '5532910000010';
  const envios2: Array<Record<string, unknown>> = [];
  await comTransporte(captura(envios2), async () => {
    await processarMensagem(n2, { tipo: 'texto', valor: 'oi' });
    await processarMensagem(n2, { tipo: 'imagem', valor: 'evolution:xxx', mime: 'image/jpeg' });
  });
  const comBotoes = envios2.filter((x) => x.tipo === 'botoes');
  const ultimo = comBotoes[comBotoes.length - 1] as { botoes?: Array<{ id: string }> } | undefined;
  check('foto ilegível responde COM botões (antes era só texto)', Boolean(ultimo));
  check(
    'e um dos botões é falar com atendente',
    Boolean(ultimo?.botoes?.some((b) => b.id === 'falar_humano')),
  );
  check(
    'também oferece escolher da lista, para quem quiser seguir sozinho',
    Boolean(ultimo?.botoes?.some((b) => b.id === 'add_exame')),
  );

  // ---------- 4) e o botão realmente transborda ----------
  await processarMensagem(n2, { tipo: 'interativo', valor: 'falar_humano' });
  check('tocar em "falar c/ atendente" após a foto transborda de verdade', (await carregarSessao(n2)).etapa === 'humano');

  orig(falhas === 0 ? '\nResumo: TODOS OS TESTES PASSARAM 🎉' : `\nResumo: ${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

run().catch((e) => { console.error('❌ Falhou:', e instanceof Error ? e.message : e); process.exit(1); });
