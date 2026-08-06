import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Apenas páginas públicas — a área restrita fica fora do índice.
export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: agora, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/privacidade`, lastModified: agora, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/termos`, lastModified: agora, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
