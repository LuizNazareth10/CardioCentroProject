/**
 * Gera variantes brasileiras comuns do mesmo número (com/sem 55 e com/sem
 * o 9º dígito depois do DDD). A Evolution pode alternar entre esses formatos
 * no JID, então a allowlist precisa tratá-los como o mesmo telefone.
 */
export function variantesBr(numero: string): string[] {
  const digitos = numero.replace(/\D/g, '');
  if (!digitos) return [];

  const variantes = new Set<string>([digitos]);
  if (digitos.startsWith('55') && digitos.length >= 12) variantes.add(digitos.slice(2));
  else if (!digitos.startsWith('55') && digitos.length >= 10) variantes.add(`55${digitos}`);

  for (const variante of [...variantes]) {
    const nacional = variante.startsWith('55') ? variante.slice(2) : variante;
    if (nacional.length === 11 && nacional[2] === '9') {
      const semNonoDigito = nacional.slice(0, 2) + nacional.slice(3);
      variantes.add(semNonoDigito);
      variantes.add(`55${semNonoDigito}`);
    } else if (nacional.length === 10) {
      const comNonoDigito = nacional.slice(0, 2) + '9' + nacional.slice(2);
      variantes.add(comNonoDigito);
      variantes.add(`55${comNonoDigito}`);
    }
  }

  return [...variantes];
}

export function numeroPermitido(numero: string, permitidos: string[]): boolean {
  if (!numero) return false;
  const allowlist = new Set(permitidos.flatMap(variantesBr));
  return variantesBr(numero).some((variante) => allowlist.has(variante));
}
