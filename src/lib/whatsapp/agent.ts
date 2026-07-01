import { APARELHOS, CONVENIOS, CONTATO, EXAMES, MEDICOS } from '../seed-data';
import { criarAgendamentos, criarPaciente, listarAgendamentos, listarPacientes, registrarMensagem } from '../db';
import { gerarSlots, gerarSlotsAparelho, proporSessao } from '../scheduling/engine';
import { fmtData, fmtHora } from '../format';
import { baixarMidia, enviarBotoes, enviarLista, enviarTexto } from './client';
import { getSessao, limparSessao, salvarSessao } from './session';
import { interpretar, lerPedidoMedico } from './ai';

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
const nomeExame = (id: string) => EXAMES.find((e) => e.id === id)?.nome ?? id;
const nomeMedico = (id: string) => MEDICOS.find((m) => m.id === id)?.nome ?? id;

export async function processarMensagem(from: string, e: Entrada): Promise<void> {
  const s = getSessao(from);

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
    s.etapa = 'escolhendo_exames'; s.examesSelecionados = []; salvarSessao(from, s);
    await enviarTexto(from, `Olá! 👋 Bem-vindo(a) à *${CONTATO.nomeClinica}*. Vou te ajudar a agendar seu exame agora mesmo.`);
    return enviarListaExames(from);
  }

  // comandos globais
  if (['menu', 'oi', 'olá', 'ola', 'início', 'inicio', 'começar', 'comecar'].includes(vlow)) {
    s.etapa = 'menu'; s.examesSelecionados = []; s.medicoPreferidoId = undefined; s.opcoes = undefined;
  }

  switch (s.etapa) {
    case 'inicio':
    case 'menu':
      if (e.valor === 'agendar') {
        s.etapa = 'escolhendo_exames'; salvarSessao(from, s);
        return enviarListaExames(from);
      }
      if (e.valor === 'falar_humano') return falarComHumano(from);
      // confirmação dos exames lidos de um pedido médico (imagem)
      if (e.valor === 'img_sim' && s.examesSelecionados.length) {
        s.etapa = 'escolhendo_medico'; salvarSessao(from, s);
        return enviarBotoes(from, 'Perfeito! Tem preferência de médico?', [
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
async function menuPrincipal(from: string, s: ReturnType<typeof getSessao>) {
  s.etapa = 'menu'; salvarSessao(from, s);
  await enviarBotoes(
    from,
    `Olá! 👋 Aqui é a *${CONTATO.nomeClinica}* — ${CONTATO.subtitulo}.\nComo posso ajudar?`,
    [
      { id: 'agendar', titulo: 'Agendar exame' },
      { id: 'falar_humano', titulo: 'Falar c/ atendente' },
    ],
  );
}

// -------- EXAMES --------
async function enviarListaExames(from: string) {
  await enviarLista(from, 'Quais exames você quer marcar? Selecione um por vez.', 'Ver exames', [
    { titulo: 'Exames', itens: EXAMES.filter((e) => e.ativo).map((e) => ({ id: `ex:${e.id}`, titulo: e.nome, descricao: `${e.duracaoMin} min` })) },
  ]);
}

async function tratarExames(from: string, s: ReturnType<typeof getSessao>, e: Entrada) {
  if (e.valor === 'agendar' || e.valor === 'add_exame') return enviarListaExames(from);

  if (e.valor.startsWith('ex:')) {
    const id = e.valor.slice(3);
    if (EXAMES.some((x) => x.id === id)) {
      s.examesSelecionados.push(id);
      salvarSessao(from, s);
      const lista = s.examesSelecionados.map((x, i) => `${i + 1}. ${nomeExame(x)}`).join('\n');
      return enviarBotoes(from, `Adicionado ✅\n\n*Sua seleção:*\n${lista}\n\nDeseja adicionar mais um exame?`, [
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
    s.etapa = 'escolhendo_medico'; salvarSessao(from, s);
    return enviarBotoes(from, 'Você tem preferência de médico?', [
      { id: 'med_qualquer', titulo: 'Sem preferência' },
      { id: 'med_escolher', titulo: 'Escolher médico' },
    ]);
  }

  // texto livre → IA
  return rotearIA(from, s, e.valor);
}

// -------- MÉDICO --------
async function tratarMedico(from: string, s: ReturnType<typeof getSessao>, e: Entrada) {
  if (e.valor === 'med_qualquer') {
    s.medicoPreferidoId = undefined;
    return calcularEoferecer(from, s);
  }
  if (e.valor === 'med_escolher') {
    const habilitados = MEDICOS.filter(
      (m) => m.ativo && s.examesSelecionados.every((ex) => m.examesHabilitados.includes(ex)),
    );
    if (habilitados.length === 0) {
      await enviarTexto(from, 'Para essa combinação de exames não há um único médico que faça todos. Vou buscar a melhor combinação. 👍');
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
async function calcularEoferecer(from: string, s: ReturnType<typeof getSessao>) {
  const examesSeq = s.examesSelecionados.map((id) => EXAMES.find((x) => x.id === id)!).filter(Boolean);
  const agendamentos = await listarAgendamentos();
  const opcoes: NonNullable<typeof s.opcoes> = [];

  if (examesSeq.length === 1 && examesSeq[0].aparelho) {
    // exame de aparelho (Mapa/Holter): slots fixos, sexta bloqueada
    const cfg = APARELHOS[examesSeq[0].aparelho];
    const slots = gerarSlotsAparelho(cfg, agendamentos, {
      dataInicio: hojeJF(), dias: 21, naoAntesDe: agoraJF(), limite: 3,
    });
    slots.forEach((sl) => opcoes.push({
      rotulo: `${fmtData(sl.inicio)} ${fmtHora(sl.inicio)} — ${cfg.nome}`,
      itens: [{ exameId: examesSeq[0].id, medicoId: sl.medicoId, inicio: sl.inicio, fim: sl.fim }],
    }));
  } else if (examesSeq.length === 1) {
    const slots = gerarSlots(examesSeq[0], MEDICOS, agendamentos, {
      dataInicio: hojeJF(), dias: 14, medicoPreferidoId: s.medicoPreferidoId, naoAntesDe: agoraJF(), limite: 3,
    });
    slots.forEach((sl) => opcoes.push({
      rotulo: `${fmtData(sl.inicio)} ${fmtHora(sl.inicio)} — ${sl.medicoNome}`,
      itens: [{ exameId: examesSeq[0].id, medicoId: sl.medicoId, inicio: sl.inicio, fim: sl.fim }],
    }));
  } else {
    // tenta 3 dias com proposta de sessão consecutiva (mesmo médico de preferência)
    let dataBusca = hojeJF();
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const p = proporSessao(examesSeq, MEDICOS, agendamentos, {
        dataInicio: dataBusca, dias: 14, medicoPreferidoId: s.medicoPreferidoId, naoAntesDe: agoraJF(),
      });
      if (!p) break;
      const ini = p.itens[0].inicio;
      const flag = p.mesmoMedico ? ` (mesmo médico: ${nomeMedico(p.itens[0].medicoId)})` : ' (médicos diferentes)';
      opcoes.push({
        rotulo: `${fmtData(ini)} ${fmtHora(ini)}${flag}`,
        itens: p.itens.map((i) => ({ exameId: i.exameId, medicoId: i.medicoId, inicio: i.inicio, fim: i.fim })),
      });
      // próxima busca começa no dia seguinte ao encontrado
      const d = new Date(`${ini.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
      dataBusca = d.toISOString().slice(0, 10);
    }
  }

  if (opcoes.length === 0) {
    await enviarTexto(from, 'No momento não encontrei horários livres para essa combinação nos próximos dias. 😕\nPosso te transferir para um atendente? Responda *atendente*.');
    return;
  }

  s.opcoes = opcoes; s.etapa = 'escolhendo_horario'; salvarSessao(from, s);
  await enviarLista(from, 'Encontrei estes horários. Qual prefere?', 'Ver horários', [
    { titulo: 'Horários disponíveis', itens: opcoes.map((o, i) => ({ id: `slot:${i}`, titulo: o.rotulo.slice(0, 24), descricao: o.rotulo })) },
  ]);
}

async function tratarHorario(from: string, s: ReturnType<typeof getSessao>, e: Entrada) {
  if (e.valor.startsWith('slot:')) {
    const idx = Number(e.valor.slice(5));
    if (s.opcoes?.[idx]) {
      s.opcoes = [s.opcoes[idx]]; // mantém apenas a opção escolhida
      s.etapa = 'identificacao'; salvarSessao(from, s);
      // tenta achar paciente pelo telefone
      const pac = await acharPacientePorTelefone(from);
      if (pac) {
        s.nome = pac.nome; s.pacienteId = pac.id; s.convenioId = pac.convenioId; salvarSessao(from, s);
        return pedirConvenioOuConfirmar(from, s);
      }
      return enviarTexto(from, 'Quase lá! Qual é o seu *nome completo*?');
    }
  }
  return rotearIA(from, s, e.valor);
}

// -------- IDENTIFICAÇÃO --------
async function tratarIdentificacao(from: string, s: ReturnType<typeof getSessao>, e: Entrada) {
  if (!s.nome) {
    s.nome = e.valor; salvarSessao(from, s);
    return pedirConvenioOuConfirmar(from, s);
  }
  if (e.valor.startsWith('conv:')) {
    s.convenioId = e.valor.slice(5); salvarSessao(from, s);
    return mostrarConfirmacao(from, s);
  }
  return pedirConvenioOuConfirmar(from, s);
}

async function pedirConvenioOuConfirmar(from: string, s: ReturnType<typeof getSessao>) {
  if (s.convenioId) return mostrarConfirmacao(from, s);
  const principais = ['particular', ...CONVENIOS.filter((c) => c.nome !== 'Particular').slice(0, 9).map((c) => c.id)];
  return enviarLista(from, `Obrigada, ${s.nome?.split(' ')[0]}! Qual o seu convênio?`, 'Ver convênios', [
    { titulo: 'Convênios', itens: principais.map((id) => ({ id: `conv:${id}`, titulo: CONVENIOS.find((c) => c.id === id)?.nome ?? id })) },
  ]);
}

// -------- CONFIRMAÇÃO --------
async function mostrarConfirmacao(from: string, s: ReturnType<typeof getSessao>) {
  s.etapa = 'confirmando'; salvarSessao(from, s);
  const escolhida = s.opcoes![0]; // já reduzida à opção escolhida
  const linhas = escolhida.itens.map((i) => `• ${nomeExame(i.exameId)} — ${fmtData(i.inicio)} ${fmtHora(i.inicio)} (${nomeMedico(i.medicoId)})`).join('\n');
  const conv = CONVENIOS.find((c) => c.id === s.convenioId)?.nome ?? 'Particular';
  await enviarBotoes(
    from,
    `Confirme seu agendamento:\n\n*Paciente:* ${s.nome}\n*Convênio:* ${conv}\n${linhas}`,
    [{ id: 'confirmar_sim', titulo: 'Confirmar ✅' }, { id: 'confirmar_nao', titulo: 'Cancelar' }],
  );
}

async function tratarConfirmacao(from: string, s: ReturnType<typeof getSessao>, e: Entrada) {
  if (e.valor === 'confirmar_nao' || /n[ãa]o|cancel/i.test(e.valor)) {
    limparSessao(from);
    return enviarTexto(from, 'Sem problemas, cancelei. Quando quiser, é só mandar *oi* que recomeçamos. 💙');
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
      s.etapa = 'escolhendo_medico'; salvarSessao(from, s);
      await enviarTexto(from, 'Ops, esse horário acabou de ser preenchido. Vou buscar outras opções…');
      return calcularEoferecer(from, s);
    }
    await criarAgendamentos(escolhida.itens.map((i) => ({
      pacienteId: pacienteId!, pacienteNome: s.nome ?? 'Paciente WhatsApp',
      medicoId: i.medicoId, exameId: i.exameId, convenioId: s.convenioId ?? 'particular',
      inicio: i.inicio, fim: i.fim, status: 'agendado', origem: 'whatsapp',
    })));
    const primeiro = escolhida.itens[0];
    limparSessao(from);
    return enviarTexto(
      from,
      `Tudo certo, ${s.nome?.split(' ')[0]}! 🎉 Seu agendamento está confirmado para *${fmtData(primeiro.inicio)} às ${fmtHora(primeiro.inicio)}*.\n\nEndereço e dúvidas: ${CONTATO.telefoneFixo}.\nAté lá! 💙`,
    );
  }
  return mostrarConfirmacao(from, s);
}

// -------- IA / utilidades --------
async function rotearIA(from: string, s: ReturnType<typeof getSessao>, texto: string) {
  const intent = await interpretar(texto);
  if (intent.acao === 'humano') return falarComHumano(from);
  if (intent.acao === 'menu') { s.etapa = 'menu'; return menuPrincipal(from, s); }
  if (intent.acao === 'duvida') {
    await enviarTexto(from, intent.resposta ?? 'Posso te ajudar a agendar um exame. Quer ver as opções?');
    return menuPrincipal(from, s);
  }
  // agendar: já traz exames
  if (intent.exames.length) {
    s.examesSelecionados.push(...intent.exames);
    s.etapa = 'escolhendo_medico'; salvarSessao(from, s);
    const lista = s.examesSelecionados.map((x, i) => `${i + 1}. ${nomeExame(x)}`).join('\n');
    await enviarTexto(from, `Perfeito! Entendi que você quer:\n${lista}`);
    return enviarBotoes(from, 'Tem preferência de médico?', [
      { id: 'med_qualquer', titulo: 'Sem preferência' },
      { id: 'med_escolher', titulo: 'Escolher médico' },
    ]);
  }
  s.etapa = 'escolhendo_exames'; salvarSessao(from, s);
  return enviarListaExames(from);
}

async function falarComHumano(from: string) {
  const s = getSessao(from);
  s.etapa = 'humano'; salvarSessao(from, s);
  // coloca a conversa na fila de atendimento humano (painel /atendimentos)
  await registrarMensagem(
    from,
    { de: 'agente', texto: 'Paciente solicitou falar com um atendente.', ts: new Date().toISOString() },
    { nome: s.nome, status: 'aguardando' },
  );
  await enviarTexto(
    from,
    `Tudo bem! 💙 Vou te transferir para a nossa recepção. Em instantes alguém do time assume por aqui.\n\nSe preferir, ligue para *${CONTATO.telefone}*.`,
  );
}

// -------- IMAGEM (pedido médico) --------
async function tratarImagem(from: string, s: ReturnType<typeof getSessao>, e: Entrada) {
  // durante handoff, a foto também é só registrada para a recepção
  if (s.etapa === 'humano') {
    await registrarMensagem(
      from,
      { de: 'paciente', texto: '📷 (enviou uma imagem)', ts: new Date().toISOString() },
      { nome: s.nome, status: 'aguardando' },
    );
    return;
  }

  await enviarTexto(from, 'Recebi seu pedido médico 📄. Deixa eu dar uma olhada…');
  const midia = await baixarMidia(e.valor);
  if (!midia) {
    return enviarTexto(from, 'Não consegui abrir a imagem agora. 😕 Você pode me dizer quais exames deseja agendar, ou responder *menu* para ver as opções.');
  }
  const ids = await lerPedidoMedico(midia.base64, midia.mime);
  if (ids.length === 0) {
    return enviarTexto(from, 'Não consegui identificar os exames na imagem. Pode digitar os exames desejados ou responder *menu* para ver a lista.');
  }
  s.examesSelecionados = ids; s.etapa = 'menu'; salvarSessao(from, s);
  const lista = ids.map((id, i) => `${i + 1}. ${nomeExame(id)}`).join('\n');
  return enviarBotoes(from, `Identifiquei os seguintes exames no seu pedido:\n${lista}\n\nPosso agendar esses exames para você?`, [
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
