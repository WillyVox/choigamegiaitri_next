export type Locale = 'en' | 'vi';

export interface GameMeta {
  /** URL segment: /[locale]/games/[slug] */
  slug: string;
  name: Record<Locale, string>;
  tagline: Record<Locale, string>;
  description: Record<Locale, string>;
  /** Static image for <meta og:image>, sitemap, JSON-LD, etc. Must live under /public. */
  ogImage: string;
  genre: string[];
}

/**
 * To add a new game later:
 *   1. Build the game as a React client component in components/games/.
 *   2. Add its metadata to this array.
 *   3. Add its slug -> component mapping in app/[locale]/games/[slug]/page.tsx.
 * The dashboard, sitemap, and SEO metadata all pick it up automatically.
 */
export const GAME_CONFIGS: GameMeta[] = [
  {
    slug: 'sky-strike',
    name: { en: 'Sky Strike', vi: 'Chiến Cơ Siêu Kích' },
    tagline: {
      en: 'Blast through enemy fleets and dodge incoming fire in the ultimate sky brawl.',
      vi: 'Bắn hạ phi đội địch và né đạn trong trận chiến trên không đầy kịch tính.'
    },
    description: {
      en: 'Take control of an advanced fighter jet in this fast-paced arcade shooter. Collect power-ups, defeat boss ships, and climb the high scores.',
      vi: 'Chơi Game Giải Trí bắn máy bay arcade - Điều khiển chiến cơ hiện đại, thu thập vật phẩm hỗ trợ, tiêu diệt trùm và chinh phục kỷ lục điểm số.'
    },
    ogImage: '/games/icon-sky-strike.svg',
    genre: ['Arcade', 'Action']
  },
  
  {
    slug: 'dragons-gate',
    name: { en: "Dragon's Gate", vi: "Rồng Bay Qua Cổng" },
    tagline: {
      en: 'Flap through the castle gates without crashing.',
      vi: 'Chơi Game Giải Trí Rồng Bay qua các cổng thành mà không va chạm.'
    },
    description: {
      en: "Guide a dragon through a gauntlet of castle gates in this addictive one-tap arcade flyer. Simple to learn, hard to master.",
      vi: 'Chơi game giải trí - Điều khiển một chú rồng bay qua hàng loạt cổng thành trong trò chơi arcade một chạm gây nghiện này. Dễ chơi nhưng khó làm chủ.'
    },
    ogImage: '/games/icon-dragons-gate.svg',
    genre: ['Arcade', 'Casual']
  },
  {
    slug: 'bubble-burst',
    name: {
      en: 'Bubble Burst',
      vi: 'Đập Bong Bóng'
    },
    tagline: {
      en: 'Pop magical bubbles and build the highest combo.',
      vi: 'Chơi Game Giải Trí Đập Bong Bóng - Game Online Miễn Phí Trên Web'
    },
    description: {
      en: 'Tap colorful magical bubbles before they disappear, build powerful combos, and beat your high score in this relaxing yet addictive bubble-popping game.',
      vi: 'Chơi game giải trí bắn bóng thư giãn, xả stress miễn phí ngay trên trình duyệt. Game chơi mượt trên điện thoại và máy tính, không cần cài đặt!'
    },
    ogImage: '/games/icon-bubble-burst.svg',
    genre: ['Casual', 'Arcade']
  },
  {
    slug: 'merge-meadow',
    name: { en: 'Merge Meadow', vi: 'Ghép Trái Cây' },
    tagline: {
      en: 'Drop, merge, grow the biggest fruit.',
      vi: 'Chơi Game Giải Trí Ghép và tạo ra trái cây to nhất.'
    },
    description: {
      en: 'A cozy physics puzzle game. Drop fruit, merge matching pairs into bigger ones, and see how big you can grow before the jar overflows.',
      vi: 'Chơi Game Giải Trí vật lý nhẹ nhàng. Thả trái cây, ghép các cặp giống nhau để tạo ra trái to hơn, xem bạn có thể tạo ra trái lớn đến đâu trước khi lọ bị tràn.'
    },
    ogImage: '/games/icon-merge-meadow.svg',
    genre: ['Puzzle', 'Casual']
  },  
  {
    slug: 'crystal-blocks',
    name: { en: 'Crystal Blocks', vi: 'Khối Pha Lê' },
    tagline: {
      en: 'Stack, clear, and chase the high score.',
      vi: 'Chơi Game Giải Trí xếp khối và phá kỷ lục của bạn.'
    },
    description: {
      en: 'A polished falling-block puzzle. Rotate and drop crystal-colored blocks to clear full lines, speed up as you level up, and see how high you can score before the board fills.',
      vi: 'Chơi Game Giải Trí xếp khối pha lê kinh điển. Xoay và thả khối để lấp đầy từng hàng, tốc độ tăng dần theo cấp độ, xem bạn ghi được bao nhiêu điểm trước khi bảng bị đầy.'
    },
    ogImage: '/games/icon-crystal-blocks.svg',
    genre: ['Puzzle', 'Classic']
  },
  {
    slug: 'sudoku-zen',
    name: { en: 'Sudoku Zen', vi: 'Sudoku Thư Giãn' },
    tagline: {
      en: 'Fill the grid, clear your mind.',
      vi: 'Chơi Game Giải Trí Sudoku, thư giãn đầu óc mỗi ngày.'
    },
    description: {
      en: 'A calm, classic number puzzle. Fill every row, column, and box with 1 to 9, climb through leveled difficulty, and see how far you can go before running out of mistakes.',
      vi: 'Chơi Game Giải Trí Sudoku cổ điển, nhẹ nhàng thư giãn. Điền số từ 1 đến 9 vào từng hàng, cột và ô vuông, vượt qua các cấp độ khó tăng dần, xem bạn đi được bao xa trước khi hết lượt sai.'
    },
    ogImage: '/games/icon-sudoku-zen.svg',
    genre: ['Puzzle', 'Classic']
  },
  {
    slug: 'goose-goose-duck',
    name: { 
      en: 'Goose Goose Duck', 
      vi: 'Vịt Lẫn Trốn' 
    },
    tagline: {
      en: 'Spot the hidden duck among the geese before time runs out!',
      vi: 'Truy tìm chú vịt ẩn nấp giữa đàn ngỗng trước khi hết giờ!'
    },
    description: {
      en: 'A fast-paced hyper-casual hidden-object game. Tap through the flock, spot the imposter duck, keep suspicion low, and clear levels as difficulty scales.',
      vi: 'Trò chơi tinh mắt nhanh tay đầy kịch tính. Bấm tìm chú vịt ẩn nấp giữa bầy ngỗng, kiểm soát mức độ nghi ngờ và vượt qua các cấp độ thử thách tăng dần.'
    },
    ogImage: '/games/icon-goose-goose-duck.svg',
    genre: ['Casual', 'Puzzle', 'Arcade']
  },
  {
    slug: 'plants-vs-bugs',
    name: { en: 'Plants vs Bugs', vi: 'Cây Trồng Diệt Bọ' },
    tagline: {
      en: 'Plant gardens, stop bugs, defend your yard.',
      vi: 'Trồng cây, cản bọ, bảo vệ khu vườn của bạn.'
    },
    description: {
      en: 'A strategic garden defense game. Place sunflowers, peashooters, and special plants to fight off waves of hungry bugs before they breach your yard.',
      vi: 'Game thủ thành bảo vệ khu vườn đầy chiến thuật. Trồng hoa hướng dương, đậu bắn súng và các loại cây đặc biệt để ngăn chặn từng đàn bọ biến mất trước khi chúng xâm nhập.'
    },
    ogImage: '/games/icon-plants-vs-bugs.svg',
    genre: ['Strategy', 'Tower Defense', 'Casual']
  }
  /* {
    slug: 'chaos-or-nah',
    name: { en: 'Chaos or Nah?', vi: 'Chaos or Nah?' },
    tagline: {
      en: 'Rapid-fire silly dilemmas. Pick a side.',
      vi: 'Chơi Game Giải Trí Những tình huống hài hước, chọn nhanh một phe.'
    },
    description: {
      en: 'A rapid-fire this-or-that game full of ridiculous dilemmas. Build a streak, or try the daily challenge and compare your result grid with friends.',
      vi: "Chơi Game Giải Trí - Trò chơi lựa chọn nhanh với những tình huống siêu hài hước. Giữ chuỗi thắng, hoặc thử thử thách hằng ngày và so sánh kết quả với bạn bè."
    },
    ogImage: '/games/icon-chaos-or-nah.svg',
    genre: ['Party', 'Quiz']
  },
  {
    slug: 'bubble-shoot',
    name: { en: 'Bubble Blast', vi: 'Bắn Bóng Vũ Trụ' },
    tagline: {
      en: 'Aim, shoot, pop matching bubbles.',
      vi: 'Chơi Game Giải Trí bắn bóng và dọn sạch bầu trời sao.'
    },
    description: {
      en: 'A classic bubble shooter in a cosmic setting. Aim and fire colored bubbles, match three or more of the same color to pop them, and clear the sky before the bubbles reach the bottom.',
      vi: 'Chơi Game Giải Trí bắn bóng cổ điển giữa không gian đầy sao. Ngắm và bắn bóng màu, ghép từ 3 bóng cùng màu trở lên để nổ, dọn sạch bầu trời trước khi bóng tràn xuống đáy.'
    },
    ogImage: '/games/icon-bubble-shoot.svg',
    genre: ['Puzzle', 'Arcade', 'Casual']
  }, 
  */
];

export function getGame(slug: string): GameMeta | undefined {
  return GAME_CONFIGS.find((g) => g.slug === slug);
}
