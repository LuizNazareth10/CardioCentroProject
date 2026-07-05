import { CONTATO, CONVENIOS, EXAMES, MEDICOS } from '../seed-data';
import { mensagemDuvidaFallback } from './messages';

// =============================================================
// Camada de IA (modo híbrido). Só é acionada quando o paciente
// escreve em texto livre — os menus/botões resolvem o caminho comum.
// Usa a API da Anthropic para extrair intenção e mapear exames.
// Se ANTHROPIC_API_KEY não estiver configurada, faz um fallback
// simples por palavras-chave.
// =============================================================

export interface Intencao {
  acao: 'agendar' | 'menu' | 'humano' | 'duvida' | 'urgencia';
  exames: string[]; // ids de EXAMES
  medicoMencionado?: string;
  resposta?: string; // resposta livre para "duvida"
}

const listaExames = EXAMES.map((e) => `${e.id}: ${e.nome}${e.preparo ? ` (preparo: ${e.preparo})` : ''}`).join('\n');
const listaMedicos = MEDICOS.filter((m) => m.ativo)
  .map((m) => `- ${m.nome}${m.especialidade ? ` — ${m.especialidade}` : ''}`)
  .join('\n');
const listaConvenios = CONVENIOS.filter((c) => c.ativo).map((c) => c.nome).join(', ');

export async function interpretar(texto: string): Promise<Intencao> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallbackPorPalavras(texto);

  const system = `Você é a Cardi, assistente virtual da ${CONTATO.nomeClinica} — ${CONTATO.subtitulo}, clínica de cardiologia em Juiz de Fora, MG.
Tom: profissional, acolhedor e objetivo. Nunca robótico ou burocrático. Emojis com moderação.

# Contexto da clínica
- Endereço: ${CONTATO.enderecoCompleto}.
- Horário: segunda a quinta 08h–18h, sexta 08h–17h. Fechado aos fins de semana.
- Telefone fixo (cancelar/remarcar/laudos): ${CONTATO.telefoneFixo}. Cancelamento e remarcação são feitos SOMENTE por telefone.
- Convênios aceitos: ${listaConvenios}. Também atende particular.
- No dia do exame é OBRIGATÓRIO trazer o pedido médico (papel ou digital), documento com foto e carteirinha do convênio.
- Prazo de laudo: varia por exame; a equipe informa no dia do atendimento (NUNCA prometa prazo específico).

# Exames disponíveis (id: nome)
${listaExames}

# Médicos
${listaMedicos}
(Mapa 24h e Holter 24h são exames de aparelho, sem escolha de médico.)

# Regras de segurança (OBRIGATÓRIAS)
1. Você NÃO é médica: nunca dê diagnóstico, interprete sintomas/exames nem recomende/ajuste medicação. Dúvida clínica → orientar consulta com cardiologista.
2. URGÊNCIA: se o paciente relatar sintomas agudos AGORA (dor no peito, falta de ar intensa, desmaio, palpitações fortes com mal-estar, suspeita de infarto/AVC), classifique como "urgencia" — nunca tente agendar nesse caso.
3. Escale para humano ("humano"): reclamações, reembolso/pagamento, situações delicadas ou qualquer coisa que exija julgamento humano.
4. Se o paciente demonstrar medo ou ansiedade, acolha com empatia ANTES de falar de agendamento.
5. Não invente informações (preços, prazos, promoções). O que não souber → "humano".

Responda SOMENTE com um JSON válido, sem texto fora dele, no formato:
{"acao":"agendar|menu|humano|duvida|urgencia","exames":["id",...],"medicoMencionado":"...|null","resposta":"texto curto se acao=duvida, senão null"}
- "agendar": paciente quer marcar um ou mais exames (preencha "exames" com os ids).
- "menu": paciente quer ver as opções/voltar ao início.
- "humano": paciente quer falar com uma pessoa OU caso das regras 3/5.
- "urgencia": sintomas agudos acontecendo agora (regra 2).
- "duvida": pergunta geral (responda em "resposta", curto, gentil e acolhedor, e convide a agendar quando fizer sentido).`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: texto }],
      }),
    });
    const data = await res.json();
    const raw = (data.content ?? []).map((c: { text?: string }) => c.text ?? '').join('').trim();
    const limpo = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(limpo) as Intencao;
    parsed.exames = (parsed.exames ?? []).filter((id) => EXAMES.some((e) => e.id === id));
    return parsed;
  } catch (e) {
    console.error('[agente:ia] falha, usando fallback:', e);
    return fallbackPorPalavras(texto);
  }
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

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    });
    const data = await res.json();
    const raw = (data.content ?? []).map((c: { text?: string }) => c.text ?? '').join('').trim();
    const limpo = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(limpo) as { exames?: string[] };
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
  } catch (e) {
    console.error('[agente:visão] falha ao ler pedido médico:', e);
    return [];
  }
}

function fallbackPorPalavras(texto: string): Intencao {
  const t = texto.toLowerCase();
  // urgência tem prioridade máxima — sintomas agudos nunca viram agendamento
  if (/(dor no peito|dor forte no peito|infart|avc|derrame|desmai|falta de ar (forte|intensa)|n[ãa]o consigo respirar|socorro|emerg[êe]ncia)/.test(t)) {
    return { acao: 'urgencia', exames: [] };
  }
  if (/(atendente|humano|pessoa|recep)/.test(t)) return { acao: 'humano', exames: [] };
  if (/(menu|opç|come|in[ií]cio|voltar)/.test(t)) return { acao: 'menu', exames: [] };
  const exames = EXAMES.filter((e) => {
    const nome = e.nome.toLowerCase();
    return t.includes(e.id) || nome.split(/\s|\(|\)/).some((p) => p.length > 3 && t.includes(p));
  }).map((e) => e.id);
  if (exames.length) return { acao: 'agendar', exames };
  if (/(marca|agend|hor[áa]rio|consulta|exame)/.test(t)) return { acao: 'menu', exames: [] };
  return { acao: 'duvida', exames: [], resposta: mensagemDuvidaFallback() };
}
