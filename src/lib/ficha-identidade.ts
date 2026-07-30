// =============================================================
// FICHA DE IDENTIDADE — fonte ÚNICA dos campos do paciente.
//
// As MESMAS linhas, na MESMA ordem, alimentam as três telas:
//   • cadastro de novo paciente (/pacientes/novo)      → campos editáveis
//   • ficha de identidade (/pacientes/[id])            → leitura + edição
//   • impressão (components/FichaIdentidadePrint)      → leitura
//
// Antes cada tela tinha a sua própria lista e elas divergiam (a impressão
// mostrava "Médico solicitante" que a edição não tinha; a edição tinha
// "Observação" que a impressão não imprimia; o cadastro pedia dezenas de
// campos clínicos que nenhuma das outras exibia). Mexer aqui muda as três.
// =============================================================

import { fmtData, idade } from './format';
import type { Agendamento, Paciente } from './types';

/** como o campo é editado; ausente = derivado (nunca editável) */
export type TipoEditor = 'texto' | 'email' | 'telefone' | 'data' | 'numero' | 'sexo' | 'convenio' | 'textarea';

export type ChaveEditavel =
  | 'nome'
  | 'dataNascimento'
  | 'cpf'
  | 'sexo'
  | 'telefone'
  | 'email'
  | 'endereco'
  | 'convenioId'
  | 'carteirinha'
  | 'pesoKg'
  | 'alturaCm'
  | 'observacoesGerais';

export interface CampoEditavel {
  chave: ChaveEditavel;
  label: string;
  editor: TipoEditor;
  /** ocupa a linha inteira no formulário e na ficha */
  linhaInteira?: boolean;
  obrigatorio?: boolean;
  placeholder?: string;
  /** vai para dentro de `fichaMedica` no payload da API (não na raiz) */
  naFicha?: boolean;
}

/** Campos que a recepção preenche/edita — a ordem aqui é a ordem das telas. */
export const CAMPOS_EDITAVEIS: CampoEditavel[] = [
  { chave: 'nome', label: 'Nome completo', editor: 'texto', linhaInteira: true, obrigatorio: true },
  { chave: 'dataNascimento', label: 'Data de nascimento', editor: 'data' },
  { chave: 'cpf', label: 'Identidade / CPF', editor: 'texto' },
  { chave: 'sexo', label: 'Sexo', editor: 'sexo' },
  { chave: 'telefone', label: 'Telefone / WhatsApp', editor: 'telefone', obrigatorio: true, placeholder: '(32) 9 ...' },
  { chave: 'email', label: 'E-mail', editor: 'email' },
  { chave: 'endereco', label: 'Endereço completo', editor: 'texto', linhaInteira: true },
  { chave: 'convenioId', label: 'Convênio', editor: 'convenio' },
  { chave: 'carteirinha', label: 'Nº da carteirinha', editor: 'texto' },
  { chave: 'pesoKg', label: 'Peso (kg)', editor: 'numero', naFicha: true },
  { chave: 'alturaCm', label: 'Altura (cm)', editor: 'numero', naFicha: true },
  {
    chave: 'observacoesGerais',
    label: 'Observações',
    editor: 'textarea',
    linhaInteira: true,
    naFicha: true,
    placeholder: 'Informações relevantes para a equipe…',
  },
];

const POR_CHAVE = new Map(CAMPOS_EDITAVEIS.map((c) => [c.chave as string, c]));

/** seções da ficha, na ordem — misturam campos editáveis e derivados */
export const SECOES_FICHA: Array<{ titulo: string; chaves: string[] }> = [
  {
    titulo: 'Dados pessoais',
    chaves: ['nome', 'dataNascimento', 'cpf', 'idade', 'sexo', 'telefone', 'email', 'endereco'],
  },
  {
    titulo: 'Cadastro e antropometria',
    chaves: [
      'criadoEm',
      'convenioId',
      'carteirinha',
      'medicoExecutante',
      'exameRecente',
      'pesoKg',
      'alturaCm',
      'registro',
      'observacoesGerais',
    ],
  },
];

/** campos editáveis de uma seção — usado pelo cadastro de novo paciente */
export function camposEditaveisDaSecao(titulo: string): CampoEditavel[] {
  const secao = SECOES_FICHA.find((s) => s.titulo === titulo);
  return (secao?.chaves ?? []).map((c) => POR_CHAVE.get(c)).filter((c): c is CampoEditavel => !!c);
}

export interface CampoFicha {
  chave: string;
  label: string;
  /** já formatado para leitura ('' quando não preenchido) */
  valor: string;
  /** valor cru para o input de edição ('' quando não preenchido) */
  bruto: string;
  linhaInteira?: boolean;
  /** ausente = derivado do histórico/cadastro, somente leitura */
  editor?: TipoEditor;
  obrigatorio?: boolean;
  placeholder?: string;
}

export interface SecaoFicha {
  titulo: string;
  campos: CampoFicha[];
}

export interface ContextoFicha {
  /** nome do convênio (não o id) */
  convenio: string;
  /** médico que vai realizar / realizou o exame em destaque */
  medicoExecutante: string;
  /** próximo exame agendado ou, na falta dele, o último realizado */
  exameRecente?: ExameMaisRecente | null;
}

const sexoPorExtenso = (p: Paciente) =>
  p.sexo === 'F' ? 'Feminino' : p.sexo === 'M' ? 'Masculino' : p.sexo === 'O' ? 'Outro' : '';

/**
 * Monta a ficha completa (leitura + metadados de edição). `valor` é o texto
 * exibido; `bruto` é o que vai no input quando a ficha entra em edição.
 */
export function montarFichaIdentidade(p: Paciente, ctx: ContextoFicha): SecaoFicha[] {
  const fm = p.fichaMedica;
  const nasc = p.dataNascimento;

  const derivado = (chave: string): { label: string; valor: string } | null => {
    switch (chave) {
      case 'idade':
        return { label: 'Idade', valor: nasc ? idade(nasc) : '' };
      case 'criadoEm':
        return { label: 'Data de cadastro', valor: p.criadoEm ? fmtData(p.criadoEm) : '' };
      case 'medicoExecutante':
        return { label: 'Médico executante', valor: ctx.medicoExecutante };
      case 'exameRecente':
        return {
          label: ctx.exameRecente?.futuro ? 'Próximo exame agendado' : 'Último exame realizado',
          valor: ctx.exameRecente ? `${ctx.exameRecente.nome} — ${fmtData(ctx.exameRecente.quando)}` : '',
        };
      case 'registro':
        return { label: 'Registro nº', valor: p.id };
      default:
        return null;
    }
  };

  const editavel = (campo: CampoEditavel): CampoFicha => {
    const bruto = valorBruto(p, campo.chave);
    let valor = bruto;
    if (campo.chave === 'dataNascimento') valor = nasc ? fmtData(`${nasc}T12:00`) : '';
    if (campo.chave === 'sexo') valor = sexoPorExtenso(p);
    if (campo.chave === 'convenioId') valor = ctx.convenio;
    if (campo.chave === 'pesoKg') valor = fm?.pesoKg ? `${fm.pesoKg} kg` : '';
    if (campo.chave === 'alturaCm') valor = fm?.alturaCm ? `${fm.alturaCm} cm` : '';
    return {
      chave: campo.chave,
      label: campo.label,
      valor,
      bruto,
      linhaInteira: campo.linhaInteira,
      editor: campo.editor,
      obrigatorio: campo.obrigatorio,
      placeholder: campo.placeholder,
    };
  };

  return SECOES_FICHA.map((secao) => ({
    titulo: secao.titulo,
    campos: secao.chaves
      .map((chave): CampoFicha | null => {
        const campo = POR_CHAVE.get(chave);
        if (campo) return editavel(campo);
        const d = derivado(chave);
        return d ? { chave, label: d.label, valor: d.valor, bruto: '', linhaInteira: chave === 'exameRecente' } : null;
      })
      .filter((c): c is CampoFicha => !!c),
  }));
}

/** valor cru de um campo editável, no formato que o input espera */
export function valorBruto(p: Partial<Paciente>, chave: ChaveEditavel): string {
  switch (chave) {
    case 'nome': return p.nome ?? '';
    case 'dataNascimento': return p.dataNascimento ?? '';
    case 'cpf': return p.cpf ?? '';
    case 'sexo': return p.sexo ?? '';
    case 'telefone': return p.telefone ?? '';
    case 'email': return p.email ?? '';
    case 'endereco': return p.endereco ?? '';
    case 'convenioId': return p.convenioId ?? 'particular';
    case 'carteirinha': return p.carteirinha ?? '';
    case 'pesoKg': return p.fichaMedica?.pesoKg?.toString() ?? '';
    case 'alturaCm': return p.fichaMedica?.alturaCm?.toString() ?? '';
    case 'observacoesGerais': return p.fichaMedica?.observacoesGerais ?? '';
  }
}

/** estado inicial do formulário de edição (todas as chaves editáveis) */
export function valoresIniciais(p: Partial<Paciente>): Record<ChaveEditavel, string> {
  return Object.fromEntries(
    CAMPOS_EDITAVEIS.map((c) => [c.chave, valorBruto(p, c.chave)]),
  ) as Record<ChaveEditavel, string>;
}

/**
 * Converte o formulário no corpo aceito pela API (`/api/pacientes`), com os
 * campos antropométricos/observação dentro de `fichaMedica`.
 *
 * Manda TODAS as chaves, inclusive as vazias: é assim que apagar um e-mail
 * digitado errado realmente apaga (a API distingue "campo ausente" de
 * "campo enviado em branco"). Vazio em campo numérico é ignorado lá.
 */
export function corpoDoFormulario(dados: Partial<Record<ChaveEditavel, string>>): Record<string, unknown> {
  const raiz: Record<string, unknown> = {};
  const ficha: Record<string, unknown> = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    const bruto = (dados[campo.chave] ?? '').trim();
    const alvo = campo.naFicha ? ficha : raiz;
    alvo[campo.chave] = campo.editor === 'numero' && bruto ? Number(bruto) : bruto;
  }
  return { ...raiz, fichaMedica: ficha };
}

// -------------------------------------------------------------
// Derivações do histórico de agendamentos (zero escrita no banco)
// -------------------------------------------------------------

export interface ExameMaisRecente {
  nome: string;
  quando: string;
  futuro: boolean;
  medicoId?: string;
}

/** MAPA/Holter são aparelhos, não médicos — não entram como executante */
const ehAparelho = (medicoId: string) => medicoId === 'mapa' || medicoId === 'holter';

/**
 * Médico executante sincronizado com o exame em destaque na ficha:
 *  - se há agendamento futuro → médico desse exame (vai realizar);
 *  - senão → médico do último exame já ocorrido (realizou).
 */
export function medicoExecutanteDoExame(
  historico: Agendamento[],
  nomeMedico: (id: string) => string,
  agoraISO: string = new Date().toISOString(),
): string {
  const agoraMs = new Date(agoraISO).getTime();
  const validos = historico.filter(
    (h) => h.status !== 'cancelado' && h.status !== 'faltou' && !ehAparelho(h.medicoId),
  );
  const futuros = validos
    .filter((h) => new Date(h.inicio).getTime() >= agoraMs)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (futuros.length > 0) return nomeMedico(futuros[0].medicoId);

  const passados = validos
    .filter((h) => new Date(h.inicio).getTime() < agoraMs)
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  if (passados.length > 0) return nomeMedico(passados[0].medicoId);
  return '';
}

/**
 * Prefere o próximo exame agendado (futuro); se não houver, o último
 * realizado. Exames que ocupam o MESMO horário (ex.: eco + carótida que o
 * Dr. Daher faz juntos em 15min) aparecem como um só: "Eco + Carótida".
 */
export function exameMaisRecente(
  historico: Agendamento[],
  nomeExame: (id: string) => string,
  agoraISO: string = new Date().toISOString(),
): ExameMaisRecente | null {
  const agoraMs = new Date(agoraISO).getTime();
  const validos = historico.filter((h) => h.status !== 'cancelado' && h.status !== 'faltou');
  const futuros = validos
    .filter((h) => new Date(h.inicio).getTime() >= agoraMs)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const escolhido = futuros[0]
    ?? validos
      .filter((h) => new Date(h.inicio).getTime() < agoraMs)
      .sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
  if (!escolhido) return null;
  const juntos = validos.filter((h) => h.inicio === escolhido.inicio);
  return {
    nome: juntos.map((h) => nomeExame(h.exameId)).join(' + '),
    quando: escolhido.inicio,
    futuro: futuros.length > 0,
    medicoId: escolhido.medicoId,
  };
}
