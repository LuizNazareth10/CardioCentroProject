import { APARELHOS, CONVENIOS, EXAMES, MEDICOS } from '../seed-data';
import { criarAgendamentos, criarPaciente, listarAgendamentos, listarPacientes, registrarLeadWhatsapp, registrarMensagem } from '../db';
import { gerarSlots, gerarSlotsAparelho, proporSessao } from '../scheduling/engine';
import { fmtData, fmtDiaCurto, fmtHora } from '../format';
import { baixarMidia, enviarBotoes, enviarLista, enviarTexto } from './client';
import {
  mensagemAgendamentoCancelado,
  mensagemAgendamentoConfirmado,
  mensagemBoasVindasAgendamento,
  mensagemConfirmarPedidoMedico,
  mensagemConvenioNaoEncontrado,
  mensagemConvenioOutro,
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
  mensagemPedirNome,
  mensagemPreferenciaMedico,
  mensagemRecebendoPedido,
  mensagemResumoAgendamento,
  mensagemSemHorarios,
  mensagemSemMedicoUnico,
  mensagemTransferenciaHumana,
  mensagemUrgencia,
  montarOrientacoesExames,
} from './messages';
import { carregarSessao, limparSessao, salvarSessao, type ConversaState } from './session';
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

export async function processarMensagem(from: string, e: Entrada): Promise<void> {
  const s = await carregarSessao(from);

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

  // (2) chegada pelo deep link ("olá, gostaria de agendar um exame") → já inicia o fluxo
  if (
    /gostaria de agendar|quero agendar|agendar (um )?exame|marcar (um )?exame/.test(vlow) &&
    (s.etapa === 'inicio' || s.etapa === 'menu')
  ) {
    s.etapa = 'escolhendo_exames'; s.examesSelecionados = []; await salvarSessao(from, s);
    await enviarTexto(from, mensagemBoasVindasAgendamento());
    return enviarListaExames(from);
  }

  // comandos globais
  if (['menu', 'oi', 'olá', 'ola', 'início', 'inicio', 'começar', 'comecar'].includes(vlow)) {
    s.etapa = 'menu'; s.examesSelecionados = []; s.medicoPreferidoId = undefined;
    s.opcoes = undefined; s.propostas = undefined; s.aguardandoConvenio = undefined;
  }

  switch (s.etapa) {
    case 'inicio':
    case 'menu':
      if (e.valor === 'agendar') {
        s.etapa = 'escolhendo_exames'; await salvarSessao(from, s);
        return enviarListaExames(from);
      }
      if (e.valor === 'falar_humano') return falarComHumano(from);
      // confirmação dos exames lidos de um pedido médico (imagem)
      if (e.valor === 'img_sim' && s.examesSelecionados.length) {
        s.etapa = 'escolhendo_medico'; await salvarSessao(from, s);
        return enviarBotoes(from, mensagemConfirmarPedidoMedico(), [
          { id: 'med_qualquer', titulo: 'Sem preferência' },
          { id: 'med_escolher', titulo: 'Escolher médico' },
        ]);
      }
      if (e.valor === 'img_nao') { s.examesSelecionados = []; return menuPrincipal(from, s); }
      if (e.valor.startsWith('ex:')) { s.etapa = 'escolhendo_exames'; return tratarExames(from, s, e); }
      // texto livre no menu → IA
      if (e.tipo === 'texto' && !['menu', 'oi', 'olá', 'ola'].includes(vlow)) return rotearIA(from, s, e.valor);
      return menuPrincipal(from, s);

    case 'escolhendo_exames':
      return tratarExames(from, s, e);

    case 'escolhendo_medico':
      return tratarMedico(from, s, e);

    case 'escolhendo_horario':
      return tratarHorario(from, s, e);

    case 'identificacao':
      return tratarIdentificacao(from, s, e);

    case 'confirmando':
      return tratarConfirmacao(from, s, e);

    default:
      return menuPrincipal(from, s);
  }
}

// -------- MENU --------
async function menuPrincipal(from: string, s: ConversaState) {
  s.etapa = 'menu'; await salvarSessao(from, s);
  await enviarBotoes(
    from,
    mensagemMenuPrincipal(),
    [
      { id: 'agendar', titulo: 'Agendar exame' },
      { id: 'falar_humano', titulo: 'Falar c/ atendente' },
    ],
  );
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
      ]);
    }
  }

  if (e.valor === 'concluir_exames') {
    if (s.examesSelecionados.length === 0) return enviarListaExames(from);
    // exame de aparelho (Mapa/Holter) não escolhe médico — vai direto p/ horário
    const temAparelho = s.examesSelecionados.some((id) => EXAMES.find((x) => x.id === id)?.aparelho);
    if (temAparelho) { s.medicoPreferidoId = undefined; return calcularEoferecer(from, s); }
    s.etapa = 'escolhendo_medico'; await salvarSessao(from, s);
    return enviarBotoes(from, mensagemPreferenciaMedico(), [
      { id: 'med_qualquer', titulo: 'Sem preferência' },
      { id: 'med_escolher', titulo: 'Escolher médico' },
    ]);
  }

  // texto livre → IA
  return rotearIA(from, s, e.valor);
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

async function calcularEoferecer(from: string, s: ConversaState) {
  const examesSeq = s.examesSelecionados.map((id) => EXAMES.find((x) => x.id === id)!).filter(Boolean);
  const agendamentos = await listarAgendamentos();
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
      const sub = p.mesmoMedico ? `${examesSeq.length} exames · ${nomeMedico(p.itens[0].medicoId)}` : `${examesSeq.length} exames · médicos diferentes`;
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
  ]);
}

/** lista os dias que têm vaga, para o paciente escolher um específico */
async function mostrarDatasDisponiveis(from: string, s: ConversaState) {
  const props = s.propostas ?? [];
  const porDia = new Map<string, number>();
  for (const p of props) porDia.set(p.data, (porDia.get(p.data) ?? 0) + 1);
  const itens = [...porDia.entries()].slice(0, 10).map(([data, n]) => ({
    id: `data:${data}`,
    titulo: fmtDiaCurto(data),
    descricao: `${n} horário${n > 1 ? 's' : ''} disponíve${n > 1 ? 'is' : 'l'}`,
  }));
  await enviarLista(from, mensagemEscolherDia(), 'Ver dias', [
    { titulo: 'Dias disponíveis', itens },
  ]);
}

/** mostra os horários de um dia específico escolhido pelo paciente */
async function mostrarHorariosDoDia(from: string, s: ConversaState, data: string) {
  const props = s.propostas ?? [];
  const itens: Array<{ id: string; titulo: string; descricao?: string }> = [];
  for (let i = 0; i < props.length && itens.length < 9; i++) {
    if (props[i].data !== data) continue;
    itens.push({ id: `slot:${i}`, titulo: fmtHora(props[i].inicio), descricao: props[i].subtitulo });
  }
  if (itens.length === 0) return mostrarDatasDisponiveis(from, s);
  itens.push({ id: 'mais_datas', titulo: '📅 Ver outros dias', descricao: 'Voltar para a lista de datas' });
  await enviarLista(from, mensagemHorariosDoDia(fmtDiaCurto(data)), 'Ver horários', [
    { titulo: 'Horários', itens },
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
    s.convenioId = e.valor.slice(5); s.aguardandoConvenio = false; await salvarSessao(from, s);
    return mostrarConfirmacao(from, s);
  }
  // texto livre: tenta casar com um convênio da lista completa
  const c = acharConvenio(e.valor);
  if (c) {
    s.convenioId = c.id; s.aguardandoConvenio = false; await salvarSessao(from, s);
    return mostrarConfirmacao(from, s);
  }
  if (s.aguardandoConvenio) {
    return enviarTexto(from, mensagemConvenioNaoEncontrado(e.valor));
  }
  // não estava esperando texto de convênio → reapresenta a lista
  return pedirConvenioOuConfirmar(from, s);
}

async function pedirConvenioOuConfirmar(from: string, s: ConversaState) {
  if (s.convenioId) return mostrarConfirmacao(from, s);
  const populares = CONVENIOS_POPULARES
    .map((nome) => CONVENIOS.find((c) => c.nome === nome))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const itens: Array<{ id: string; titulo: string; descricao?: string }> = populares.map((c) => ({ id: `conv:${c.id}`, titulo: c.nome }));
  itens.push({ id: 'conv_outro', titulo: 'Outro convênio', descricao: 'Não está na lista? Digite o nome' });
  return enviarLista(from, mensagemPedirConvenio(s.nome?.split(' ')[0] ?? ''), 'Ver convênios', [
    { titulo: 'Convênios', itens },
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
  const linhas = escolhida.itens.map((i) => {
    const med = MEDICOS.find((m) => m.id === i.medicoId); // aparelhos (mapa/holter) não são médicos
    const quem = med ? ` (${med.nome})` : '';
    return `• ${nomeExame(i.exameId)} — ${fmtData(i.inicio)} ${fmtHora(i.inicio)}${quem}`;
  }).join('\n');
  const conv = CONVENIOS.find((c) => c.id === s.convenioId)?.nome ?? 'Particular';
  await enviarBotoes(
    from,
    mensagemResumoAgendamento(s.nome ?? '', conv, linhas),
    [{ id: 'confirmar_sim', titulo: 'Confirmar ✅' }, { id: 'confirmar_nao', titulo: 'Cancelar' }],
  );
}

async function tratarConfirmacao(from: string, s: ConversaState, e: Entrada) {
  if (e.valor === 'confirmar_nao' || /n[ãa]o|cancel/i.test(e.valor)) {
    await limparSessao(from);
    return enviarTexto(from, mensagemAgendamentoCancelado());
  }
  if (e.valor === 'confirmar_sim' || /sim|confirm/i.test(e.valor)) {
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
    // revalida conflito e grava
    const existentes = await listarAgendamentos();
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
  return mostrarConfirmacao(from, s);
}

// -------- IA / utilidades --------
async function rotearIA(from: string, s: ConversaState, texto: string) {
  const intent = await interpretar(texto);
  // urgência médica: orienta a procurar emergência AGORA e transfere p/ humano
  if (intent.acao === 'urgencia') {
    await enviarTexto(from, mensagemUrgencia());
    return falarComHumano(from);
  }
  if (intent.acao === 'humano') return falarComHumano(from);
  if (intent.acao === 'menu') { s.etapa = 'menu'; return menuPrincipal(from, s); }
  if (intent.acao === 'duvida') {
    await enviarTexto(from, intent.resposta ?? 'Posso te ajudar a agendar um exame. Quer ver as opções?');
    return menuPrincipal(from, s);
  }
  // agendar: já traz exames (ignora repetidos — não faz sentido o mesmo exame 2x na sessão)
  if (intent.exames.length) {
    const novos = intent.exames.filter((id) => !s.examesSelecionados.includes(id));
    s.examesSelecionados.push(...new Set(novos));
    s.etapa = 'escolhendo_medico'; await salvarSessao(from, s);
    const lista = s.examesSelecionados.map((x, i) => `${i + 1}. ${nomeExame(x)}`).join('\n');
    await enviarTexto(from, mensagemExamesEntendidos(lista));
    return enviarBotoes(from, mensagemPreferenciaMedico(), [
      { id: 'med_qualquer', titulo: 'Sem preferência' },
      { id: 'med_escolher', titulo: 'Escolher médico' },
    ]);
  }
  s.etapa = 'escolhendo_exames'; await salvarSessao(from, s);
  return enviarListaExames(from);
}

async function falarComHumano(from: string) {
  const s = await carregarSessao(from);
  s.etapa = 'humano'; await salvarSessao(from, s);
  // coloca a conversa na fila de atendimento humano (painel /atendimentos)
  await registrarMensagem(
    from,
    { de: 'agente', texto: 'Paciente solicitou falar com um atendente.', ts: new Date().toISOString() },
    { nome: s.nome, status: 'aguardando' },
  );
  // lead MORNO: demonstrou interesse mas foi para atendimento humano
  try {
    await registrarLeadWhatsapp(from, { nome: s.nome, temperatura: 'morno' });
  } catch (err) {
    console.error('[agente] falha ao registrar lead morno:', err);
  }
  await enviarTexto(from, mensagemTransferenciaHumana());
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
  ]);
}

async function acharPacientePorTelefone(from: string) {
  const digitos = from.replace(/\D/g, '').slice(-8);
  const todos = await listarPacientes();
  return todos.find((p) => p.telefone.replace(/\D/g, '').includes(digitos)) ?? null;
}

function fichaVazia() {
  return {
    hipertensao: false, diabetes: false, dislipidemia: false, tabagismo: false, etilismo: false,
    sedentarismo: false, iamPrevio: false, avcPrevio: false, doencaRenal: false, marcapasso: false,
    histFamiliarDac: false, histFamiliarMorteSubita: false,
  };
}
