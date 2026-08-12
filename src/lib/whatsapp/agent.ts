import { APARELHOS, CONVENIOS, CONVENIOS_REQUEREM_AUTORIZACAO_IDS, CONVENIOS_TRANSBORDO_IMEDIATO_IDS, EXAMES, MEDICOS, PLANOS_NAO_ATENDIDOS } from '../seed-data';
import { atualizarAgendamento, criarAgendamentos, criarPaciente, listarAgendamentos, obterPacientePorTelefone, registrarLeadWhatsapp, registrarMensagem } from '../db';
import { gerarSlots, gerarSlotsAparelho, proporSessao } from '../scheduling/engine';
import { aplicarRemarcacao, planejarRemarcacao } from '../scheduling/remarcar';
import { fmtData, fmtDiaCurto, fmtHora } from '../format';
import { baixarMidia, enviarBotoes, enviarLista, enviarTexto } from './client';
import {
  mensagemAgendamentoCancelado,
  mensagemAgendamentoConfirmado,
  mensagemAvisoPlanoNaoAtendido,
  mensagemBoasVindasAgendamento,
  mensagemBuscandoNovosHorarios,
  mensagemConfirmarRemarcacao,
  mensagemMenuComAgendamento,
  mensagemPlanoNaoAtendidoTransbordo,
  mensagemRemarcacaoConfirmada,
  mensagemRemarcacaoFalhou,
  mensagemRemarcacaoMantida,
  mensagemResumoRemarcacao,
  mensagemSemAgendamentoParaRemarcar,
  mensagemConfirmacaoLembreteRecebida,
  mensagemConvenioNaoEncontrado,
  mensagemConvenioOutro,
  mensagemDocumentoRecebidoParcial,
  mensagemDocumentosCompletos,
  mensagemErroImagem,
  mensagemExameAdicionado,
  mensagemExameDuplicado,
  mensagemExamesEntendidos,
  mensagemEscolherDia,
  mensagemHorarioOcupado,
  mensagemHorariosDoDia,
  mensagemHorariosSugeridos,
  mensagemLembretesGerais,
  mensagemListaExames,
  mensagemMenuPrincipal,
  mensagemPedidoIdentificado,
  mensagemPedidoNaoIdentificado,
  mensagemPedirConvenio,
  mensagemPedirDocumentosAutorizacao,
  mensagemPedirNome,
  mensagemPerguntarIdade,
  mensagemPreferenciaMedico,
  mensagemRecebendoPedido,
  mensagemResumoAgendamento,
  mensagemSemHorarios,
  mensagemSemMedicoUnico,
  mensagemFinalizarComRecepcao,
  mensagemTransbordoMenorIdade,
  mensagemTransferenciaHumana,
  mensagemUrgencia,
  montarOrientacoesExames,
} from './messages';
import { carregarSessao, limparSessao, salvarSessao, type AgendamentoFuturoState, type ConversaState } from './session';
import { interpretar, lerPedidoMedico } from './ai';
import { nomeExameDisplay, nomeExameLista, descricaoExameLista } from '../exames-display';

// entrada normalizada do webhook
export interface Entrada {
  tipo: 'texto' | 'interativo' | 'imagem';
  valor: string; // texto digitado, id do botão/lista, OU id da mídia (imagem)
  mime?: string; // mime type quando tipo === 'imagem'
}

function hojeJF(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function agoraJF(): string {
  const d = new Date();
  const date = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo' });
  return `${date}T${time}-03:00`;
}
const nomeExame = (id: string) => nomeExameDisplay(id);
const nomeMedico = (id: string) => MEDICOS.find((m) => m.id === id)?.nome ?? id;

/** Primeiro nome para saudação: cadastro da sessão, senão pushName do WhatsApp. */
function primeiroNome(s: ConversaState): string | undefined {
  const bruto = (s.nome ?? s.pushName ?? '').trim();
  if (!bruto) return undefined;
  // evita usar número/JID como "nome"
  if (/^\d+$/.test(bruto.replace(/\D/g, '')) && bruto.replace(/\D/g, '').length >= 8) return undefined;
  return bruto.split(/\s+/)[0];
}

export async function processarMensagem(
  from: string,
  e: Entrada,
  meta?: { pushName?: string },
): Promise<void> {
  const s = await carregarSessao(from);
  if (meta?.pushName?.trim() && !s.pushName) {
    s.pushName = meta.pushName.trim();
    await salvarSessao(from, s);
  }

  // (0) imagem de pedido médico — tratada em qualquer etapa
  if (e.tipo === 'imagem') return tratarImagem(from, s, e);

  const v = e.valor.trim();
  const vlow = v.toLowerCase();

  // (1) handoff ativo: o agente NÃO processa; apenas registra p/ a recepção
  if (s.etapa === 'humano') {
    await registrarMensagem(
      from,
      { de: 'paciente', texto: v, ts: new Date().toISOString() },
      { nome: s.nome, status: 'aguardando' },
    );
    return; // a recepção assume a conversa
  }

  // (1.5) pedido de atendente HUMANO, em QUALQUER etapa da conversa — não só
  // no menu principal. Existe porque a IA pode se perder ou o paciente pode
  // se confundir com a numeração de um menu (ex.: digitar "1" achando que
  // ainda é a lista de exames, quando na verdade é outro menu) e ficar
  // andando em círculo sem conseguir sair. O botão "Falar com atendente"
  // aparece em praticamente todo menu (ver os `enviarBotoes`/`enviarLista`
  // abaixo), mas o reconhecimento aqui vale mesmo se o paciente digitar
  // "atendente"/"humano" em texto livre, em vez de tocar no botão.
  if (e.valor === 'falar_humano' || (e.tipo === 'texto' && /(atendente|humano|pessoa|recep)/i.test(vlow))) {
    return falarComHumano(from);
  }

  // (1.6) confirmação do lembrete de presença (1 dia antes) — só quando não
  // há fluxo de agendamento em andamento, para não interferir na etapa "confirmando"
  if (
    (s.etapa === 'inicio' || s.etapa === 'menu') &&
    (e.valor === 'lembrete_confirmar' || (e.tipo === 'texto' && /^sim\b|^confirmo\b|^confirmar\b|^confirmado\b/.test(vlow)))
  ) {
    const confirmou = await confirmarAgendamentoPorLembrete(from);
    if (confirmou) return;
  }

  // (2) chegada pelo deep link ("olá, gostaria de agendar um exame") → já inicia o fluxo
  if (
    /gostaria de agendar|quero agendar|agendar (um )?exame|marcar (um )?exame/.test(vlow) &&
    (s.etapa === 'inicio' || s.etapa === 'menu')
  ) {
    s.etapa = 'escolhendo_exames'; s.examesSelecionados = []; await salvarSessao(from, s);
    await enviarTexto(from, mensagemBoasVindasAgendamento(primeiroNome(s)));
    return enviarListaExames(from);
  }

  // comandos globais
  if (['menu', 'oi', 'olá', 'ola', 'início', 'inicio', 'começar', 'comecar'].includes(vlow)) {
    s.etapa = 'menu'; s.examesSelecionados = []; s.medicoPreferidoId = undefined;
    s.opcoes = undefined; s.propostas = undefined; s.aguardandoConvenio = undefined;
    s.remarcandoId = undefined; s.planoConfirmado = undefined; s.idadeConfirmada = undefined;
  }

  switch (s.etapa) {
    case 'inicio':
    case 'menu':
      if (e.valor === 'agendar') {
        s.etapa = 'escolhendo_exames'; await salvarSessao(from, s);
        return enviarListaExames(from);
      }
      if (e.valor === 'remarcar') return iniciarRemarcacao(from, s);
      // confirmação dos exames lidos de um pedido médico (imagem)
      if (e.valor === 'img_sim' && s.examesSelecionados.length) {
        return perguntarIdadeOuContinuar(from, s);
      }
      if (e.valor === 'img_nao') { s.examesSelecionados = []; return menuPrincipal(from, s); }
      if (e.valor.startsWith('ex:')) { s.etapa = 'escolhendo_exames'; return tratarExames(from, s, e); }
      // texto livre no menu → IA
      if (e.tipo === 'texto' && !['menu', 'oi', 'olá', 'ola'].includes(vlow)) return rotearIA(from, s, e.valor);
      return menuPrincipal(from, s);

    case 'escolhendo_exames':
      return tratarExames(from, s, e);

    case 'confirmando_idade':
      return tratarConfirmacaoIdade(from, s, e);

    case 'escolhendo_medico':
      return tratarMedico(from, s, e);

    case 'escolhendo_horario':
      return tratarHorario(from, s, e);

    case 'identificacao':
      return tratarIdentificacao(from, s, e);

    case 'aguardando_documentos':
      return tratarDocumentosAutorizacao(from, s);

    case 'confirmando_plano':
      return tratarConfirmacaoPlano(from, s, e);

    case 'confirmando_remarcacao':
      return tratarConfirmacaoRemarcacao(from, s, e);

    case 'confirmando':
      return tratarConfirmacao(from, s, e);

    default:
      return menuPrincipal(from, s);
  }
}

// -------- MENU --------
// O menu é o ponto em que o agente "reconhece" o número: carrega do banco o
// próximo exame marcado para aquele telefone e, se existir, muda a saudação e
// oferece REMARCAR. Antes o paciente precisava ligar para a clínica.
async function menuPrincipal(from: string, s: ConversaState) {
  s.etapa = 'menu';
  const futuro = await carregarAgendamentoFuturo(from, s);
  await salvarSessao(from, s);

  if (futuro) {
    return enviarBotoes(from, mensagemMenuComAgendamento(primeiroNome(s), futuro.resumo), [
      { id: 'remarcar', titulo: 'Remarcar horário' },
      { id: 'agendar', titulo: 'Marcar outro exame' },
      { id: 'falar_humano', titulo: 'Falar c/ atendente' },
    ]);
  }

  await enviarBotoes(
    from,
    mensagemMenuPrincipal(primeiroNome(s)),
    [
      { id: 'agendar', titulo: 'Agendar exame' },
      { id: 'falar_humano', titulo: 'Falar c/ atendente' },
    ],
  );
}

// -------- AGENDAMENTO FUTURO (estado do número) --------

/** status que ainda "valem" — um exame já realizado/cancelado não é remarcável */
const STATUS_REMARCAVEIS = ['agendado', 'confirmado'];

/**
 * Lê do banco o próximo exame marcado deste telefone e guarda o resumo na
 * sessão. Quando a sessão já tem um agendamento futuro válido (ainda no
 * futuro), reaproveita — evita reler o banco a cada mensagem.
 *
 * Quando os exames foram marcados JUNTOS (mesmo `grupoId`), a âncora é o mais
 * cedo e o resumo lista todos: é a sessão inteira que será movida.
 */
async function carregarAgendamentoFuturo(
  from: string,
  s: ConversaState,
): Promise<AgendamentoFuturoState | null> {
  const agora = agoraJF();
  if (s.agendamentoFuturo && s.agendamentoFuturo.inicio > agora) return s.agendamentoFuturo;
  if (s.futuroVerificado && !s.agendamentoFuturo) return null;
  s.futuroVerificado = true;

  const pac = await acharPacientePorTelefone(from);
  if (!pac) { s.agendamentoFuturo = undefined; return null; }
  s.pacienteId = pac.id;
  if (!s.nome) s.nome = pac.nome;

  const ags = await listarAgendamentos({ pacienteId: pac.id });
  const futuros = ags
    .filter((a) => STATUS_REMARCAVEIS.includes(a.status) && a.inicio > agora)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const ancora = futuros[0];
  if (!ancora) { s.agendamentoFuturo = undefined; return null; }

  // exames marcados na MESMA sessão andam juntos
  const sessao = ancora.grupoId ? futuros.filter((a) => a.grupoId === ancora.grupoId) : [ancora];
  const nomes = sessao.map((a) => nomeExame(a.exameId)).join(' + ');
  const futuro: AgendamentoFuturoState = {
    id: ancora.id,
    inicio: ancora.inicio,
    exameIds: sessao.map((a) => a.exameId),
    resumo: `📅 *${nomes}*\n${fmtData(ancora.inicio)} às ${fmtHora(ancora.inicio)}`,
  };
  s.agendamentoFuturo = futuro;
  return futuro;
}

// -------- REMARCAÇÃO (paciente pede outro horário) --------

async function iniciarRemarcacao(from: string, s: ConversaState) {
  const futuro = await carregarAgendamentoFuturo(from, s);
  if (!futuro) {
    s.etapa = 'menu'; await salvarSessao(from, s);
    return enviarBotoes(from, mensagemSemAgendamentoParaRemarcar(), [
      { id: 'agendar', titulo: 'Agendar exame' },
      { id: 'falar_humano', titulo: 'Falar c/ atendente' },
    ]);
  }
  s.etapa = 'confirmando_remarcacao'; await salvarSessao(from, s);
  return enviarBotoes(from, mensagemConfirmarRemarcacao(futuro.resumo), [
    { id: 'remarcar_sim', titulo: 'Ver novos horários' },
    { id: 'remarcar_nao', titulo: 'Manter como está' },
    { id: 'falar_humano', titulo: 'Falar c/ atendente' },
  ]);
}

/**
 * O paciente confirmou que quer trocar de horário. Daqui em diante o fluxo é
 * o MESMO do agendamento normal (mesmos exames, mesma busca de slots) — a
 * única diferença é `remarcandoId`, que faz a confirmação final MOVER o
 * registro em vez de criar um novo.
 */
async function tratarConfirmacaoRemarcacao(from: string, s: ConversaState, e: Entrada) {
  const vlow = e.valor.trim().toLowerCase();
  if (e.valor === 'remarcar_nao' || /^(n[ãa]o|manter|deixa)/.test(vlow)) {
    s.etapa = 'menu'; s.remarcandoId = undefined; await salvarSessao(from, s);
    return enviarTexto(from, mensagemRemarcacaoMantida());
  }
  if (e.valor === 'remarcar_sim' || /^(sim|quero|pode|vamos|ver)/.test(vlow)) {
    const futuro = s.agendamentoFuturo ?? (await carregarAgendamentoFuturo(from, s));
    if (!futuro) { s.etapa = 'menu'; await salvarSessao(from, s); return menuPrincipal(from, s); }
    s.remarcandoId = futuro.id;
    s.examesSelecionados = [...futuro.exameIds];
    s.medicoPreferidoId = undefined; // sem preferência abre mais opções de horário
    await salvarSessao(from, s);
    await enviarTexto(from, mensagemBuscandoNovosHorarios());
    return calcularEoferecer(from, s);
  }
  return rotearIA(from, s, e.valor);
}

/** resumo "Exame — 12/08 às 14:00" de uma proposta escolhida */
function rotuloProposta(itens: Array<{ exameId: string; inicio: string }>): string {
  const nomes = itens.map((i) => nomeExame(i.exameId)).join(' + ');
  const ini = itens[0].inicio;
  return `${nomes} — ${fmtData(ini)} às ${fmtHora(ini)}`;
}

/**
 * Uma linha por HORÁRIO, não por exame: exames que o médico faz juntos (eco +
 * carótida do Dr. Daher, 15min pelos dois) compartilham início e fim, e
 * repetir o mesmo horário em duas linhas faria o paciente achar que precisa
 * vir duas vezes.
 */
function linhasDosItens(itens: Array<{ exameId: string; medicoId: string; inicio: string }>): string {
  const porHorario = new Map<string, typeof itens>();
  for (const i of itens) {
    const chave = `${i.medicoId}|${i.inicio}`;
    const atual = porHorario.get(chave);
    if (atual) atual.push(i);
    else porHorario.set(chave, [i]);
  }
  return [...porHorario.values()]
    .map((grupo) => {
      const med = MEDICOS.find((m) => m.id === grupo[0].medicoId); // aparelhos (mapa/holter) não são médicos
      const quem = med ? ` (${med.nome})` : '';
      const nomes = grupo.map((i) => nomeExame(i.exameId)).join(' + ');
      const juntos = grupo.length > 1 ? ' _(os dois na mesma sessão)_' : '';
      return `• ${nomes} — ${fmtData(grupo[0].inicio)} ${fmtHora(grupo[0].inicio)}${quem}${juntos}`;
    })
    .join('\n');
}

async function mostrarConfirmacaoRemarcacao(from: string, s: ConversaState) {
  s.etapa = 'confirmando'; await salvarSessao(from, s);
  const escolhida = s.opcoes![0];
  const de = s.agendamentoFuturo
    ? `${fmtData(s.agendamentoFuturo.inicio)} às ${fmtHora(s.agendamentoFuturo.inicio)}`
    : 'horário atual';
  await enviarBotoes(
    from,
    mensagemResumoRemarcacao(de, rotuloProposta(escolhida.itens)),
    [
      { id: 'confirmar_sim', titulo: 'Confirmar ✅' },
      { id: 'confirmar_nao', titulo: 'Voltar' },
      { id: 'falar_humano', titulo: 'Falar c/ atendente' },
    ],
  );
}

/**
 * Aplica a remarcação usando o MESMO motor da área restrita
 * (lib/scheduling/remarcar.ts): o registro é movido, a sessão inteira anda
 * junta e o conflito é revalidado no momento de gravar.
 */
async function efetivarRemarcacao(from: string, s: ConversaState) {
  const escolhida = s.opcoes![0];
  const destino = escolhida.itens[0];
  // passa as posições EXATAS calculadas pelo motor (respeitam janela do médico
  // e a duração dele para cada exame) em vez de deixar o motor de remarcação
  // deslocar às cegas.
  const resultado = await planejarRemarcacao(s.remarcandoId!, {
    inicio: destino.inicio,
    medicoId: destino.medicoId,
    colocacoes: escolhida.itens.map((i) => ({
      exameId: i.exameId,
      medicoId: i.medicoId,
      inicio: i.inicio,
      fim: i.fim,
    })),
  });

  if (!resultado.ok) {
    // alguém ocupou o horário entre a sugestão e a confirmação
    await enviarTexto(from, mensagemRemarcacaoFalhou());
    // força releitura do estado real do banco na próxima consulta
    s.agendamentoFuturo = undefined; s.futuroVerificado = false;
    await salvarSessao(from, s);
    return calcularEoferecer(from, s);
  }

  await aplicarRemarcacao(resultado.plano);
  const nome = s.nome?.split(' ')[0] ?? 'Paciente';
  await limparSessao(from);
  await enviarTexto(from, mensagemRemarcacaoConfirmada(nome, fmtData(destino.inicio), fmtHora(destino.inicio)));
}

// -------- EXAMES --------
// Um exame agendado na mesma sessão não pode se repetir (ex.: dois
// ecocardiogramas no mesmo dia não fazem sentido clínico) — por isso a lista
// de exames já esconde o que o paciente já escolheu.
async function enviarListaExames(from: string, jaSelecionados: string[] = []) {
  const disponiveis = EXAMES.filter((e) => e.ativo && !jaSelecionados.includes(e.id));
  await enviarLista(from, mensagemListaExames(), 'Ver exames', [
    { titulo: 'Exames', itens: disponiveis.map((e) => ({
      id: `ex:${e.id}`,
      titulo: nomeExameLista(e.id),
      descricao: descricaoExameLista(e.id, e.duracaoMin),
    })) },
    { titulo: 'Outra opção', itens: [{ id: 'falar_humano', titulo: 'Falar c/ atendente' }] },
  ]);
}

async function tratarExames(from: string, s: ConversaState, e: Entrada) {
  if (e.valor === 'agendar' || e.valor === 'add_exame') return enviarListaExames(from, s.examesSelecionados);

  if (e.valor.startsWith('ex:')) {
    const id = e.valor.slice(3);
    if (s.examesSelecionados.includes(id)) {
      // já escolhido nesta sessão — não faz sentido duplicar o mesmo exame no mesmo dia
      return enviarTexto(from, mensagemExameDuplicado(nomeExame(id)))
        .then(() => enviarListaExames(from, s.examesSelecionados));
    }
    if (EXAMES.some((x) => x.id === id)) {
      s.examesSelecionados.push(id);
      await salvarSessao(from, s);
      const lista = s.examesSelecionados.map((x, i) => `${i + 1}. ${nomeExame(x)}`).join('\n');
      return enviarBotoes(from, mensagemExameAdicionado(lista), [
        { id: 'add_exame', titulo: 'Adicionar exame' },
        { id: 'concluir_exames', titulo: 'Ver horários' },
        { id: 'falar_humano', titulo: 'Falar c/ atendente' },
      ]);
    }
  }

  if (e.valor === 'concluir_exames') {
    if (s.examesSelecionados.length === 0) return enviarListaExames(from);
    return perguntarIdadeOuContinuar(from, s);
  }

  // texto livre → IA
  return rotearIA(from, s, e.valor);
}

/**
 * Ponto único por onde passam os três caminhos que terminam a escolha de
 * exames (lista de exames, foto de pedido médico, texto livre via IA):
 * pergunta se o agendamento é para adulto ou criança ANTES de seguir para
 * médico/horário. Já perguntado nesta sessão (`idadeConfirmada`), não
 * pergunta de novo — evita repetir a cada exame adicionado.
 */
async function perguntarIdadeOuContinuar(from: string, s: ConversaState) {
  if (s.idadeConfirmada) return continuarAposConfirmarIdade(from, s);
  s.etapa = 'confirmando_idade'; await salvarSessao(from, s);
  return enviarBotoes(from, mensagemPerguntarIdade(), [
    { id: 'idade_adulto', titulo: 'Adulto' },
    { id: 'idade_crianca', titulo: 'Criança' },
    { id: 'falar_humano', titulo: 'Falar c/ atendente' },
  ]);
}

async function tratarConfirmacaoIdade(from: string, s: ConversaState, e: Entrada) {
  const vlow = normalizarTexto(e.valor);
  const crianca = e.valor === 'idade_crianca' || /crianc|menor|infantil|bebe/.test(vlow);
  const adulto = e.valor === 'idade_adulto' || /adulto|maioridade/.test(vlow);

  if (crianca) return transbordarMenorIdade(from, s);
  if (adulto) {
    s.idadeConfirmada = true; await salvarSessao(from, s);
    return continuarAposConfirmarIdade(from, s);
  }
  // resposta que não dá para classificar → repete a pergunta com os botões
  return enviarBotoes(from, mensagemPerguntarIdade(), [
    { id: 'idade_adulto', titulo: 'Adulto' },
    { id: 'idade_crianca', titulo: 'Criança' },
    { id: 'falar_humano', titulo: 'Falar c/ atendente' },
  ]);
}

/** retomada exata do que 'concluir_exames' fazia antes de existir a pergunta de idade */
async function continuarAposConfirmarIdade(from: string, s: ConversaState) {
  // exame de aparelho (Mapa/Holter) não escolhe médico — vai direto p/ horário
  const temAparelho = s.examesSelecionados.some((id) => EXAMES.find((x) => x.id === id)?.aparelho);
  if (temAparelho) { s.medicoPreferidoId = undefined; return calcularEoferecer(from, s); }
  s.etapa = 'escolhendo_medico'; await salvarSessao(from, s);
  return enviarBotoes(from, mensagemPreferenciaMedico(), [
    { id: 'med_qualquer', titulo: 'Sem preferência' },
    { id: 'med_escolher', titulo: 'Escolher médico' },
    { id: 'falar_humano', titulo: 'Falar c/ atendente' },
  ]);
}

/**
 * Transborda quando o agendamento é para uma criança/menor de idade — a
 * recepção assume. Mesmo padrão do transbordo de convênio
 * (transbordarParaFinalizarConvenio): nota interna com o que já foi
 * levantado, lead morno, e mensagem natural ao paciente sem citar a regra.
 */
async function transbordarMenorIdade(from: string, s: ConversaState) {
  const detalhes = s.examesSelecionados.length
    ? `Exames de interesse: ${s.examesSelecionados.map(nomeExame).join(', ')}`
    : 'Sem exames escolhidos ainda.';
  const notaInterna = [
    '⚠️ Transbordo automático — agendamento para CRIANÇA/MENOR DE IDADE (recepção finaliza).',
    `Paciente/responsável: ${s.nome ?? '(não informado)'}`,
    detalhes,
  ].join('\n');

  s.etapa = 'humano';
  await salvarSessao(from, s);

  await registrarMensagem(
    from,
    { de: 'agente', texto: notaInterna, ts: new Date().toISOString(), interna: true },
    { nome: s.nome, status: 'aguardando' },
  );

  try {
    await registrarLeadWhatsapp(from, {
      nome: s.nome,
      exameInteresse: s.examesSelecionados.map(nomeExame).join(', ') || undefined,
      temperatura: 'morno',
    });
  } catch (err) {
    console.error('[agente] falha ao registrar lead (transbordo menor de idade):', err);
  }

  await enviarTexto(from, mensagemTransbordoMenorIdade(primeiroNome(s)));
}

// -------- MÉDICO --------
async function tratarMedico(from: string, s: ConversaState, e: Entrada) {
  if (e.valor === 'med_qualquer') {
    s.medicoPreferidoId = undefined;
    return calcularEoferecer(from, s);
  }
  if (e.valor === 'med_escolher') {
    const habilitados = MEDICOS.filter(
      (m) => m.ativo && s.examesSelecionados.every((ex) => m.examesHabilitados.includes(ex)),
    );
    if (habilitados.length === 0) {
      await enviarTexto(from, mensagemSemMedicoUnico());
      return calcularEoferecer(from, s);
    }
    return enviarLista(from, 'Escolha o médico:', 'Ver médicos', [
      { titulo: 'Médicos', itens: habilitados.map((m) => ({ id: `med:${m.id}`, titulo: m.nome, descricao: m.crm })) },
      { titulo: 'Outra opção', itens: [{ id: 'falar_humano', titulo: 'Falar c/ atendente' }] },
    ]);
  }
  if (e.valor.startsWith('med:')) {
    s.medicoPreferidoId = e.valor.slice(4);
    return calcularEoferecer(from, s);
  }
  return rotearIA(from, s, e.valor);
}

// -------- HORÁRIO --------
// Estratégia de sugestão (mais humana): em vez de despejar 3 horários seguidos
// do mesmo dia, calculamos TODAS as vagas dos próximos ~28 dias e oferecemos
// UM horário por dia, em dias espaçados. Se nenhum agradar, o paciente escolhe
// um dia específico e aí mostramos os horários daquele dia.

type Proposta = NonNullable<ConversaState['propostas']>[number];

/**
 * Janela de agendamentos relevante para a busca de horários: de hoje até
 * ~90 dias à frente. O motor só oferece slots nos próximos ~28-42 dias, e
 * agendamentos no passado não geram conflito futuro — carregar a coleção
 * inteira (~94 mil docs) para marcar UM horário era desperdício puro.
 */
async function agendamentosParaBusca(): Promise<Awaited<ReturnType<typeof listarAgendamentos>>> {
  const hoje = hojeJF();
  const ate = new Date(`${hoje}T12:00:00Z`);
  ate.setUTCDate(ate.getUTCDate() + 90);
  return listarAgendamentos({ de: `${hoje}T00:00:00-03:00`, ate: `${ate.toISOString().slice(0, 10)}T23:59:59-03:00` });
}

async function calcularEoferecer(from: string, s: ConversaState) {
  const examesSeq = s.examesSelecionados.map((id) => EXAMES.find((x) => x.id === id)!).filter(Boolean);
  const agendamentos = await agendamentosParaBusca();
  const propostas: Proposta[] = [];

  if (examesSeq.length === 1 && examesSeq[0].aparelho) {
    // exame de aparelho (Mapa/Holter): slots fixos, sexta bloqueada
    const cfg = APARELHOS[examesSeq[0].aparelho];
    const slots = gerarSlotsAparelho(cfg, agendamentos, {
      dataInicio: hojeJF(), dias: 28, naoAntesDe: agoraJF(), limite: 400,
    });
    slots.forEach((sl) => propostas.push({
      data: sl.inicio.slice(0, 10), inicio: sl.inicio, subtitulo: cfg.nome,
      rotulo: `${fmtData(sl.inicio)} ${fmtHora(sl.inicio)} — ${cfg.nome}`,
      itens: [{ exameId: examesSeq[0].id, medicoId: sl.medicoId, inicio: sl.inicio, fim: sl.fim }],
    }));
  } else if (examesSeq.length === 1) {
    const slots = gerarSlots(examesSeq[0], MEDICOS, agendamentos, {
      dataInicio: hojeJF(), dias: 28, medicoPreferidoId: s.medicoPreferidoId, naoAntesDe: agoraJF(), limite: 400,
    });
    slots.forEach((sl) => propostas.push({
      data: sl.inicio.slice(0, 10), inicio: sl.inicio, subtitulo: sl.medicoNome,
      rotulo: `${fmtData(sl.inicio)} ${fmtHora(sl.inicio)} — ${sl.medicoNome}`,
      itens: [{ exameId: examesSeq[0].id, medicoId: sl.medicoId, inicio: sl.inicio, fim: sl.fim }],
    }));
  } else {
    // multi-exame: uma proposta de sessão consecutiva por dia, em vários dias
    let dataBusca = hojeJF();
    for (let tentativa = 0; tentativa < 14; tentativa++) {
      const p = proporSessao(examesSeq, MEDICOS, agendamentos, {
        dataInicio: dataBusca, dias: 28, medicoPreferidoId: s.medicoPreferidoId, naoAntesDe: agoraJF(),
      });
      if (!p) break;
      const ini = p.itens[0].inicio;
      // `combinada` = o médico faz exames desta sessão no mesmo horário
      const sub = p.combinada
        ? `${examesSeq.length} exames juntos · ${nomeMedico(p.itens[0].medicoId)}`
        : p.mesmoMedico
          ? `${examesSeq.length} exames · ${nomeMedico(p.itens[0].medicoId)}`
          : `${examesSeq.length} exames · médicos diferentes`;
      propostas.push({
        data: ini.slice(0, 10), inicio: ini, subtitulo: sub,
        rotulo: `${fmtData(ini)} ${fmtHora(ini)} — ${sub}`,
        itens: p.itens.map((i) => ({ exameId: i.exameId, medicoId: i.medicoId, inicio: i.inicio, fim: i.fim })),
      });
      // próxima busca começa no dia seguinte ao encontrado
      const d = new Date(`${ini.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
      dataBusca = d.toISOString().slice(0, 10);
    }
  }

  if (propostas.length === 0) {
    await enviarTexto(from, mensagemSemHorarios());
    return;
  }

  s.propostas = propostas; s.etapa = 'escolhendo_horario'; await salvarSessao(from, s);
  return mostrarDiasSugeridos(from, s);
}

/** oferece UM horário por dia, em dias espaçados (+ opção de escolher outro dia) */
async function mostrarDiasSugeridos(from: string, s: ConversaState) {
  const props = s.propostas ?? [];
  const vistos = new Set<string>();
  const itens: Array<{ id: string; titulo: string; descricao?: string }> = [];
  for (let i = 0; i < props.length; i++) {
    if (vistos.has(props[i].data)) continue; // um por dia (o primeiro é o mais cedo)
    vistos.add(props[i].data);
    itens.push({ id: `slot:${i}`, titulo: `${fmtDiaCurto(props[i].inicio)} · ${fmtHora(props[i].inicio)}`, descricao: props[i].subtitulo });
    if (itens.length >= 6) break;
  }
  const totalDias = new Set(props.map((p) => p.data)).size;
  if (totalDias > itens.length) {
    itens.push({ id: 'mais_datas', titulo: '📅 Escolher outro dia', descricao: 'Ver todas as datas disponíveis' });
  }
  await enviarLista(from, mensagemHorariosSugeridos(), 'Ver horários', [
    { titulo: 'Sugestões', itens },
    { titulo: 'Outra opção', itens: [{ id: 'falar_humano', titulo: 'Falar c/ atendente' }] },
  ]);
}

/** lista os dias que têm vaga, para o paciente escolher um específico */
async function mostrarDatasDisponiveis(from: string, s: ConversaState) {
  const props = s.propostas ?? [];
  const porDia = new Map<string, number>();
  for (const p of props) porDia.set(p.data, (porDia.get(p.data) ?? 0) + 1);
  // 9 (não 10): o 10º lugar é reservado pro "Falar com atendente" logo abaixo —
  // sem isso, o limite de 10 itens do WhatsApp cortaria o botão de escape.
  const itens = [...porDia.entries()].slice(0, 9).map(([data, n]) => ({
    id: `data:${data}`,
    titulo: fmtDiaCurto(data),
    descricao: `${n} horário${n > 1 ? 's' : ''} disponíve${n > 1 ? 'is' : 'l'}`,
  }));
  await enviarLista(from, mensagemEscolherDia(), 'Ver dias', [
    { titulo: 'Dias disponíveis', itens },
    { titulo: 'Outra opção', itens: [{ id: 'falar_humano', titulo: 'Falar c/ atendente' }] },
  ]);
}

/** mostra os horários de um dia específico escolhido pelo paciente */
async function mostrarHorariosDoDia(from: string, s: ConversaState, data: string) {
  const props = s.propostas ?? [];
  // 8 (não 9): sobram 2 lugares — "Ver outros dias" logo abaixo e "Falar com
  // atendente" na seção seguinte — sem estourar o limite de 10 do WhatsApp.
  const itens: Array<{ id: string; titulo: string; descricao?: string }> = [];
  for (let i = 0; i < props.length && itens.length < 8; i++) {
    if (props[i].data !== data) continue;
    itens.push({ id: `slot:${i}`, titulo: fmtHora(props[i].inicio), descricao: props[i].subtitulo });
  }
  if (itens.length === 0) return mostrarDatasDisponiveis(from, s);
  itens.push({ id: 'mais_datas', titulo: '📅 Ver outros dias', descricao: 'Voltar para a lista de datas' });
  await enviarLista(from, mensagemHorariosDoDia(fmtDiaCurto(data)), 'Ver horários', [
    { titulo: 'Horários', itens },
    { titulo: 'Outra opção', itens: [{ id: 'falar_humano', titulo: 'Falar c/ atendente' }] },
  ]);
}

async function tratarHorario(from: string, s: ConversaState, e: Entrada) {
  if (e.valor === 'mais_datas') return mostrarDatasDisponiveis(from, s);
  if (e.valor.startsWith('data:')) return mostrarHorariosDoDia(from, s, e.valor.slice(5));
  if (e.valor.startsWith('slot:')) {
    const idx = Number(e.valor.slice(5));
    const escolhida = s.propostas?.[idx];
    if (escolhida) {
      s.opcoes = [{ rotulo: escolhida.rotulo, itens: escolhida.itens }]; // mantém apenas a escolhida
      // REMARCANDO: paciente e convênio já são conhecidos (o agendamento já
      // existe) — pula a identificação e vai direto para a confirmação.
      if (s.remarcandoId) return mostrarConfirmacaoRemarcacao(from, s);
      s.etapa = 'identificacao'; await salvarSessao(from, s);
      // tenta achar paciente pelo telefone
      const pac = await acharPacientePorTelefone(from);
      if (pac) {
        s.nome = pac.nome; s.pacienteId = pac.id; s.convenioId = pac.convenioId; await salvarSessao(from, s);
        return pedirConvenioOuConfirmar(from, s);
      }
      return enviarTexto(from, mensagemPedirNome());
    }
  }
  return rotearIA(from, s, e.valor);
}

// -------- IDENTIFICAÇÃO --------
// Convênios de maior porte/volume em Juiz de Fora — exibidos primeiro
// (não em ordem alfabética). Os demais ficam acessíveis por "Outro
// convênio" (o paciente digita e casamos com a lista completa).
const CONVENIOS_POPULARES = ['Particular', 'Unimed', 'Sabin Sinai', 'PLASC', 'Bradesco', 'Sul América', 'CASSI', 'IPSEMG', 'CEMIG Saúde'];

function normalizarTexto(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

/** casa um texto livre com um convênio da lista completa (acento/pontuação-insensível) */
function acharConvenio(texto: string) {
  const n = normalizarTexto(texto);
  if (!n) return null;
  const exato = CONVENIOS.find((c) => normalizarTexto(c.nome) === n);
  if (exato) return exato;
  return CONVENIOS.find((c) => {
    const cn = normalizarTexto(c.nome);
    return cn.includes(n) || n.includes(cn);
  }) ?? null;
}

async function tratarIdentificacao(from: string, s: ConversaState, e: Entrada) {
  if (!s.nome) {
    s.nome = e.valor.trim(); await salvarSessao(from, s);
    return pedirConvenioOuConfirmar(from, s);
  }
  if (e.valor === 'conv_outro') {
    s.aguardandoConvenio = true; await salvarSessao(from, s);
    return enviarTexto(from, mensagemConvenioOutro());
  }
  if (e.valor.startsWith('conv:')) {
    s.convenioId = e.valor.slice(5); s.aguardandoConvenio = false;
    s.planoConfirmado = false; // convênio novo → o aviso de plano vale de novo
    await salvarSessao(from, s);
    return avancarAposConvenio(from, s);
  }
  // texto livre: tenta casar com um convênio da lista completa
  const c = acharConvenio(e.valor);
  if (c) {
    s.convenioId = c.id; s.aguardandoConvenio = false;
    s.planoConfirmado = false;
    await salvarSessao(from, s);
    return avancarAposConvenio(from, s);
  }
  if (s.aguardandoConvenio) {
    return enviarTexto(from, mensagemConvenioNaoEncontrado(e.valor));
  }
  // não estava esperando texto de convênio → reapresenta a lista
  return pedirConvenioOuConfirmar(from, s);
}

/** convênios que exigem carteirinha + pedido médico por foto antes de confirmar */
function convenioRequerAutorizacao(convenioId?: string): boolean {
  return !!convenioId && CONVENIOS_REQUEREM_AUTORIZACAO_IDS.includes(convenioId);
}

/** convênios que a clínica só finaliza na recepção (ex.: IPSEMG) */
function convenioExigeTransbordo(convenioId?: string): boolean {
  return !!convenioId && CONVENIOS_TRANSBORDO_IMEDIATO_IDS.includes(convenioId);
}

/** planos não atendidos DENTRO de um convênio aceito (ex.: Unimed Mix) */
function planosNaoAtendidos(convenioId?: string): string[] {
  return (convenioId && PLANOS_NAO_ATENDIDOS[convenioId]) || [];
}

function nomeConvenio(convenioId?: string): string {
  return CONVENIOS.find((c) => c.id === convenioId)?.nome ?? convenioId ?? '';
}

/** após saber o convênio: transborda (se exigido), pede documentos, ou confirma */
async function avancarAposConvenio(from: string, s: ConversaState) {
  // regra de negócio: alguns convênios (ex.: IPSEMG) não são fechados pelo
  // agente — a recepção conclui. Transbordo natural, sem explicar o motivo.
  if (convenioExigeTransbordo(s.convenioId)) {
    return transbordarParaFinalizarConvenio(from, s);
  }

  // a operadora é aceita, mas alguns planos dela não (ex.: Unimed Mix/Fácil,
  // Bradesco Sistel). Perguntamos ANTES de marcar — descobrir isso só na
  // recepção, no dia do exame, seria péssimo para o paciente.
  const planos = planosNaoAtendidos(s.convenioId);
  if (planos.length && !s.planoConfirmado) {
    s.etapa = 'confirmando_plano'; await salvarSessao(from, s);
    return enviarBotoes(from, mensagemAvisoPlanoNaoAtendido(nomeConvenio(s.convenioId), planos), [
      { id: 'plano_ok', titulo: 'Não é esse plano' },
      { id: 'plano_restrito', titulo: 'É esse / não sei' },
      { id: 'falar_humano', titulo: 'Falar c/ atendente' },
    ]);
  }
  if (convenioRequerAutorizacao(s.convenioId) && (s.docsAutorizacaoRecebidos ?? 0) < 2) {
    return pedirDocumentosAutorizacao(from, s);
  }
  return mostrarConfirmacao(from, s);
}

/**
 * Transborda a conversa para a recepção FINALIZAR o agendamento (convênio que
 * a clínica trata manualmente). Deixa uma NOTA INTERNA — invisível ao
 * paciente — com convênio, exames e horário pretendido, para o atendente
 * assumir sem precisar perguntar tudo de novo.
 */
async function transbordarParaFinalizarConvenio(from: string, s: ConversaState) {
  const nomeConvenio = CONVENIOS.find((c) => c.id === s.convenioId)?.nome ?? s.convenioId ?? '—';
  const escolhida = s.opcoes?.[0];
  const detalhes = escolhida?.itens.length ? linhasDosItens(escolhida.itens) : '';
  const notaInterna = [
    `⚠️ Transbordo automático — convênio *${nomeConvenio}* (finalizar na recepção).`,
    `Paciente: ${s.nome ?? '(não informado)'}`,
    detalhes ? `Pretendido:\n${detalhes}` : 'Sem horário escolhido ainda.',
  ].join('\n');

  s.etapa = 'humano';
  await salvarSessao(from, s);

  // nota só para a equipe (interna: true → não vai ao paciente)
  await registrarMensagem(
    from,
    { de: 'agente', texto: notaInterna, ts: new Date().toISOString(), interna: true },
    { nome: s.nome, status: 'aguardando' },
  );

  // lead MORNO: demonstrou interesse e foi para atendimento humano
  try {
    await registrarLeadWhatsapp(from, {
      nome: s.nome,
      exameInteresse: (escolhida?.itens ?? []).map((i) => nomeExame(i.exameId)).join(', ') || undefined,
      temperatura: 'morno',
    });
  } catch (err) {
    console.error('[agente] falha ao registrar lead (transbordo convênio):', err);
  }

  // mensagem natural ao paciente (sem citar a regra interna)
  await enviarTexto(from, mensagemFinalizarComRecepcao(primeiroNome(s)));
}

async function pedirDocumentosAutorizacao(from: string, s: ConversaState) {
  s.etapa = 'aguardando_documentos';
  s.docsAutorizacaoRecebidos = s.docsAutorizacaoRecebidos ?? 0;
  await salvarSessao(from, s);
  const nomeConvenio = CONVENIOS.find((c) => c.id === s.convenioId)?.nome ?? '';
  await enviarTexto(from, mensagemPedirDocumentosAutorizacao(nomeConvenio));
}

/**
 * Resposta ao aviso de plano não atendido.
 *
 * A ordem dos testes importa: "não sei" começa com "não", mas significa
 * INCERTEZA (vai para a recepção), não "não é esse plano". Por isso a
 * incerteza é avaliada antes da negativa.
 */
async function tratarConfirmacaoPlano(from: string, s: ConversaState, e: Entrada) {
  const v = e.valor.trim();
  const vlow = normalizarTexto(v);
  const planos = planosNaoAtendidos(s.convenioId);
  const convenio = nomeConvenio(s.convenioId);

  const incerto = /naosei|nsei|naotenhocerteza|acho|talvez|nomeio|nãosei/.test(vlow);
  const afirmativo = /^(sim|e|eh|isso|exato|correto)/.test(vlow);
  const negativo = /^(nao|outro|diferente)/.test(vlow);

  if (e.valor === 'plano_ok' || (negativo && !incerto)) {
    s.planoConfirmado = true; await salvarSessao(from, s);
    return avancarAposConvenio(from, s);
  }

  if (e.valor === 'plano_restrito' || incerto || afirmativo) {
    await enviarTexto(from, mensagemPlanoNaoAtendidoTransbordo(convenio, planos));
    return falarComHumano(from);
  }

  // resposta que não dá para classificar → repete a pergunta com os botões
  return enviarBotoes(from, mensagemAvisoPlanoNaoAtendido(convenio, planos), [
    { id: 'plano_ok', titulo: 'Não é esse plano' },
    { id: 'plano_restrito', titulo: 'É esse / não sei' },
    { id: 'falar_humano', titulo: 'Falar c/ atendente' },
  ]);
}

/** texto/botão recebido enquanto aguardamos as fotos — só reforça o pedido */
async function tratarDocumentosAutorizacao(from: string, s: ConversaState) {
  const nomeConvenio = CONVENIOS.find((c) => c.id === s.convenioId)?.nome ?? '';
  return enviarTexto(from, mensagemPedirDocumentosAutorizacao(nomeConvenio));
}

async function pedirConvenioOuConfirmar(from: string, s: ConversaState) {
  if (s.convenioId) return avancarAposConvenio(from, s);
  const populares = CONVENIOS_POPULARES
    .map((nome) => CONVENIOS.find((c) => c.nome === nome))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    // 8 (não os 9 da lista): sobram 2 lugares — "Outro convênio" e "Falar com
    // atendente" — sem estourar o limite de 10 itens do WhatsApp. O convênio
    // que ficar de fora continua digitável via "Outro convênio".
    .slice(0, 8);
  const itens: Array<{ id: string; titulo: string; descricao?: string }> = populares.map((c) => ({ id: `conv:${c.id}`, titulo: c.nome }));
  itens.push({ id: 'conv_outro', titulo: 'Outro convênio', descricao: 'Não está na lista? Digite o nome' });
  return enviarLista(from, mensagemPedirConvenio(s.nome?.split(' ')[0] ?? ''), 'Ver convênios', [
    { titulo: 'Convênios', itens },
    { titulo: 'Outra opção', itens: [{ id: 'falar_humano', titulo: 'Falar c/ atendente' }] },
  ]);
}

// -------- CONFIRMAÇÃO --------
async function enviarPosConfirmacao(
  from: string,
  primeiroNome: string,
  inicioIso: string,
  exameIds: string[],
) {
  await enviarTexto(from, mensagemAgendamentoConfirmado(primeiroNome, fmtData(inicioIso), fmtHora(inicioIso)));
  await enviarTexto(from, mensagemLembretesGerais());
  for (const orient of montarOrientacoesExames(exameIds)) {
    await enviarTexto(from, orient);
  }
}

async function mostrarConfirmacao(from: string, s: ConversaState) {
  s.etapa = 'confirmando'; await salvarSessao(from, s);
  const escolhida = s.opcoes![0]; // já reduzida à opção escolhida
  const linhas = linhasDosItens(escolhida.itens);
  const conv = CONVENIOS.find((c) => c.id === s.convenioId)?.nome ?? 'Particular';
  await enviarBotoes(
    from,
    mensagemResumoAgendamento(s.nome ?? '', conv, linhas),
    [
      { id: 'confirmar_sim', titulo: 'Confirmar ✅' },
      { id: 'confirmar_nao', titulo: 'Cancelar' },
      { id: 'falar_humano', titulo: 'Falar c/ atendente' },
    ],
  );
}

async function tratarConfirmacao(from: string, s: ConversaState, e: Entrada) {
  if (e.valor === 'confirmar_nao' || /n[ãa]o|cancel/i.test(e.valor)) {
    // numa remarcação, "não" significa desistir da MUDANÇA — o agendamento
    // original continua de pé; não é o mesmo que cancelar um agendamento novo.
    if (s.remarcandoId) {
      s.remarcandoId = undefined; s.etapa = 'menu'; s.opcoes = undefined; s.propostas = undefined;
      await salvarSessao(from, s);
      return enviarTexto(from, mensagemRemarcacaoMantida());
    }
    await limparSessao(from);
    return enviarTexto(from, mensagemAgendamentoCancelado());
  }
  if (e.valor === 'confirmar_sim' || /sim|confirm/i.test(e.valor)) {
    if (s.remarcandoId) return efetivarRemarcacao(from, s);
    const escolhida = s.opcoes![0];
    // garante paciente
    let pacienteId = s.pacienteId;
    if (!pacienteId) {
      const novo = await criarPaciente({
        nome: s.nome ?? 'Paciente WhatsApp', telefone: from, convenioId: s.convenioId,
        fichaMedica: fichaVazia(),
      });
      pacienteId = novo.id;
    }
    // revalida conflito e grava (janela futura, não a coleção inteira)
    const existentes = await agendamentosParaBusca();
    const conflito = escolhida.itens.some((novo) => existentes.some(
      (x) => x.medicoId === novo.medicoId && x.status !== 'cancelado' && novo.inicio < x.fim && x.inicio < novo.fim,
    ));
    if (conflito) {
      s.etapa = 'escolhendo_medico'; await salvarSessao(from, s);
      await enviarTexto(from, mensagemHorarioOcupado());
      return calcularEoferecer(from, s);
    }
    await criarAgendamentos(escolhida.itens.map((i) => ({
      pacienteId: pacienteId!, pacienteNome: s.nome ?? 'Paciente WhatsApp',
      medicoId: i.medicoId, exameId: i.exameId, convenioId: s.convenioId ?? 'particular',
      inicio: i.inicio, fim: i.fim, status: 'agendado', origem: 'whatsapp',
    })));
    const primeiro = escolhida.itens[0];
    const exameIds = escolhida.itens.map((i) => i.exameId);
    await limparSessao(from);
    // registra/atualiza o lead como QUENTE (agendou) — não pode quebrar o fluxo
    try {
      await registrarLeadWhatsapp(from, {
        nome: s.nome,
        exameInteresse: exameIds.map(nomeExame).join(', '),
        status: 'agendado',
        temperatura: 'quente',
      });
    } catch (err) {
      console.error('[agente] falha ao registrar lead quente:', err);
    }
    await enviarPosConfirmacao(from, s.nome?.split(' ')[0] ?? 'Paciente', primeiro.inicio, exameIds);
    return;
  }
  return s.remarcandoId ? mostrarConfirmacaoRemarcacao(from, s) : mostrarConfirmacao(from, s);
}

// -------- IA / utilidades --------
async function rotearIA(from: string, s: ConversaState, texto: string) {
  // pergunta em texto livre ("precisa de preparo?", "posso comer antes?") só
  // faz sentido responder de forma específica se soubermos QUAL exame é —
  // sem isso a IA teria que perguntar de volta. Prioriza o que já está sendo
  // escolhido nesta sessão; se não há nada em andamento, cai pro que o
  // paciente já tem marcado (carregarAgendamentoFuturo cacheia em `s`, então
  // não gera leitura extra se outra parte do fluxo já carregou).
  const futuro = s.examesSelecionados.length ? null : await carregarAgendamentoFuturo(from, s);
  const exameIds = s.examesSelecionados.length ? s.examesSelecionados : futuro?.exameIds;
  const intent = await interpretar(texto, exameIds?.length ? { exameIds } : undefined);
  // urgência médica: orienta a procurar emergência AGORA e transfere p/ humano
  if (intent.acao === 'urgencia') {
    await enviarTexto(from, mensagemUrgencia());
    return falarComHumano(from);
  }
  if (intent.acao === 'humano') return falarComHumano(from);
  // "quero trocar o horário": só faz sentido se este número tiver exame marcado;
  // iniciarRemarcacao já trata o caso de não haver nenhum.
  if (intent.acao === 'remarcar') return iniciarRemarcacao(from, s);
  if (intent.acao === 'menu') { s.etapa = 'menu'; return menuPrincipal(from, s); }
  if (intent.acao === 'duvida') {
    await enviarTexto(from, intent.resposta ?? 'Posso te ajudar a agendar um exame. Quer ver as opções?');
    return menuPrincipal(from, s);
  }
  // agendar: já traz exames (ignora repetidos — não faz sentido o mesmo exame 2x na sessão)
  if (intent.exames.length) {
    const novos = intent.exames.filter((id) => !s.examesSelecionados.includes(id));
    s.examesSelecionados.push(...new Set(novos));
    await salvarSessao(from, s);
    const lista = s.examesSelecionados.map((x, i) => `${i + 1}. ${nomeExame(x)}`).join('\n');
    await enviarTexto(from, mensagemExamesEntendidos(lista));
    return perguntarIdadeOuContinuar(from, s);
  }
  s.etapa = 'escolhendo_exames'; await salvarSessao(from, s);
  return enviarListaExames(from);
}

// -------- CONFIRMAÇÃO DO LEMBRETE (1 dia antes) --------
// Marca de VERDE o agendamento mais próximo desse paciente que já recebeu o
// lembrete e ainda não foi confirmado. É a ÚNICA mudança de status que o
// agente faz sozinho — chegada/atendimento/finalização são sempre manuais.
async function confirmarAgendamentoPorLembrete(from: string): Promise<boolean> {
  const pac = await acharPacientePorTelefone(from);
  if (!pac) return false;
  const ags = await listarAgendamentos({ pacienteId: pac.id });
  const pendente = ags
    .filter((a) => a.status === 'agendado' && a.lembreteEnviadoEm)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
  if (!pendente) return false;
  await atualizarAgendamento(pendente.id, { status: 'confirmado' });
  await enviarTexto(from, mensagemConfirmacaoLembreteRecebida(pac.nome.split(' ')[0], fmtData(pendente.inicio), fmtHora(pendente.inicio)));
  return true;
}

async function falarComHumano(from: string) {
  const s = await carregarSessao(from);
  s.etapa = 'humano'; await salvarSessao(from, s);
  const aviso = mensagemTransferenciaHumana(primeiroNome(s));
  // coloca a conversa na fila de atendimento humano (painel /atendimentos)
  await registrarMensagem(
    from,
    { de: 'agente', texto: aviso, ts: new Date().toISOString() },
    { nome: s.nome, status: 'aguardando' },
  );
  // lead MORNO: demonstrou interesse mas foi para atendimento humano
  try {
    await registrarLeadWhatsapp(from, { nome: s.nome, temperatura: 'morno' });
  } catch (err) {
    console.error('[agente] falha ao registrar lead morno:', err);
  }
  await enviarTexto(from, aviso);
}

// -------- IMAGEM (pedido médico) --------
async function tratarImagem(from: string, s: ConversaState, e: Entrada) {
  // durante handoff, a foto também é só registrada para a recepção
  if (s.etapa === 'humano') {
    await registrarMensagem(
      from,
      { de: 'paciente', texto: '📷 (enviou uma imagem)', ts: new Date().toISOString() },
      { nome: s.nome, status: 'aguardando' },
    );
    return;
  }

  // convênio com autorização: as fotos são carteirinha/pedido médico — só
  // contamos os envios (não fazemos OCR aqui, é o fluxo de leitura de exames)
  if (s.etapa === 'aguardando_documentos') {
    s.docsAutorizacaoRecebidos = (s.docsAutorizacaoRecebidos ?? 0) + 1;
    await salvarSessao(from, s);
    if (s.docsAutorizacaoRecebidos < 2) {
      return enviarTexto(from, mensagemDocumentoRecebidoParcial());
    }
    await enviarTexto(from, mensagemDocumentosCompletos());
    return mostrarConfirmacao(from, s);
  }

  await enviarTexto(from, mensagemRecebendoPedido());
  const midia = await baixarMidia(e.valor);
  if (!midia) {
    return enviarTexto(from, mensagemErroImagem());
  }
  const ids = await lerPedidoMedico(midia.base64, midia.mime);
  if (ids.length === 0) {
    return enviarTexto(from, mensagemPedidoNaoIdentificado());
  }
  s.examesSelecionados = ids; s.etapa = 'menu'; await salvarSessao(from, s);
  const lista = ids.map((id, i) => `${i + 1}. ${nomeExame(id)}`).join('\n');
  return enviarBotoes(from, mensagemPedidoIdentificado(lista), [
    { id: 'img_sim', titulo: 'Sim, agendar' },
    { id: 'img_nao', titulo: 'Não' },
    { id: 'falar_humano', titulo: 'Falar c/ atendente' },
  ]);
}

async function acharPacientePorTelefone(from: string) {
  // query indexada (telefoneSufixo) — antes varria os ~19 mil pacientes
  return obterPacientePorTelefone(from);
}

function fichaVazia() {
  return {
    hipertensao: false, diabetes: false, dislipidemia: false, tabagismo: false, etilismo: false,
    sedentarismo: false, iamPrevio: false, avcPrevio: false, doencaRenal: false, marcapasso: false,
    histFamiliarDac: false, histFamiliarMorteSubita: false,
  };
}
