/**
 * Testa marcarHandoffHumano isoladamente (session.ts), no fallback em
 * memória (sem Firestore) — cobre a lógica que o webhook aciona quando
 * detecta a recepção respondendo direto no WhatsApp (fromMe que não é eco
 * do agente). O round-trip foiEnviadoPeloAgente/marcarComoEnviadoPeloAgente
 * (evolution.ts) depende do Firestore real e é conferido manualmente — ver
 * DIA-1-WHATSAPP.md.
 */
import { carregarSessao, horasDeSilencio, marcarHandoffHumano, salvarSessao } from '../src/lib/whatsapp/session';

let falhas = 0;
function checar(nome: string, cond: boolean) {
  if (cond) console.log(`✅ ${nome}`);
  else { console.log(`❌ ${nome}`); falhas++; }
}

async function main() {
  // 1) número sem sessão nenhuma → handoff cria a sessão já em 'humano'
  const numA = '5532988887777';
  await marcarHandoffHumano(numA);
  const sA = await carregarSessao(numA);
  checar('sem sessão prévia: handoff cria sessão em humano', sA.etapa === 'humano');

  // 2) número em pleno fluxo de agendamento → handoff interrompe e assume
  const numB = '5532988886666';
  const sB = await carregarSessao(numB);
  sB.etapa = 'escolhendo_horario';
  sB.examesSelecionados = ['eco'];
  await salvarSessao(numB, sB);
  await marcarHandoffHumano(numB);
  const sB2 = await carregarSessao(numB);
  checar('em fluxo ativo: handoff sobrescreve para humano', sB2.etapa === 'humano');
  checar('em fluxo ativo: não perde o que já tinha selecionado (auditoria)', sB2.examesSelecionados.includes('eco'));

  // 3) handoff repetido (atendente mandando várias mensagens seguidas): cada
  // chamada precisa REPOR atualizadoEm — é o que faz horasDeSilencio refletir
  // a mensagem mais recente da recepção, não só a primeira (ver comentário em
  // marcarHandoffHumano, session.ts)
  const numC = '5532988885555';
  await marcarHandoffHumano(numC);
  const antes = (await carregarSessao(numC)).atualizadoEm;
  await new Promise((r) => setTimeout(r, 15));
  await marcarHandoffHumano(numC);
  const depois = await carregarSessao(numC);
  checar('handoff repetido: continua humano', depois.etapa === 'humano');
  checar('handoff repetido: repõe atualizadoEm (relógio do silêncio não fica preso na 1ª mensagem)', depois.atualizadoEm > antes);

  // 4) horasDeSilencio — usado pelo rollout pra dar cobertura total (canary
  // 100%) a conversas abandonadas há 4h+ (ver LIMITE_SILENCIO_HORAS em rollout.ts)
  const numD = '5532988884444';
  checar('nunca conversamos: horasDeSilencio devolve null', (await horasDeSilencio(numD)) === null);
  await salvarSessao(numD, await carregarSessao(numD)); // atualizadoEm = agora
  const silencioD = await horasDeSilencio(numD);
  checar('sessão recém-salva: silêncio ~0h (não null, não horas)', silencioD !== null && silencioD < 0.01);

  console.log(falhas === 0 ? '\nResumo: TODOS OS TESTES PASSARAM 🎉' : `\nResumo: ${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main();
