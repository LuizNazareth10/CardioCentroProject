import { EXAMES } from './seed-data';

export const NOME_ECO_COMBINADO =
  'Ecocardiograma com Doppler Colorido/Ecocardiograma Transtorácico';

/** Nome completo para exibição. */
export function nomeExameDisplay(id: string): string {
  if (id === 'eco-doppler') return NOME_ECO_COMBINADO;
  return EXAMES.find((e) => e.id === id)?.nome ?? id;
}

/** Título curto para listas interativas do WhatsApp (limite de 24 caracteres). */
export function nomeExameLista(id: string): string {
  const curtos: Record<string, string> = {
    'eco-doppler': 'Eco Doppler/Transt.',
    'duplex-carotidas': 'Duplex Carótidas',
    ergometrico: 'Teste Ergométrico',
    cardiopulmonar: 'Teste Cardiopulmonar',
    holter: 'Holter 24h',
    mapa: 'MAPA 24h',
  };
  const curto = curtos[id];
  if (curto) return curto;
  const full = nomeExameDisplay(id);
  return full.length <= 24 ? full : full.slice(0, 24);
}

/** Descrição da linha na lista — só duração para não repetir o título. */
export function descricaoExameLista(_id: string, duracaoMin: number): string {
  return `${duracaoMin} min`;
}

/** Restaura o nome completo a partir do id de uma linha de lista (`ex:eco-doppler`). */
export function resolverTituloLista(id: string, tituloFallback: string): string {
  if (id.startsWith('ex:')) return nomeExameDisplay(id.slice(3));
  return tituloFallback;
}
