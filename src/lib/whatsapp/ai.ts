import { EXAMES } from '../seed-data';

// =============================================================
// Camada de IA (modo híbrido). Só é acionada quando o paciente
// escreve em texto livre — os menus/botões resolvem o caminho comum.
// Usa a API da Anthropic para extrair intenção e mapear exames.
// Se ANTHROPIC_API_KEY não estiver configurada, faz um fallback
// simples por palavras-chave.
// =============================================================

export interface Intencao {
  acao: 'agendar' | 'menu' | 'humano' | 'duvida';
  exames: string[]; // ids de EXAMES
  medicoMencionado?: string;
  resposta?: string; // resposta livre para "duvida"
}

const listaExames = EXAMES.map((e) => `${e.id}: ${e.nome}`).join('\n');

export async function interpretar(texto: string): Promise<Intencao> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallbackPorPalavras(texto);

  const system = `Você é a atendente virtual da clínica CardioCentro (cardiologia, Juiz de Fora).
Seja educada, acolhedora e incentive a marcação de exames.
Exames disponíveis (id: nome):
${listaExames}

Responda SOMENTE com um JSON válido, sem texto fora dele, no formato:
{"acao":"agendar|menu|humano|duvida","exames":["id",...],"medicoMencionado":"...|null","resposta":"texto curto se acao=duvida, senão null"}
- "agendar": paciente quer marcar um ou mais exames (preencha "exames").
- "menu": paciente quer ver as opções/voltar ao início.
- "humano": paciente quer falar com uma pessoa.
- "duvida": pergunta geral (responda em "resposta", de forma curta e gentil, e convide a agendar).`;

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
  if (/(atendente|humano|pessoa|recep)/.test(t)) return { acao: 'humano', exames: [] };
  if (/(menu|opç|come|in[ií]cio|voltar)/.test(t)) return { acao: 'menu', exames: [] };
  const exames = EXAMES.filter((e) => {
    const nome = e.nome.toLowerCase();
    return t.includes(e.id) || nome.split(/\s|\(|\)/).some((p) => p.length > 3 && t.includes(p));
  }).map((e) => e.id);
  if (exames.length) return { acao: 'agendar', exames };
  if (/(marca|agend|hor[áa]rio|consulta|exame)/.test(t)) return { acao: 'menu', exames: [] };
  return { acao: 'duvida', exames: [], resposta: 'Posso te ajudar a agendar um exame ou consulta. Quer ver as opções?' };
}
