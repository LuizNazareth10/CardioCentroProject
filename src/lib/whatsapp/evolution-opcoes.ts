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

/**
 * Resolve a resposta em texto do paciente para 1+ ids do menu numerado
 * enviado por último. Sempre devolve uma LISTA (mesmo para 1 item só) — quem
 * chama decide o que fazer com múltiplos (ver route.ts).
 *
 * Múltiplos números na mesma mensagem ("1 2 3", "1,2,3", "1, 3 e 6") só são
 * aceitos quando o menu atual é de EXAMES (todo id começa com "ex:") — é o
 * único menu onde escolher mais de um item faz sentido. Num menu de 2
 * opções (ex.: Adulto/Criança), "1 2" continua sem resposta clara e cai no
 * comportamento de sempre (texto livre → IA).
 */
export async function resolverOpcaoEvolution(numero: string, texto: string): Promise<string[] | null> {
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
    if (n >= 1 && n <= opcoes.length) return [opcoes[n - 1].id];
  }

  // vários números na mesma mensagem — só faz sentido selecionar mais de um
  // exame de uma vez; em qualquer outro menu, cai para o comportamento normal.
  // "Falar com atendente" (presente em quase todo menu) não conta para essa
  // checagem — sem isso, o menu de exames deixaria de aceitar "1 3 6" assim
  // que o botão de escape fosse adicionado à lista.
  const numeros = [...new Set((t.match(/\d+/g) ?? []).map(Number))].filter((n) => n >= 1 && n <= opcoes.length);
  if (numeros.length > 1) {
    const semEscape = opcoes.filter((o) => o.id !== 'falar_humano');
    const ehMenuDeExames = semEscape.length > 0 && semEscape.every((o) => o.id.startsWith('ex:'));
    if (ehMenuDeExames) {
      const ids = numeros.map((n) => opcoes[n - 1].id);
      // pediu pra falar com atendente JUNTO de outros números ("1 3 e falar
      // com atendente" digitado como número por engano) → prioriza a saída,
      // ignora o resto: misturar exame + escape na mesma mensagem é raro
      // demais pra valer a pena tentar decidir por ele.
      if (ids.includes('falar_humano')) return ['falar_humano'];
      return ids;
    }
  }

  const low = t.toLowerCase();
  const porId = opcoes.find((o) => o.id.toLowerCase() === low);
  if (porId) return [porId.id];
  const porTitulo = opcoes.find((o) => o.titulo.toLowerCase() === low);
  return porTitulo ? [porTitulo.id] : null;
}

/** Monta o corpo de texto com opções *1* … *N* para o paciente responder. */
export function formatarMenuTexto(texto: string, opcoes: OpcaoNumerada[]): string {
  const linhas = opcoes.map((o, i) => `*${i + 1}* — ${o.titulo}`);
  return [texto.trim(), '', ...linhas, '', '_É só responder com o número da opção, tá bem?_ 💙'].join('\n');
}
