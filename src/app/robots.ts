import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

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
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
