export type Locale = 'en' | 'vi';

export interface GameMeta {
  /** URL segment: /[locale]/games/[slug] */
  slug: string;
  name: Record<Locale, string>;
  tagline: Record<Locale, string>;
  description: Record<Locale, string>;
  /** Path under /public, e.g. /games/merge-meadow/thumbnail.png */
  thumbnail: string;
  genre: string[];
}

/**
 * To add a new game later:
 *   1. Build the game as a React client component in components/games/.
 *   2. Add its metadata to this array.
 *   3. Add its slug -> component mapping in app/[locale]/games/[slug]/page.tsx.
 * The dashboard, sitemap, and SEO metadata all pick it up automatically.
 */
export const games: GameMeta[] = [
  {
    slug: 'dragons-gate',
    name: { en: "Dragon's Gate", vi: "Dragon's Gate" },
    tagline: {
      en: 'Flap through the castle gates without crashing.',
      vi: 'Bay qua các cổng thành mà không va chạm.'
    },
    description: {
      en: "Guide a dragon through a gauntlet of castle gates in this addictive one-tap arcade flyer. Simple to learn, hard to master.",
      vi: 'Điều khiển một chú rồng bay qua hàng loạt cổng thành trong trò chơi arcade một chạm gây nghiện này. Dễ chơi nhưng khó làm chủ.'
    },
    thumbnail: '/games/dragons-gate/thumbnail.png',
    genre: ['Arcade', 'Casual']
  },
  {
    slug: 'chaos-or-nah',
    name: { en: 'Chaos or Nah?', vi: 'Chaos or Nah?' },
    tagline: {
      en: 'Rapid-fire silly dilemmas. Pick a side.',
      vi: 'Những tình huống hài hước, chọn nhanh một phe.'
    },
    description: {
      en: 'A rapid-fire this-or-that game full of ridiculous dilemmas. Build a streak, or try the daily challenge and compare your result grid with friends.',
      vi: "Trò chơi lựa chọn nhanh với những tình huống siêu hài hước. Giữ chuỗi thắng, hoặc thử thử thách hằng ngày và so sánh kết quả với bạn bè."
    },
    thumbnail: '/games/chaos-or-nah/thumbnail.png',
    genre: ['Party', 'Quiz']
  },
  {
    slug: 'merge-meadow',
    name: { en: 'Merge Meadow', vi: 'Merge Meadow' },
    tagline: {
      en: 'Drop, merge, grow the biggest fruit.',
      vi: 'Thả, ghép và tạo ra trái cây to nhất.'
    },
    description: {
      en: 'A cozy physics puzzle game. Drop fruit, merge matching pairs into bigger ones, and see how big you can grow before the jar overflows.',
      vi: 'Trò chơi giải đố vật lý nhẹ nhàng. Thả trái cây, ghép các cặp giống nhau để tạo ra trái to hơn, xem bạn có thể tạo ra trái lớn đến đâu trước khi lọ bị tràn.'
    },
    thumbnail: '/games/merge-meadow/thumbnail.png',
    genre: ['Puzzle', 'Casual']
  },
  {
    slug: 'bubble-burst',
    name: {
      en: 'Bubble Burst',
      vi: 'Bùng Nổ Bong Bóng'
    },
    tagline: {
      en: 'Pop magical bubbles and build the highest combo.',
      vi: 'Nổ những bong bóng kỳ diệu và tạo combo cao nhất.'
    },
    description: {
      en: 'Tap colorful magical bubbles before they disappear, build powerful combos, and beat your high score in this relaxing yet addictive bubble-popping game.',
      vi: 'Chạm vào những bong bóng nhiều màu sắc trước khi chúng biến mất, tạo các combo mạnh mẽ và phá kỷ lục trong trò chơi nổ bong bóng thư giãn nhưng gây nghiện này.'
    },
    thumbnail: '/games/bubble-burst/thumbnail.png',
    genre: ['Casual', 'Arcade']
  }
  
];

export function getGame(slug: string): GameMeta | undefined {
  return games.find((g) => g.slug === slug);
}
