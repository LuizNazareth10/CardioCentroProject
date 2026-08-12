import { CONTATO, CONVENIOS, EXAMES, MEDICOS, RESUMO_COMBINACOES, RESUMO_PLANOS_NAO_ATENDIDOS } from '../seed-data';
import { mensagemDuvidaFallback } from './messages';

// =============================================================
// Camada de IA (modo híbrido). Só é acionada quando o paciente
// escreve em texto livre — os menus/botões resolvem o caminho comum.
// Usa a API da Anthropic para extrair intenção e mapear exames.
// Se ANTHROPIC_API_KEY não estiver configurada, faz um fallback
// simples por palavras-chave.
// =============================================================

export interface Intencao {
  acao: 'agendar' | 'remarcar' | 'menu' | 'humano' | 'duvida' | 'urgencia';
  exames: string[]; // ids de EXAMES
  medicoMencionado?: string;
  resposta?: string; // resposta livre para "duvida"
}

export interface ContextoInterpretacao {
  /**
   * ids de EXAMES já marcados/escolhidos NESTA conversa (agendamento futuro
   * do paciente, ou seleção em andamento na sessão) — sem isso, uma pergunta
   * como "precisa de preparo?" cai sem saber a qual exame se refere, e a IA
   * ou responde de forma genérica ou pergunta de volta "qual exame?", mesmo
   * quando já dá pra saber pelo contexto da conversa.
   */
  exameIds?: string[];
}

// -------------------------------------------------------------
// Chamada à API da Anthropic com timeout e retry.
//
// Sem timeout, um pedido pendurado consome o maxDuration=60s do webhook e a
// Evolution retransmite a mensagem. Sem checar `res.ok`, um 429 vira um JSON
// inválido que cai no catch — e o paciente recebe o fallback por palavras-chave
// sem que nada apareça como erro.
//
// Orçamento: 2 tentativas × 15s + backoff ≈ 31s no pior caso, deixando folga
// dentro dos 60s do webhook para o envio da resposta.
// -------------------------------------------------------------
const TENTATIVAS = 2;

async function chamarAnthropic(
  key: string,
  corpo: Record<string, unknown>,
  rotulo: string,
  timeoutMs = 15_000,
): Promise<string | null> {
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const ultima = tentativa === TENTATIVAS;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        const data = (await res.json()) as { content?: Array<{ text?: string }> };
        return (data.content ?? []).map((c) => c.text ?? '').join('').trim();
      }

      // 429 (limite) e 5xx (indisponibilidade) passam; 4xx restante não melhora
      // com repetição — chave inválida ou payload malformado.
      const transitorio = res.status === 429 || res.status >= 500;
      console.error(`[agente:${rotulo}] HTTP ${res.status} (tentativa ${tentativa}/${TENTATIVAS})`);
      if (!transitorio || ultima) return null;
    } catch (e) {
      const motivo = e instanceof Error && e.name === 'TimeoutError' ? `timeout após ${timeoutMs}ms` : e;
      console.error(`[agente:${rotulo}] falha de rede (tentativa ${tentativa}/${TENTATIVAS}):`, motivo);
      if (ultima) return null;
    }
    await new Promise((r) => setTimeout(r, 400 * tentativa));
  }
  return null;
}

/** Extrai o JSON de uma resposta que pode vir cercada por cerca de código. */
function parseJson<T>(bruto: string, rotulo: string): T | null {
  try {
    return JSON.parse(bruto.replace(/```json|```/g, '').trim()) as T;
  } catch {
    console.error(`[agente:${rotulo}] resposta não era JSON válido:`, bruto.slice(0, 200));
    return null;
  }
}

const listaExames = EXAMES.map((e) => `${e.id}: ${e.nome}${e.preparo ? ` (preparo: ${e.preparo})` : ''}`).join('\n');
const listaMedicos = MEDICOS.filter((m) => m.ativo)
  .map((m) => `- ${m.nome}${m.especialidade ? ` — ${m.especialidade}` : ''}`)
  .join('\n');
const listaConvenios = CONVENIOS.filter((c) => c.ativo).map((c) => c.nome).join(', ');

export async function interpretar(texto: string, contexto?: ContextoInterpretacao): Promise<Intencao> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallbackPorPalavras(texto);

  const nomesContexto = contexto?.exameIds
    ?.map((id) => EXAMES.find((e) => e.id === id)?.nome)
    .filter((n): n is string => Boolean(n));
  const blocoContexto = nomesContexto?.length
    ? `\n# Contexto desta conversa\nEste paciente JÁ TEM marcado (ou está escolhendo agora): ${nomesContexto.join(', ')}. Se ele perguntar sobre preparo, jejum, horário de chegada ou documentos SEM dizer qual exame, responda com base NESSES exames — não pergunte "qual exame" de novo.\n`
    : '';

  const system = `Você é a assistente virtual da ${CONTATO.nomeClinica} — ${CONTATO.subtitulo}, clínica de cardiologia em Juiz de Fora, MG.
Tom: profissional, acolhedor e objetivo. Nunca robótico ou burocrático. Emojis com moderação. Não use nome próprio para si (não se apresente como "Cardi" nem outro nome).

# Contexto da clínica
- Endereço: ${CONTATO.enderecoCompleto}.
- Horário: segunda a quinta 08h–18h, sexta 08h–17h. Fechado aos fins de semana.
- Telefone fixo (cancelamento/laudos): ${CONTATO.telefoneFixo}. Cancelamento é feito por telefone.
- REMARCAÇÃO você resolve aqui mesmo: se o paciente quiser trocar o horário de um exame já marcado, classifique como "remarcar".
- Convênios aceitos: ${listaConvenios}. Também atende particular.
- ATENÇÃO — planos NÃO atendidos dentro de convênios aceitos: ${RESUMO_PLANOS_NAO_ATENDIDOS}. Se o paciente citar um desses planos, seja claro que não atendemos aquele plano específico e classifique como "humano".
- No dia do exame é OBRIGATÓRIO trazer o pedido médico (papel ou digital), documento com foto e carteirinha do convênio.
- Prazo de laudo: varia por exame; a equipe informa no dia do atendimento (NUNCA prometa prazo específico).

# Exames disponíveis (id: nome)
${listaExames}

# Médicos
${listaMedicos}
(Mapa 24h e Holter 24h são exames de aparelho, sem escolha de médico.)

# Exames feitos na mesma sessão
${RESUMO_COMBINACOES}
Se o paciente pedir esses exames juntos, eles ocupam UM só horário — o sistema já marca assim. Nunca diga que ele precisa vir duas vezes nem reservar dois horários.
${blocoContexto}
# Regras de segurança (OBRIGATÓRIAS)
1. Você NÃO é médica: nunca dê diagnóstico, interprete sintomas/exames nem recomende/ajuste medicação. Dúvida clínica → orientar consulta com cardiologista.
2. URGÊNCIA: se o paciente relatar sintomas agudos AGORA (dor no peito, falta de ar intensa, desmaio, palpitações fortes com mal-estar, suspeita de infarto/AVC), classifique como "urgencia" — nunca tente agendar nesse caso.
3. Escale para humano ("humano"): reclamações, reembolso/pagamento, situações delicadas ou qualquer coisa que exija julgamento humano.
4. Se o paciente demonstrar medo ou ansiedade, acolha com empatia ANTES de falar de agendamento.
5. Não invente informações (preços, prazos, promoções). O que não souber → "humano".

# Como ler o pedido de exames (CRÍTICO)
O paciente quase nunca usa o nome oficial. Alguns apelidos comuns:
- "eco", "ecocardio", "eco do coração", "ecocardiograma transtorácico" → eco-doppler
- "doppler de carótidas", "duplex de carótidas", "carótidas e vertebrais", "dopplerzinho do pescoço" → duplex-carotidas
- "esteira", "teste de esforço", "ergométrico" → ergometrico
- "teste do sopro"/"ergoespirometria"/"cardiopulmonar" → cardiopulmonar
- "holter", "aparelho do coração 24h" → holter
- "mapa", "aparelho de pressão 24h" → mapa
REGRA: liste em "exames" TODOS os exames citados na mensagem, não só o primeiro.
Uma frase pode pedir vários de uma vez ("eco e duplex de carótidas e vertebrais"
são DOIS exames: eco-doppler e duplex-carotidas). Se o paciente já tinha pedido
um exame antes e agora cita outros, devolva a lista COMPLETA do que ele quer.
Na dúvida entre incluir ou não um exame citado, INCLUA — a confirmação é feita
depois com ele.

Responda SOMENTE com um JSON válido, sem texto fora dele, no formato:
{"acao":"agendar|remarcar|menu|humano|duvida|urgencia","exames":["id",...],"medicoMencionado":"...|null","resposta":"texto curto se acao=duvida, senão null"}
- "agendar": paciente quer marcar um ou mais exames (preencha "exames" com TODOS os ids citados).
- "remarcar": paciente quer MUDAR o horário de um exame que já está marcado ("preciso adiar", "posso trocar o dia?", "não vou conseguir nesse horário").
- "menu": paciente quer ver as opções/voltar ao início.
- "humano": paciente quer falar com uma pessoa OU caso das regras 3/5.
- "urgencia": sintomas agudos acontecendo agora (regra 2).
- "duvida": pergunta geral (responda em "resposta", curto, gentil e acolhedor; use o bloco "Contexto desta conversa" quando existir para responder sobre o exame específico do paciente, e convide a agendar quando fizer sentido).`;

  const bruto = await chamarAnthropic(key, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: texto }],
  }, 'ia');

  if (bruto === null) return fallbackPorPalavras(texto);

  const parsed = parseJson<Intencao>(bruto, 'ia');
  if (!parsed) return fallbackPorPalavras(texto);

  parsed.exames = (parsed.exames ?? []).filter((id) => EXAMES.some((e) => e.id === id));
  return parsed;
}

/**
 * Lê a foto de um pedido médico (Claude Vision) e retorna os IDs de EXAMES
 * identificados. Sem ANTHROPIC_API_KEY, retorna [] (sem OCR).
 */
export async function lerPedidoMedico(base64: string, mime: string): Promise<string[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return [];

  const nomes = EXAMES.map((e) => e.nome).join(', ');
  const prompt =
    'Este é um pedido médico de cardiologia. Identifique os exames solicitados. ' +
    `Considere apenas esta lista de exames disponíveis: ${nomes}. ` +
    'Responda SOMENTE com um JSON no formato {"exames":["nome exato da lista", ...]}, sem texto fora dele.';

  // Timeout maior que o de texto: a leitura de imagem é mais lenta. Ainda
  // cabe no maxDuration=60s do webhook (2 × 20s + backoff ≈ 41s).
  const bruto = await chamarAnthropic(key, {
    model: 'claude-sonnet-5', // modelo com visão, mais capaz p/ leitura de imagem
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  }, 'visão', 20_000);

  if (bruto === null) return [];

  const parsed = parseJson<{ exames?: string[] }>(bruto, 'visão');
  if (!parsed) return [];

  // mapeia nomes retornados -> ids de EXAMES (match aproximado)
  const ids = (parsed.exames ?? [])
    .map((nome) => {
      const alvo = nome.toLowerCase();
      const found = EXAMES.find(
        (e) => e.nome.toLowerCase().includes(alvo) || alvo.includes(e.nome.toLowerCase().split(' ')[0]),
      );
      return found?.id;
    })
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
}

/**
 * minúsculas SEM acento — "carótidas" e "carotidas" precisam casar igual.
 * O intervalo ̀-ͯ é o das marcas de acento que o NFD separa da letra.
 */
function semAcento(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Apelidos que o paciente usa de verdade no WhatsApp. Existe porque casar só
 * pelo nome oficial ("Duplex Scan de Carótidas e Vertebrais") deixa passar as
 * formas que ele realmente digita — e aí o pedido cai como texto solto.
 */
const APELIDOS_EXAME: Array<{ re: RegExp; id: string }> = [
  { re: /\becocardio|\beco\b|ecocardiograma|transtoracic/, id: 'eco-doppler' },
  { re: /carotida|duplex|vertebrai|doppler de pescoco/, id: 'duplex-carotidas' },
  { re: /ergometric|esteira|teste de esforco/, id: 'ergometrico' },
  { re: /cardiopulmonar|ergoespirometr/, id: 'cardiopulmonar' },
  { re: /holter/, id: 'holter' },
  { re: /\bmapa\b|press[ãa]o 24|pressao 24/, id: 'mapa' },
];

function fallbackPorPalavras(texto: string): Intencao {
  const t = semAcento(texto);
  // urgência tem prioridade máxima — sintomas agudos nunca viram agendamento
  if (/(dor no peito|dor forte no peito|infart|avc|derrame|desmai|falta de ar (forte|intensa)|n[ãa]o consigo respirar|socorro|emerg[êe]ncia)/.test(t)) {
    return { acao: 'urgencia', exames: [] };
  }
  if (/(atendente|humano|pessoa|recep)/.test(t)) return { acao: 'humano', exames: [] };
  // remarcar vem antes de "agendar": "quero trocar o horário do meu exame"
  // também casa com as palavras de agendamento
  if (/(remarc|reagend|adiar|antecipar|mudar (o )?(hor[áa]rio|dia|data)|trocar (o )?(hor[áa]rio|dia|data)|outro (hor[áa]rio|dia))/.test(t)) {
    return { acao: 'remarcar', exames: [] };
  }
  if (/(menu|opc|come|inicio|voltar)/.test(t)) return { acao: 'menu', exames: [] };
  // casa pelo nome oficial E pelos apelidos — e devolve TODOS os exames
  // citados na mesma frase ("eco e duplex de carotidas" são dois).
  const porNome = EXAMES.filter((e) => {
    const nome = semAcento(e.nome);
    return t.includes(e.id) || nome.split(/\s|\(|\)|\//).some((p) => p.length > 3 && t.includes(p));
  }).map((e) => e.id);
  const porApelido = APELIDOS_EXAME.filter((a) => a.re.test(t)).map((a) => a.id);
  const exames = [...new Set([...porNome, ...porApelido])].filter((id) => EXAMES.some((e) => e.id === id));
  if (exames.length) return { acao: 'agendar', exames };
  if (/(marca|agend|hor[áa]rio|consulta|exame)/.test(t)) return { acao: 'menu', exames: [] };
  return { acao: 'duvida', exames: [], resposta: mensagemDuvidaFallback() };
}
