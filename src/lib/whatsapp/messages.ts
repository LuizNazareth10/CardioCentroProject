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
    'Vou te ajudar a agendar seu exame com atenção e agilidade.',
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
    'Obrigada pelo contato! Como posso te ajudar hoje? 😊',
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

export function mensagemPerguntarIdade(): string {
  return 'Antes de continuar: esse agendamento é para um *adulto* ou para uma *criança*?';
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

// ─── Planos não atendidos dentro de um convênio aceito ──────────

/** lista "*A* e *B*" / "*A*, *B* e *C*" em negrito do WhatsApp */
function listarEmNegrito(itens: string[]): string {
  const marcados = itens.map((p) => `*${p}*`);
  if (marcados.length <= 1) return marcados[0] ?? '';
  return `${marcados.slice(0, -1).join(', ')} e ${marcados[marcados.length - 1]}`;
}

/**
 * Aviso ANTES de fechar o convênio: a clínica aceita a operadora, mas não
 * alguns planos dela. Melhor descobrir agora do que o paciente ser recusado
 * na recepção no dia do exame.
 */
export function mensagemAvisoPlanoNaoAtendido(convenio: string, planos: string[]): string {
  return [
    `Antes de seguirmos com o *${convenio}*, preciso confirmar um detalhe importante: 📋`,
    '',
    `Não atendemos ${listarEmNegrito(planos)}.`,
    `Os demais planos ${convenio} são atendidos normalmente.`,
    '',
    'O seu plano é um desses?',
  ].join('\n');
}

/** o plano do paciente é um dos não atendidos (ou ele não tem certeza) */
export function mensagemPlanoNaoAtendidoTransbordo(convenio: string, planos: string[]): string {
  return [
    `Entendi! 💙`,
    '',
    `Como não atendemos ${listarEmNegrito(planos)}, prefiro confirmar isso com a nossa recepção antes de marcar — assim você não corre o risco de vir até aqui e não conseguir realizar o exame.`,
    '',
    `Se preferir adiantar, você também pode ligar para *${TELEFONE_FIXO_CLINICA}*.`,
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

// ─── Remarcação (paciente pede outro horário) ───────────────────

/**
 * Saudação de quem JÁ tem exame marcado. O agente reconhece o número, carrega
 * o agendamento futuro e oferece remarcar — antes ele mandava ligar para a
 * clínica, o que jogava trabalho para a recepção sem necessidade.
 */
export function mensagemMenuComAgendamento(primeiroNome: string | undefined, resumo: string): string {
  const oi = primeiroNome ? `Olá, *${primeiroNome}*! 👋` : 'Olá! 👋';
  return [
    oi,
    '',
    `Aqui é a *${CONTATO.nomeClinica}* 💙`,
    '',
    'Vi aqui que você já tem exame marcado:',
    resumo,
    '',
    'Como posso te ajudar? 😊',
  ].join('\n');
}

export function mensagemConfirmarRemarcacao(resumo: string): string {
  return [
    '🔁 *Remarcar exame*',
    SEP,
    resumo,
    SEP,
    '',
    'Quer que eu procure um novo horário para você?',
    '',
    '_O horário atual só é liberado depois que você escolher e confirmar o novo._',
  ].join('\n');
}

export function mensagemRemarcacaoMantida(): string {
  return [
    'Combinado, seu horário continua o mesmo. 💙',
    '',
    'Se mudar de ideia, é só me chamar aqui.',
  ].join('\n');
}

export function mensagemBuscandoNovosHorarios(): string {
  return 'Certo! Vou procurar os horários livres para esse exame… 🔎';
}

export function mensagemResumoRemarcacao(de: string, para: string): string {
  return [
    '🔁 *Confirme a remarcação*',
    SEP,
    `*De:* ~${de}~`,
    `*Para:* ${para}`,
    SEP,
    '',
    'Confirma a mudança?',
  ].join('\n');
}

export function mensagemRemarcacaoConfirmada(primeiroNome: string, data: string, hora: string): string {
  return [
    `Pronto, *${primeiroNome}*! Seu exame foi remarcado. ✅`,
    '',
    `📅 Novo horário: *${data}* às *${hora}*`,
    '',
    `📍 *${CONTATO.enderecoCompleto}*`,
    '',
    'O horário anterior foi liberado. Te esperamos! 💙',
  ].join('\n');
}

export function mensagemRemarcacaoFalhou(): string {
  return [
    'Esse horário acabou de ser ocupado. 😕',
    '',
    'Vou te mostrar as opções que ainda estão livres…',
  ].join('\n');
}

export function mensagemSemAgendamentoParaRemarcar(): string {
  return [
    'Não encontrei nenhum exame marcado no seu número. 🤔',
    '',
    'Se você marcou com outro telefone, posso te passar para a recepção — responda *atendente*.',
    '',
    'Ou, se preferir, posso agendar um exame novo agora mesmo.',
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
    '🔁 *Precisa mudar o horário?*',
    'É só me mandar uma mensagem aqui que eu remarco para você.',
    '',
    '📞 *Cancelar*',
    `Para cancelar, ligue para nosso telefone fixo:`,
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
    'Sem problema: você pode escolher os exames pela lista, ou falar com uma de nossas atendentes — é só escolher abaixo.',
  ].join('\n');
}

export function mensagemPedidoNaoIdentificado(): string {
  return [
    'Recebi sua foto, mas não consegui identificar os exames nela. 🤔',
    '',
    'Para não te deixar sem resposta: você pode escolher os exames pela lista, ou falar com uma de nossas atendentes, que consegue ver o pedido com você.',
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

/**
 * Transbordo NATURAL para finalizar o agendamento com a recepção — usado
 * quando o convênio informado exige tratamento manual (ex.: IPSEMG). Do
 * ponto de vista do paciente é só "a recepção conclui"; o motivo (regra
 * interna) não é mencionado, para não soar estranho.
 */
export function mensagemFinalizarComRecepcao(primeiroNome?: string): string {
  const oi = primeiroNome ? `Perfeito, *${primeiroNome}*!` : 'Perfeito!';
  return [
    `${oi} 💙`,
    '',
    'Para concluir o seu agendamento com esse convênio, vou te passar para a nossa recepção.',
    '',
    'Já deixei aqui os detalhes do que você escolheu para agilizar. Uma atendente irá dar continuidade ao atendimento.',
  ].join('\n');
}

/**
 * Transbordo NATURAL para agendamento de criança/menor de idade — a recepção
 * assume para garantir o suporte adequado. Mesmo padrão do transbordo de
 * convênio: não expõe a regra interna ao paciente, só avisa a transferência.
 */
export function mensagemTransbordoMenorIdade(primeiroNome?: string): string {
  const oi = primeiroNome ? `Tudo bem, *${primeiroNome}*!` : 'Tudo bem!';
  return [
    `${oi} 💙`,
    '',
    'Para agendamentos de crianças, a nossa recepção cuida diretamente para garantir todo o suporte necessário.',
    '',
    'Vou te transferir — uma atendente continua o atendimento por aqui mesmo.',
  ].join('\n');
}

export function mensagemTransferenciaHumana(primeiroNome?: string): string {
  const oi = primeiroNome ? `Tudo bem, *${primeiroNome}*!` : 'Tudo bem!';
  return [
    `${oi} 💙`,
    '',
    'Vou te transferir para a nossa recepção. Uma atendente irá dar continuidade ao atendimento.',
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

/**
 * Confirmação explícita da lista lida de um texto livre. Existe porque a
 * leitura de texto pode captar MENOS exames do que o paciente pediu (ele
 * escreve "eco e duplex de carótidas" e só o eco é reconhecido); sem uma
 * confirmação, ele segue o fluxo achando que marcou os dois e só descobre no
 * dia. Mostrar a lista e travar até ele dizer "é isso" é o que evita marcar
 * exame a menos sem ninguém perceber.
 */
export function mensagemConfirmarExames(lista: string): string {
  return [
    'Entendi que você quer marcar: ✨',
    '',
    lista,
    '',
    '*Confere pra mim:* é só isso mesmo, ou falta algum exame?',
  ].join('\n');
}

export function mensagemDuvidaFallback(): string {
  return 'Posso te ajudar a agendar um exame cardiológico. Quer ver as opções? 😊';
}
