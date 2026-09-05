# choigamegiaitri.com

Next.js (App Router) rewrite of the site: three free browser games — **Dragon's Gate**,
**Chaos or Nah?**, and **Merge Meadow** — behind a bilingual (Vietnamese/English) hub,
built for SEO and ad monetization from day one.

## Getting started

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — it will redirect to `/en` or `/vi` depending on your
browser's language and (in production) your detected country.

## Project structure

```
app/
  [locale]/
    layout.tsx          — html/body shell, SEO metadata, AdSense loader, header/footer
    page.tsx             — homepage / game dashboard
    about/page.tsx
    privacy/page.tsx
    games/[slug]/page.tsx — renders the right game component + related games + ad slots
  sitemap.ts             — auto-generated from lib/games.ts, both locales
  robots.ts
components/
  Header.tsx, Footer.tsx, LanguageSwitcher.tsx, GameCard.tsx, AdSlot.tsx
  games/
    DragonsGate.tsx
    ChaosOrNah.tsx
    MergeMeadow.tsx
lib/
  games.ts               — single source of truth for every game's metadata
messages/
  en.json, vi.json        — all UI copy, keyed by feature area
middleware.ts            — locale auto-detection (see below)
i18n.ts                  — next-intl config (supported locales, message loader)
```

## How language detection works

On a visitor's first request, `middleware.ts` decides the locale in this order:

1. **Returning visitor** — if a `NEXT_LOCALE` cookie exists from a previous visit or a
   manual switch, that wins, full stop.
2. **Vietnam by IP** — if the request's country is `VN`, Vietnamese is chosen.
   This reads `request.geo.country` (populated automatically on Vercel) and falls
   back to common CDN headers (`x-vercel-ip-country`, `cf-ipcountry`). **If you deploy
   somewhere other than Vercel without a CDN that sets one of these headers, this
   check will simply be skipped** and step 3 decides instead — geo-IP without a
   platform/CDN doing the lookup for you isn't something Next.js does on its own.
3. **Accept-Language header** — if the browser reports Vietnamese, use it.
4. **Default** — English.

The chosen locale is written back as a cookie (1 year) so the *next* visit skips
straight to step 1. The `LanguageSwitcher` component also mirrors the choice into
`localStorage` for any client code that wants to read it without a server round-trip,
but the cookie is the actual source of truth the middleware reads.

## SEO

- Per-locale, per-page `generateMetadata`: titles, descriptions, `hreflang` alternates
  (`en`, `vi`, `x-default`), Open Graph, Twitter cards.
- JSON-LD: `ItemList` on the homepage, `VideoGame` on each game page.
- `app/sitemap.ts` and `app/robots.ts` are generated from `lib/games.ts`, so every new
  game you register automatically gets a sitemap entry in both languages.
- `/about` and `/privacy` pages exist mainly for trust signals — both Google and ad
  networks (AdSense in particular) expect them.
- Replace `/public/og-image.jpg` with a real 1200×630 image before launch, and add a
  Google Search Console verification token in `app/[locale]/layout.tsx` once you have one.

## Ads

`components/AdSlot.tsx` renders a clearly labeled placeholder everywhere an ad should
go (homepage banner + rectangle, every game page's banner + rectangle, and inside each
game's own UI — e.g. Merge Meadow's game-over panel). Comments inside that file show
exactly how to swap in a real Google AdSense unit once you have a publisher ID; set
`NEXT_PUBLIC_ADSENSE_CLIENT_ID` in `.env` and the loader script in the root layout
activates automatically.

## Adding a new game

1. Build it as a `'use client'` React component under `components/games/`.
2. Add its metadata (name/tagline/description in both locales, thumbnail, genre) to
   `lib/games.ts`.
3. Map its slug to the component in `app/[locale]/games/[slug]/page.tsx`
   (`componentMap`).

The dashboard, sitemap, related-games sections, and SEO metadata all pick it up with
no further changes.

## Known scope limits, worth knowing about

- **Dragon's Gate** has its on-screen text (title, buttons, HUD labels) fully
  localized via the `dragonsGate` message namespace.
- **Chaos or Nah?**'s and **Merge Meadow**'s surrounding UI (buttons, hints, labels)
  is localized, but the actual game *content* — Chaos or Nah's dilemma text, Merge
  Meadow's fruit names — is English-only. Translating slang/humor well needs a human
  pass, not a literal machine translation, so it was left out of scope here. To add a
  Vietnamese content pack later: create a `DILEMMAS_VI` array with the same shape in
  `ChaosOrNah.tsx` and pick between them with `useLocale()`.
- Best scores and daily-challenge results are stored in the browser's `localStorage`
  (per-device, not synced across devices — there's no backend/database in this
  project).
- Thumbnails in `lib/games.ts` point at `/public/games/<slug>/thumbnail.png`, which
  don't exist yet — `GameCard.tsx` currently renders a colored placeholder tile
  instead. Drop real screenshots in and swap the placeholder for a Next.js `<Image>`.
