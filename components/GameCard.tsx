'use client';

import Link from 'next/link';
import type { GameMeta, Locale } from '@/lib/games';

export default function GameCard({ game, locale }: { game: GameMeta; locale: Locale }) {
  return (
    <Link href={`/${locale}/games/${game.slug}`} className="game-card">
      <div className="game-card__thumb" aria-hidden="true">
        {/* Swap for a real <Image> once you have thumbnail art in /public */}
        <span>{game.name[locale].slice(0, 1)}</span>
      </div>
      <div className="game-card__body">
        <h3>{game.name[locale]}</h3>
        <p>{game.tagline[locale]}</p>
        <div className="game-card__tags">
          {game.genre.map((g) => (
            <span key={g} className="tag">{g}</span>
          ))}
        </div>
      </div>

      <style jsx>{`
        .game-card {
          display: flex;
          flex-direction: column;
          border-radius: 18px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.7);
          border: 2px solid rgba(0, 0, 0, 0.08);
          text-decoration: none;
          color: inherit;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .game-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
        }
        .game-card__thumb {
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.4rem;
          font-weight: 800;
          background: linear-gradient(135deg, #ffd479, #ff8a5c);
          color: #3a2410;
        }
        .game-card__body {
          padding: 14px 16px 18px;
        }
        h3 {
          margin: 0 0 4px;
          font-size: 1.05rem;
        }
        p {
          margin: 0 0 10px;
          font-size: 0.88rem;
          opacity: 0.75;
          line-height: 1.4;
        }
        .game-card__tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tag {
          font-size: 0.68rem;
          background: rgba(0, 0, 0, 0.06);
          padding: 3px 9px;
          border-radius: 999px;
        }
      `}</style>
    </Link>
  );
}
