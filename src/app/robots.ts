import type { MetadataRoute } from 'next';

const SITE_URL = process.env.APP_BASE_URL ?? 'https://cardiocentrojf.com.br';

// Landing indexável; área restrita, login e APIs bloqueadas.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/login',
          '/dashboard',
          '/agenda',
          '/agendar',
          '/pacientes',
          '/atendimentos',
          '/simulador',
          '/configuracoes',
          '/leads',
          '/metricas',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
