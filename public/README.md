Drop these in before launch:

- `og-image.jpg` (1200×630) — used for Open Graph / Twitter card previews site-wide.
- `games/dragons-gate/thumbnail.png`
- `games/chaos-or-nah/thumbnail.png`
- `games/merge-meadow/thumbnail.png`

Until thumbnails exist, `components/GameCard.tsx` renders a colored placeholder tile
instead of an `<Image>`.
