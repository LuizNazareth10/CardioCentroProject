/**
 * Testa a confirmação explícita da lista de exames lida de TEXTO LIVRE.
 *
 * Motivado por um caso real: o paciente escreveu que queria eco + duplex de
 * carótidas e vertebrais, só o eco foi reconhecido, e o fluxo seguiu marcando
 * UM exame enquanto ele achava que tinha marcado dois — erro que só
 * apareceria no dia do exame.
 *
 * Roda sem ANTHROPIC_API_KEY de propósito: assim `interpretar` cai no
 * fallback por palavras-chave, que é determinístico e é justamente a camada
 * que precisa reconhecer os apelidos que o paciente digita de verdade.
 */
delete process.env.ANTHROPIC_API_KEY;

import { processarMensagem } from '../src/lib/whatsapp/agent';
import { carregarSessao } from '../src/lib/whatsapp/session';
import { interpretar } from '../src/lib/whatsapp/ai';

const orig = console.log;
console.log = (...a: unknown[]) => { if (!String(a[0]).startsWith('[whatsapp:dev]')) orig(...a); };

let falhas = 0;
function check(n: string, c: boolean) { orig(`${c ? '✅' : '❌'} ${n}`); if (!c) falhas++; }

const passo = (from: string, valor: string, tipo: 'texto' | 'interativo' = 'interativo') =>
  processarMensagem(from, { tipo, valor });

async function run() {
  // ---------- leitura de vários exames numa frase só ----------
  const i1 = await interpretar('quero marcar um eco e um duplex de carotidas e vertebrais');
  check(
    'texto com 2 exames devolve OS DOIS (eco + duplex), não só o primeiro',
    i1.exames.includes('eco-doppler') && i1.exames.includes('duplex-carotidas'),
  );

  const i2 = await interpretar('preciso fazer um ecocardiograma transtorácico');
  check('apelido "ecocardiograma transtorácico" vira eco-doppler', i2.exames.includes('eco-doppler'));

  const i3 = await interpretar('queria fazer o teste da esteira');
  check('apelido "teste da esteira" vira ergometrico', i3.exames.includes('ergometrico'));

  const i4 = await interpretar('preciso do doppler de carótidas'); // COM acento
  check('acento não atrapalha ("carótidas" casa igual a "carotidas")', i4.exames.includes('duplex-carotidas'));

  // ---------- o fluxo PARA para confirmar, não segue direto ----------
  const n1 = '5532910000001';
  await passo(n1, 'oi', 'texto');
  await passo(n1, 'quero marcar um eco e um duplex de carotidas', 'texto');
  const s1 = await carregarSessao(n1);
  check('texto livre com exames NÃO pula direto para a idade/médico', s1.etapa === 'confirmando_exames');
  check('os dois exames entraram na sessão', s1.examesSelecionados.length === 2);

  // confirmando, o fluxo segue normalmente
  await passo(n1, 'exames_ok');
  const s1b = await carregarSessao(n1);
  check('após confirmar, avança para a pergunta de idade', s1b.etapa === 'confirmando_idade');

  // ---------- "falta um exame" volta para a lista ----------
  const n2 = '5532910000002';
  await passo(n2, 'oi', 'texto');
  await passo(n2, 'quero marcar um eco', 'texto');
  check('um exame só também passa pela confirmação', (await carregarSessao(n2)).etapa === 'confirmando_exames');
  await passo(n2, 'add_exame');
  check('"falta um exame" volta para a lista de exames', (await carregarSessao(n2)).etapa === 'escolhendo_exames');

  // ---------- confirmar por TEXTO, não só pelo botão ----------
  const n3 = '5532910000003';
  await passo(n3, 'oi', 'texto');
  await passo(n3, 'quero marcar um holter', 'texto');
  await passo(n3, 'isso mesmo', 'texto');
  check('confirma por texto livre ("isso mesmo")', (await carregarSessao(n3)).etapa === 'confirmando_idade');

  // ---------- citar o exame que faltou, em texto, acrescenta ----------
  const n4 = '5532910000004';
  await passo(n4, 'oi', 'texto');
  await passo(n4, 'quero marcar um eco', 'texto');
  await passo(n4, 'na verdade quero tambem o holter', 'texto');
  const s4 = await carregarSessao(n4);
  check('citar outro exame durante a confirmação acrescenta em vez de trocar', s4.examesSelecionados.includes('eco-doppler') && s4.examesSelecionados.includes('holter'));
  check('e pede confirmação de novo, com a lista completa', s4.etapa === 'confirmando_exames');

  // ---------- escape para atendente continua valendo aqui ----------
  const n5 = '5532910000005';
  await passo(n5, 'oi', 'texto');
  await passo(n5, 'quero marcar um eco', 'texto');
  await passo(n5, 'falar_humano');
  check('"falar c/ atendente" escapa também da confirmação de exames', (await carregarSessao(n5)).etapa === 'humano');

  orig(falhas === 0 ? '\nResumo: TODOS OS TESTES PASSARAM 🎉' : `\nResumo: ${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

run().catch((e) => { console.error('❌ Falhou:', e instanceof Error ? e.message : e); process.exit(1); });
