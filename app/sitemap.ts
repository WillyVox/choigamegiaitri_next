import type { MetadataRoute } from 'next';
import { GAME_CONFIGS } from '@/lib/games';
import { locales } from '@/src/routing';

const SITE_URL = 'https://choigamegiaitri.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    entries.push({
      url: `${SITE_URL}/${locale}`,
      changeFrequency: 'daily',
      priority: 1
    });
    entries.push({
      url: `${SITE_URL}/${locale}/about`,
      changeFrequency: 'monthly',
      priority: 0.3
    });
    entries.push({
      url: `${SITE_URL}/${locale}/privacy`,
      changeFrequency: 'monthly',
      priority: 0.2
    });
    for (const game of GAME_CONFIGS) {
      entries.push({
        url: `${SITE_URL}/${locale}/games/${game.slug}`,
        changeFrequency: 'weekly',
        priority: 0.8
      });
    }
  }

  return entries;
}
