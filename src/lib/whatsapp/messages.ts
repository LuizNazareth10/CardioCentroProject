import { CONTATO } from '../seed-data';

const SEP = '─────────────────';

/** Telefone fixo para cancelamento / remarcação (formato legível no WhatsApp). */
export const TELEFONE_FIXO_CLINICA = CONTATO.telefoneFixo;

// ─── Saudações e menu ───────────────────────────────────────────

export function mensagemBoasVindasAgendamento(primeiroNome?: string): string {
  const oi = primeiroNome ? `Olá, *${primeiroNome}*! 👋` : 'Olá! 👋';
  return [
    oi,
    '',
    `Seja bem-vindo(a) à *${CONTATO.nomeClinica}* 💙`,
    `_${CONTATO.subtitulo}_`,
    '',
    'Que bom te receber! Vou te ajudar a agendar seu exame com carinho e agilidade. ✨',
  ].join('\n');
}

export function mensagemMenuPrincipal(primeiroNome?: string): string {
  const oi = primeiroNome ? `Olá, *${primeiroNome}*! 👋` : 'Olá! 👋';
  return [
    oi,
    '',
    `Aqui é a *${CONTATO.nomeClinica}* 💙`,
    `_${CONTATO.subtitulo}_`,
    '',
    'Que bom te receber! Estou aqui para te ajudar com carinho. ✨',
    '',
    'Como posso te ajudar hoje? 😊',
  ].join('\n');
}

// ─── Exames e horários ──────────────────────────────────────────

export function mensagemListaExames(): string {
  return 'Quais exames você gostaria de marcar? 📋\nSelecione *um por vez* na lista abaixo.';
}

export function mensagemExameAdicionado(lista: string): string {
  return [
    'Adicionado com sucesso ✅',
    '',
    '*Sua seleção:*',
    lista,
    '',
    'Deseja incluir mais algum exame?',
  ].join('\n');
}

export function mensagemExameDuplicado(nomeExame: string): string {
  return `Você já selecionou *${nomeExame}* nesta sessão. 😊\nEscolha outro exame ou toque em *Ver horários* para continuar.`;
}

export function mensagemPreferenciaMedico(): string {
  return 'Você tem preferência de médico? 👨‍⚕️👩‍⚕️';
}

export function mensagemSemMedicoUnico(): string {
  return 'Para essa combinação de exames não há um único médico que realize todos. 👍\nVou buscar a melhor combinação de horários para você.';
}

export function mensagemSemHorarios(): string {
  return [
    'No momento não encontrei horários livres para essa combinação nos próximos dias. 😕',
    '',
    'Posso te transferir para um atendente? Responda *atendente*.',
  ].join('\n');
}

export function mensagemHorariosSugeridos(): string {
  return 'Encontrei estes horários para você 🗓️\nQual fica melhor?';
}

export function mensagemEscolherDia(): string {
  return 'Certo! Em qual dia você prefere? 📅';
}

export function mensagemHorariosDoDia(dia: string): string {
  return `Horários disponíveis em *${dia}*.\nQual prefere? ⏰`;
}

// ─── Identificação ──────────────────────────────────────────────

export function mensagemPedirNome(): string {
  return 'Quase lá! ✨\nQual é o seu *nome completo*?';
}

export function mensagemPedirConvenio(primeiroNome: string): string {
  return `Obrigada, *${primeiroNome}*! 💙\nQual é o seu convênio?`;
}

export function mensagemConvenioOutro(): string {
  return [
    'Sem problema! 🙂',
    '',
    'Qual é o nome do seu convênio? Pode digitar.',
    '',
    '_Se não tiver convênio, responda *particular*._',
  ].join('\n');
}

export function mensagemConvenioNaoEncontrado(texto: string): string {
  return [
    `Não encontrei "*${texto.trim()}*" na nossa lista. 🤔`,
    '',
    'Tente escrever de outro jeito, ou responda *particular* se não usar convênio.',
  ].join('\n');
}

// ─── Confirmação ────────────────────────────────────────────────

export function mensagemResumoAgendamento(paciente: string, convenio: string, linhas: string): string {
  return [
    '📋 *Confirme seu agendamento*',
    SEP,
    `👤 *Paciente:* ${paciente}`,
    `🏥 *Convênio:* ${convenio}`,
    '',
    linhas,
    SEP,
    '📄 _Lembre-se: no dia do exame, traga o *pedido médico* (papel ou digital)._',
  ].join('\n');
}

export function mensagemAgendamentoCancelado(): string {
  return [
    'Sem problemas, cancelei o agendamento. 💙',
    '',
    'Quando quiser recomeçar, é só mandar *oi*.',
  ].join('\n');
}

export function mensagemHorarioOcupado(): string {
  return 'Ops! Esse horário acabou de ser preenchido. ⏳\nVou buscar outras opções para você…';
}

export function mensagemAgendamentoConfirmado(primeiroNome: string, data: string, hora: string): string {
  return [
    `Tudo certo, *${primeiroNome}*! 🎉`,
    '',
    `Seu agendamento está *confirmado* para:`,
    `📅 *${data}* às *${hora}*`,
    '',
    `📍 *${CONTATO.enderecoCompleto}*`,
    '',
    'Estamos te esperando! 💙',
  ].join('\n');
}

// ─── Lembretes pós-confirmação ───────────────────────────────────

export function mensagemLembretesGerais(): string {
  return [
    '📌 *Lembretes importantes*',
    SEP,
    '',
    '📄 *Pedido médico*',
    'No dia do exame, é *obrigatório* trazer o pedido médico (papel ou digital).',
    'Precisamos dele para o encaminhamento ao convênio e demais procedimentos administrativos.',
    '',
    '📞 *Cancelar ou remarcar*',
    `Caso precise cancelar ou remarcar, ligue para nosso telefone fixo:`,
    `☎️ *${TELEFONE_FIXO_CLINICA}*`,
    '',
    '_Horário de atendimento telefônico: seg–qui 08h–18h · sex 08h–17h._',
  ].join('\n');
}

// ─── Orientações por tipo de exame ──────────────────────────────

const ORIENTACAO_ESFORCO = [
  '🏃 *Orientações — Exame de Esforço Físico*',
  SEP,
  '',
  'Seguem as orientações para a realização do seu *EXAME DE ESFORÇO FÍSICO*:',
  '',
  '🏃 Venha com roupas confortáveis e adequadas para atividade física.',
  '',
  '👩 *Mulheres:* utilizar sutiã ou top esportivo.',
  '',
  '👨 *Homens:* caso possuam pelos no peito, será necessário realizar a raspagem da região para melhor fixação dos eletrodos.',
  '',
  '🧴 Não utilize hidratante, óleo corporal ou cremes no dia do exame, pois podem dificultar a aderência dos eletrodos.',
  '',
  '💊 Mantenha o uso das medicações conforme a orientação do seu médico.',
  '',
  '🍞☕ Faça uma refeição leve cerca de 2 horas antes do exame. Evite comparecer em jejum.',
  '',
  '📍 Em caso de dúvidas, estamos à disposição.',
].join('\n');

function orientacaoAparelho(tipo: 'mapa' | 'holter' | 'ambos'): string {
  const titulo =
    tipo === 'mapa'
      ? 'MAPA 24h'
      : tipo === 'holter'
        ? 'Holter 24h'
        : 'MAPA ou Holter';

  const linhas = [
    `⏱️ *Orientações — ${titulo}*`,
    SEP,
    '',
    `Seguem as orientações para a realização do seu exame (*${titulo.toUpperCase()}*):`,
    '',
    '🛀 Venha de banho tomado, pois durante o período do exame não será possível molhar o aparelho.',
  ];

  if (tipo === 'mapa' || tipo === 'ambos') {
    linhas.push(
      '',
      '💊 *Para o exame MAPA:* traga uma lista com os medicamentos que faz uso ou os próprios medicamentos, se preferir.',
    );
  }

  linhas.push(
    '',
    '⏰ Reserve um tempo maior para o atendimento. Como o exame exige orientações individualizadas e uma instalação cuidadosa do aparelho, podem ocorrer pequenos atrasos ou imprevistos. Agradecemos a compreensão!',
    '',
    '📍 Em caso de dúvidas, estamos à disposição.',
  );

  return linhas.join('\n');
}

/** Monta orientações específicas conforme os exames agendados. */
export function montarOrientacoesExames(exameIds: string[]): string[] {
  const msgs: string[] = [];
  const temEsforco = exameIds.some((id) => id === 'ergometrico' || id === 'cardiopulmonar');
  const temMapa = exameIds.includes('mapa');
  const temHolter = exameIds.includes('holter');

  if (temEsforco) msgs.push(ORIENTACAO_ESFORCO);

  if (temMapa && temHolter) msgs.push(orientacaoAparelho('ambos'));
  else if (temMapa) msgs.push(orientacaoAparelho('mapa'));
  else if (temHolter) msgs.push(orientacaoAparelho('holter'));

  return msgs;
}

// ─── Pedido médico (imagem) ─────────────────────────────────────

export function mensagemRecebendoPedido(): string {
  return 'Recebi seu pedido médico 📄\nDeixa eu dar uma olhada… 🔍';
}

export function mensagemErroImagem(): string {
  return [
    'Não consegui abrir a imagem agora. 😕',
    '',
    'Você pode me dizer quais exames deseja agendar, ou responder *menu* para ver as opções.',
  ].join('\n');
}

export function mensagemPedidoNaoIdentificado(): string {
  return [
    'Não consegui identificar os exames na imagem. 🤔',
    '',
    'Pode digitar os exames desejados ou responder *menu* para ver a lista completa.',
  ].join('\n');
}

export function mensagemPedidoIdentificado(lista: string): string {
  return [
    'Identifiquei os seguintes exames no seu pedido: ✅',
    '',
    lista,
    '',
    'Posso agendar esses exames para você?',
  ].join('\n');
}

export function mensagemConfirmarPedidoMedico(): string {
  return 'Perfeito! Tem preferência de médico? 👨‍⚕️';
}

// ─── Urgência médica ────────────────────────────────────────────

export function mensagemUrgencia(): string {
  return [
    '🚨 *Atenção*',
    '',
    'Pelo que você descreveu, o ideal é buscar atendimento médico *agora* — não espere um agendamento.',
    '',
    '➡️ Procure imediatamente um *pronto-socorro* ou ligue *192 (SAMU)*.',
    '',
    'Vou avisar nossa equipe sobre a sua mensagem. Cuide-se! 💙',
  ].join('\n');
}

// ─── Lembrete de confirmação (1 dia antes) ───────────────────────

export function mensagemLembreteConfirmacao(primeiroNome: string, data: string, hora: string): string {
  return [
    `Olá, *${primeiroNome}*! 👋`,
    '',
    `Passando para lembrar do seu exame amanhã, *${data}* às *${hora}*. 🗓️`,
    '',
    'Você confirma sua presença? Responda *SIM* ou toque no botão abaixo. ✅',
  ].join('\n');
}

export function mensagemConfirmacaoLembreteRecebida(primeiroNome: string, data: string, hora: string): string {
  return [
    `Perfeito, *${primeiroNome}*! Presença confirmada. ✅`,
    '',
    `Te esperamos em *${data}* às *${hora}*.`,
    `📍 *${CONTATO.enderecoCompleto}*`,
  ].join('\n');
}

// ─── Autorização de convênio (carteirinha + pedido médico) ──────

export function mensagemPedirDocumentosAutorizacao(convenio: string): string {
  return [
    `Para agendar pelo convênio *${convenio}*, é necessário enviar dois documentos por foto antes de eu concluir o agendamento: 📋`,
    '',
    '1️⃣ Foto da *carteirinha do convênio*',
    '2️⃣ Foto do *pedido médico*',
    '',
    'Pode enviar uma foto de cada vez, agora mesmo, aqui no WhatsApp. Assim que eu receber as duas, seguimos com a confirmação do seu agendamento. 💙',
  ].join('\n');
}

export function mensagemDocumentoRecebidoParcial(): string {
  return [
    'Recebi 1 dos 2 documentos necessários. ✅',
    '',
    'Agora envie a outra foto (carteirinha ou pedido médico) para eu continuar com o agendamento.',
  ].join('\n');
}

export function mensagemDocumentosCompletos(): string {
  return 'Documentos recebidos! ✅\nVamos finalizar seu agendamento.';
}

// ─── Atendimento humano ─────────────────────────────────────────

export function mensagemTransferenciaHumana(primeiroNome?: string): string {
  const oi = primeiroNome ? `Tudo bem, *${primeiroNome}*!` : 'Tudo bem!';
  return [
    `${oi} 💙`,
    '',
    'Vou te transferir para a nossa recepção. Em instantes alguém do time assume por aqui.',
    '',
    `Se preferir falar agora, ligue para *${TELEFONE_FIXO_CLINICA}*.`,
  ].join('\n');
}

// ─── IA ─────────────────────────────────────────────────────────

export function mensagemExamesEntendidos(lista: string): string {
  return [
    'Perfeito! Entendi que você quer: ✨',
    '',
    lista,
  ].join('\n');
}

export function mensagemDuvidaFallback(): string {
  return 'Posso te ajudar a agendar um exame cardiológico. Quer ver as opções? 😊';
}
