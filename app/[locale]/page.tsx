import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import GameCard from '@/components/GameCard';
import AdSlot from '@/components/AdSlot';
import { games, type Locale } from '@/lib/games';

const SITE_URL = 'https://choigamegiaitri.com';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: { en: `${SITE_URL}/en`, vi: `${SITE_URL}/vi`, 'x-default': `${SITE_URL}/en` }
    }
  };
}

export default async function HomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = locale as Locale;
  const t = await getTranslations('home');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: games.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/${locale}/games/${g.slug}`,
      name: g.name[loc]
    }))
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="hero">
        <h1>{t('heroTitle')}</h1>
        <p>{t('heroSubtitle')}</p>
      </section>

      <AdSlot size="banner" id="home-top-banner" />

      <section id="games" className="game-grid">
        {games.map((g) => (
          <GameCard key={g.slug} game={g} locale={loc} />
        ))}
      </section>

      <AdSlot size="rectangle" id="home-rect" />

      <section className="seo-copy">
        <h2>{t('aboutHeading')}</h2>
        <p>{t('aboutBody')}</p>
      </section>
    </>
  );
}
