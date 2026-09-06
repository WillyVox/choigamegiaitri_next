import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GAME_CONFIGS, getGame, type Locale } from '@/lib/games';
import { locales } from '@/src/routing';
import AdSlot from '@/components/AdSlot';
import GameCard from '@/components/GameCard';
import SkyStrike from '@/components/games/SkyStrike';
import DragonsGate from '@/components/games/DragonsGate';
import BubbleBurst from '@/components/games/BubbleBurst';
import MergeMeadow from '@/components/games/MergeMeadow';
import ChaosOrNah from '@/components/games/ChaosOrNah';
import BubbleBlast from '@/components/games/BubbleBlast';
import CrystalBlocks from '@/components/games/CrystalBlocks';
import SudokuZen from '@/components/games/SudokuZen';

const SITE_URL = 'https://choigamegiaitri.com';

const componentMap: Record<string, React.ComponentType> = {
  'sky-strike': SkyStrike,
  'dragons-gate': DragonsGate,
  'chaos-or-nah': ChaosOrNah,
  'merge-meadow': MergeMeadow,
  'bubble-burst': BubbleBurst,
  'bubble-blast': BubbleBlast,
  'crystal-blocks': CrystalBlocks,
  'sudoku-zen': SudokuZen
};

export function generateStaticParams() {
  return locales.flatMap((locale) => GAME_CONFIGS.map((g) => ({ locale, slug: g.slug })));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const game = getGame(slug);
  if (!game) return {};
  const loc = locale as Locale;
  const t = await getTranslations({ locale, namespace: 'gamePage' });

  return {
    title: `${game.name[loc]} — ${t('playNow')}`,
    description: game.description[loc],
    alternates: {
      canonical: `${SITE_URL}/${locale}/games/${slug}`,
      languages: {
        en: `${SITE_URL}/en/games/${slug}`,
        vi: `${SITE_URL}/vi/games/${slug}`,
        'x-default': `${SITE_URL}/en/games/${slug}`
      }
    },
    openGraph: {
      title: game.name[loc],
      description: game.description[loc],
      url: `${SITE_URL}/${locale}/games/${slug}`,
      images: [{ url: `${SITE_URL}${game.thumbnail}` }]
    }
  };
}

export default async function GamePage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();

  const GameComponent = componentMap[slug];
  if (!GameComponent) notFound();

  const loc = locale as Locale;
  const t = await getTranslations({ locale, namespace: 'gamePage' });
  const related = GAME_CONFIGS.filter((g) => g.slug !== slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.name[loc],
    description: game.description[loc],
    genre: game.genre,
    url: `${SITE_URL}/${locale}/games/${slug}`,
    inLanguage: locale,
    gamePlatform: 'Web Browser',
    applicationCategory: 'Game',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="game-page-header">
        <h1>{game.name[loc]}</h1>
        <p>{game.description[loc]}</p>
      </header>

      <AdSlot size="banner" id={`${slug}-top-banner`} />

      <div className="game-stage-wrap">
        <GameComponent />
      </div>

      <AdSlot size="rectangle" id={`${slug}-rect`} />

      <section className="seo-copy">
        <h2>{t('moreGames')}</h2>
        <div className="game-grid">
          {related.map((g) => (
            <GameCard key={g.slug} game={g} locale={loc} />
          ))}
        </div>
      </section>
    </>
  );
}
