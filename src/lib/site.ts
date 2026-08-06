// =============================================================
// Endereço público do site — fonte única.
//
// Usado pela tag canônica, pelo sitemap, pelo robots.txt e pelos dados
// estruturados. Antes esta constante estava duplicada em quatro arquivos
// apontando para um domínio que não existia: o Google lia a canônica, não
// encontrava o destino e tratava a página real como duplicata de um endereço
// inexistente — resultado prático, indexação zero.
//
// Defina APP_BASE_URL nas variáveis de ambiente da Vercel com a URL final
// (sem barra no fim). O fallback abaixo só vale para desenvolvimento.
// =============================================================

export const SITE_URL = (process.env.APP_BASE_URL ?? 'https://cardiocentrojf.com.br').replace(/\/+$/, '');

/** Avisa no boot se a produção estiver servindo o fallback em vez do domínio real. */
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production' && !process.env.APP_BASE_URL) {
  console.error(
    '❌ [seo] APP_BASE_URL não definida — canônica, sitemap e Open Graph estão usando ' +
      `o fallback "${SITE_URL}". Se esse não for o domínio real em produção, o site NÃO será indexado.`,
  );
}
