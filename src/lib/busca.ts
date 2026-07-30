// =============================================================
// BUSCA DE PACIENTES — normalização e chaves indexáveis.
//
// A recepção digita do jeito que vier: com/sem acento, caixa alta, CPF
// pontuado ou não, telefone com ou sem DDD, data com barra, ponto ou hífen.
// Aqui está TODA a normalização — a camada de dados (lib/db) e o backfill
// usam estas funções, então indexação e consulta nunca divergem.
//
// REGRA DE OURO (mesma de lib/db/index.ts): toda consulta usa UM único
// campo, coberto pelo índice automático do Firestore. Nada de índice
// composto (precisa de deploy manual e, se faltar, trava a tela).
// =============================================================

export const soDigitos = (v?: string): string => (v ?? '').replace(/\D/g, '');

/** minúsculas, sem acento e sem pontuação — base de todas as buscas por nome */
export function normalizarBusca(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // acentos (diacríticos combinantes)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** palavras do nome, já normalizadas ("Luiz Gustavo Ferreira" → luiz, gustavo, ferreira) */
export function tokensDoNome(nome: string): string[] {
  return normalizarBusca(nome).split(' ').filter(Boolean);
}

/** nº máximo de palavras do nome que viram chave (limita o tamanho do índice) */
const MAX_TOKENS = 8;
/** tamanho mínimo de prefixo indexado por palavra */
const MIN_PREFIXO = 3;

/** chave canônica de um PAR de palavras (ordem alfabética — a busca ignora a ordem digitada) */
export function parDeTokens(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Chaves gravadas em `nomeTokens` (array, `array-contains` = campo único):
 *
 *  • cada palavra e seus PREFIXOS a partir de 3 letras → "ferr" acha
 *    "Ferreira" mesmo digitando pela metade;
 *  • cada PAR de palavras completas, em ordem alfabética → "luiz ferreira"
 *    acha "Luiz Gustavo Ferreira" (pula o nome do meio) numa única consulta,
 *    sem varrer a coleção.
 */
export function chavesDoNome(nome: string): string[] {
  const tokens = tokensDoNome(nome).slice(0, MAX_TOKENS);
  const chaves = new Set<string>();
  for (const t of tokens) {
    for (let n = Math.min(MIN_PREFIXO, t.length); n <= t.length; n++) chaves.add(t.slice(0, n));
  }
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) chaves.add(parDeTokens(tokens[i], tokens[j]));
  }
  return [...chaves];
}

/**
 * O nome casa com o que foi digitado? Cada palavra digitada precisa ser
 * PREFIXO de alguma palavra do nome, em QUALQUER ordem — é o refinamento em
 * memória aplicado sobre a página que veio do banco.
 */
export function nomeCasaTokens(nomeNormalizado: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const doNome = nomeNormalizado.split(' ').filter(Boolean);
  return tokens.every((t) => doNome.some((n) => n.startsWith(t)));
}

/**
 * Chave mais SELETIVA para consultar `nomeTokens` a partir do que foi
 * digitado: com 2+ palavras, o par formado pelas duas maiores (só existe se
 * ambas estiverem completas); com 1 palavra, ela mesma (os prefixos
 * indexados fazem "silva" achar também "Silvana").
 */
export function chaveDeConsultaNome(tokens: string[]): string | null {
  const uteis = tokens.filter((t) => t.length >= MIN_PREFIXO);
  if (uteis.length === 0) return null;
  if (tokens.length === 1) return uteis[0];
  const maiores = [...uteis].sort((a, b) => b.length - a.length);
  return maiores.length >= 2 ? parDeTokens(maiores[0], maiores[1]) : maiores[0];
}

/** palavra mais longa digitada — usada no plano B, quando o par não existe */
export function tokenMaisLongo(tokens: string[]): string | null {
  const uteis = tokens.filter((t) => t.length >= MIN_PREFIXO);
  if (uteis.length === 0) return null;
  return [...uteis].sort((a, b) => b.length - a.length)[0];
}

/**
 * Pontos de partida válidos de um telefone brasileiro, a partir dos dígitos
 * como foram GRAVADOS. Cada patamar (DDI, DDD) é retirado com base só no
 * COMPRIMENTO — não há como saber com certeza se um "32" no início é DDD ou
 * parte do número, mas os comprimentos de telefone BR são bem definidos:
 * local 8/9 · com DDD 10/11 · com DDI+DDD 12/13.
 *
 * Isto é o que permite buscar COM ou SEM DDD não importa como o cadastro
 * foi digitado: alguns pacientes têm o telefone salvo com DDD, outros sem
 * (import antigo da retroalimentação, cadastro manual, agente do WhatsApp) —
 * sem os dois pontos de partida indexados, buscar do jeito "errado" não acha.
 */
export function ancorasDoTelefone(digitos: string): string[] {
  const ancoras = new Set<string>();
  if (!digitos) return [];
  ancoras.add(digitos);
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    ancoras.add(digitos.slice(2)); // remove DDI → DDD + local
  }
  for (const a of [...ancoras]) {
    if (a.length === 10 || a.length === 11) ancoras.add(a.slice(2)); // remove DDD → só local
  }
  return [...ancoras];
}

/**
 * Prefixos de TODAS as âncoras válidas de um telefone (ver `ancorasDoTelefone`),
 * a partir de 3 dígitos. Gravado em `telefonePrefixos` (array); a busca faz
 * `array-contains` do que foi digitado — se a string digitada é prefixo de
 * QUALQUER âncora (com DDD, sem DDD, sem DDI), o paciente é encontrado.
 *
 * Note a diferença de `telefoneSufixo` (últimos 8 dígitos, usado só para
 * DEDUPLICAR — ver `acharPacienteDuplicado`): cortar pelo FIM descarta o "9"
 * inicial de um celular de 9 dígitos, desalinhando a busca por PREFIXO. Aqui
 * cada âncora é cortada pelo INÍCIO, então o "9" nunca se perde.
 */
export function prefixosDoTelefone(digitos: string): string[] {
  const prefixos = new Set<string>();
  for (const ancora of ancorasDoTelefone(digitos)) {
    for (let n = Math.min(MIN_PREFIXO, ancora.length); n <= ancora.length; n++) prefixos.add(ancora.slice(0, n));
  }
  return [...prefixos];
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** ano com 2 dígitos → século provável (76 → 1976, 09 → 2009) */
function anoCompleto(bruto: string): number {
  const n = Number(bruto);
  if (bruto.length === 4) return n;
  const limite = new Date().getFullYear() % 100;
  return n <= limite ? 2000 + n : 1900 + n;
}

function dataValida(ano: number, mes: number, dia: number): boolean {
  if (ano < 1900 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/**
 * Datas de nascimento plausíveis no que foi digitado, em ISO (o formato
 * gravado em `dataNascimento`). Aceita 10/05/1980, 10-5-80, 10.05.1980,
 * 1980-05-10 e 10051980 — a recepção digita de todo jeito.
 *
 * "10051980" (8 dígitos) é ambíguo: pode ser data ou início de CPF. As duas
 * leituras são consultadas em paralelo e os resultados somados — mais barato
 * que adivinhar errado.
 */
export function datasCandidatas(busca: string): string[] {
  const v = busca.trim();
  const achadas = new Set<string>();
  const registrar = (ano: number, mes: number, dia: number) => {
    if (dataValida(ano, mes, dia)) achadas.add(`${ano}-${pad2(mes)}-${pad2(dia)}`);
  };

  const comSeparador = v.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/);
  if (comSeparador) {
    const [, p1, p2, p3] = comSeparador;
    if (p1.length === 4) registrar(Number(p1), Number(p2), Number(p3)); // 1980-05-10
    else registrar(anoCompleto(p3), Number(p2), Number(p1)); // 10/05/1980
  }

  const d = soDigitos(v);
  if (d.length === 8) {
    registrar(Number(d.slice(4)), Number(d.slice(2, 4)), Number(d.slice(0, 2))); // DDMMAAAA
    registrar(Number(d.slice(0, 4)), Number(d.slice(4, 6)), Number(d.slice(6))); // AAAAMMDD
  }
  if (d.length === 6 && !comSeparador) {
    registrar(anoCompleto(d.slice(4)), Number(d.slice(2, 4)), Number(d.slice(0, 2))); // DDMMAA
  }
  return [...achadas];
}

/** mínimo de dígitos para consultar — menos que isso pega meia base */
export const MIN_DIGITOS_BUSCA = 3;

export interface BuscaInterpretada {
  /**
   * 'numero' = CPF / telefone / data de nascimento · 'nome' = texto ·
   * 'curta' = só 1 ou 2 dígitos (não consulta, mas também não lista todo
   * mundo — quem digitou "32" está no meio de um telefone, não pedindo a
   * lista inteira) · 'vazio' = campo em branco, lista base paginada.
   */
  tipo: 'vazio' | 'curta' | 'numero' | 'nome';
  /** texto normalizado (só em 'nome') */
  texto: string;
  /** palavras normalizadas do texto */
  tokens: string[];
  /** só os dígitos do que foi digitado */
  digitos: string;
  /** datas de nascimento plausíveis, em ISO */
  datas: string[];
}

/**
 * Classifica o que a recepção digitou. Sem letras = número (CPF, telefone ou
 * data); qualquer letra = nome. O mínimo de 3 dígitos evita varrer meia base
 * a cada tecla.
 */
export function interpretarBusca(busca?: string): BuscaInterpretada {
  const bruto = (busca ?? '').trim();
  const vazio: BuscaInterpretada = { tipo: 'vazio', texto: '', tokens: [], digitos: '', datas: [] };
  if (!bruto) return vazio;

  const digitos = soDigitos(bruto);
  const semLetras = !/[a-zA-ZÀ-ɏ]/.test(bruto);
  if (semLetras) {
    if (!digitos) return vazio; // só pontuação
    if (digitos.length < MIN_DIGITOS_BUSCA) return { ...vazio, tipo: 'curta', digitos };
    return { tipo: 'numero', texto: '', tokens: [], digitos, datas: datasCandidatas(bruto) };
  }

  const texto = normalizarBusca(bruto);
  if (!texto) return vazio;
  return { tipo: 'nome', texto, tokens: texto.split(' ').filter(Boolean), digitos, datas: [] };
}
