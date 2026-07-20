// =============================================================
// Opções numeradas do canal Evolution (texto no lugar de botões/listas).
// Persistidas no Firestore porque em serverless a memória não sobrevive
// entre o envio do menu e a resposta do paciente.
// =============================================================

export type OpcaoNumerada = { id: string; titulo: string };

function docId(numero: string): string {
  return numero.replace(/\D/g, '');
}

export async function salvarOpcoesEvolution(numero: string, opcoes: OpcaoNumerada[]): Promise<void> {
  const id = docId(numero);
  if (!id || opcoes.length === 0) return;
  try {
    const { db } = await import('@/lib/db/firestore');
    await db().collection('evolution_opcoes').doc(id).set({
      opcoes,
      atualizadoEm: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[evolution:opcoes] falha ao salvar:', e);
  }
}

export async function resolverOpcaoEvolution(numero: string, texto: string): Promise<string | null> {
  const id = docId(numero);
  const t = texto.trim();
  if (!id || !t) return null;

  let opcoes: OpcaoNumerada[] = [];
  try {
    const { db } = await import('@/lib/db/firestore');
    const snap = await db().collection('evolution_opcoes').doc(id).get();
    opcoes = (snap.data()?.opcoes as OpcaoNumerada[] | undefined) ?? [];
  } catch (e) {
    console.error('[evolution:opcoes] falha ao ler:', e);
    return null;
  }
  if (opcoes.length === 0) return null;

  if (/^\d+$/.test(t)) {
    const n = Number(t);
    if (n >= 1 && n <= opcoes.length) return opcoes[n - 1].id;
  }

  const low = t.toLowerCase();
  const porId = opcoes.find((o) => o.id.toLowerCase() === low);
  if (porId) return porId.id;
  const porTitulo = opcoes.find((o) => o.titulo.toLowerCase() === low);
  return porTitulo?.id ?? null;
}

/** Monta o corpo de texto com opções *1* … *N* para o paciente responder. */
export function formatarMenuTexto(texto: string, opcoes: OpcaoNumerada[]): string {
  const linhas = opcoes.map((o, i) => `*${i + 1}* — ${o.titulo}`);
  return [texto.trim(), '', ...linhas, '', '_Responda com o número da opção._'].join('\n');
}
