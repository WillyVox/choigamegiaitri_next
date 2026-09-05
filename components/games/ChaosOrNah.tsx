'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface FruitLike { e: string; t: string; }
type Dilemma = [FruitLike, FruitLike];

// NOTE ON LOCALIZATION: the dilemma content below is intentionally English-only.
// Translating idiomatic/slangy humor well needs a human pass rather than a
// literal machine translation, so for now only the surrounding UI chrome
// (buttons, labels, hints) is localized via next-intl. To add a Vietnamese
// content pack later, add a `DILEMMAS_VI` array with the same shape and pick
// between them based on `useLocale()`.
const DILEMMAS: Dilemma[] = [
  [{ e: '📱', t: 'Reply with 17 emojis' }, { e: '✍️', t: 'Reply with just "k"' }],
  [{ e: '🧋', t: 'Iced coffee in a blizzard' }, { e: '☕', t: 'Hot chocolate in July' }],
  [{ e: '📺', t: 'Rewatch your comfort show again' }, { e: '🎬', t: 'Risk it on something new' }],
  [{ e: '🌙', t: 'Homework at 11pm, vibes immaculate' }, { e: '🌞', t: 'Homework right after school, dread immaculate' }],
  [{ e: '🎧', t: 'Same 5 songs on repeat forever' }, { e: '🎲', t: 'Shuffle and accept whatever plays' }],
  [{ e: '👻', t: 'Leave them on read for 3 days' }, { e: '📣', t: 'Reply instantly, no chill' }],
  [{ e: '🐌', t: 'Walk slow and see everything' }, { e: '🚀', t: 'Power walk everywhere, always late anyway' }],
  [{ e: '🍕', t: 'Cold pizza for breakfast' }, { e: '🥣', t: 'Cereal for dinner' }],
  [{ e: '📸', t: 'Take 40 selfies, post 1' }, { e: '🎥', t: 'Post the first one, no regrets' }],
  [{ e: '🛏️', t: 'Nap that ruins your whole night' }, { e: '😵', t: 'Push through, feel like a zombie' }],
  [{ e: '🧦', t: 'Mismatched socks on purpose' }, { e: '🩴', t: 'Socks with sandals, no shame' }],
  [{ e: '📚', t: 'Highlight literally everything' }, { e: '✏️', t: 'Highlight nothing, wing the exam' }],
  [{ e: '🐦', t: 'Overshare your feelings online' }, { e: '🔒', t: 'Never post a real feeling ever' }],
  [{ e: '🎮', t: "Rage quit and slam the controller" }, { e: '😐', t: 'Lose silently, internally combust' }],
  [{ e: '🚗', t: 'Aux cord chaos, no vetoes' }, { e: '🎙️', t: 'Podcast on every car ride' }],
  [{ e: '🍜', t: 'Instant noodles, extra spicy' }, { e: '🥪', t: 'Sandwich, extremely plain' }],
  [{ e: '🕺', t: "Dance like everyone's watching" }, { e: '🙈', t: 'Dance only when totally alone' }],
  [{ e: '📅', t: 'Plan every hour of the day' }, { e: '🌊', t: 'Vibes-based scheduling only' }],
  [{ e: '🐝', t: 'Scream and run from a bee' }, { e: '🧍', t: 'Freeze and pray it leaves' }],
  [{ e: '🎂', t: 'Announce your birthday for weeks' }, { e: '🤫', t: 'Tell literally no one' }],
  [{ e: '📖', t: 'Read the ending first, always' }, { e: '⏳', t: 'Wait, no matter how long the book' }],
  [{ e: '🧃', t: "Juice box, but you're 16" }, { e: '🥤', t: 'Giant soda, immediate regret' }],
  [{ e: '🚪', t: 'Ghost the group project' }, { e: '📢', t: 'Do it all yourself and complain' }],
  [{ e: '🌧️', t: 'Walk in the rain, no umbrella' }, { e: '☂️', t: 'Cancel plans over a drizzle' }]
];

const REACTIONS = [
  'bold choice.', 'unhinged. respect.', 'chaotic neutral energy.',
  'certified overthinker move.', 'big main character energy.',
  'the audacity, honestly.', 'we support this recklessness.',
  'okay that\'s actually valid.', 'no notes. iconic.',
  'you didn\'t even flinch.', 'peak indecisive energy.', 'the chaos is working.'
];

const BEST_KEY = 'chaos-or-nah:best-streak';
const DAILY_KEY = 'chaos-or-nah:daily-result';
const DAILY_EPOCH = new Date(2025, 0, 1);

function mulberry32(seed: number) {
  return function () {
    // eslint-disable-next-line no-param-reassign
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayNumber(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.round((d.getTime() - DAILY_EPOCH.getTime()) / 86400000) + 1;
}

function buildDailySet(dateStr: string): Dilemma[] {
  const rng = mulberry32(hashString(dateStr));
  const pool = DILEMMAS.map((_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 10).map((i) => DILEMMAS[i]);
}

export default function ChaosOrNah() {
  const t = useTranslations('chaosOrNah');
  const confettiLayerRef = useRef<HTMLDivElement>(null);
  const lastIndexRef = useRef(-1);

  const [mode, setMode] = useState<'endless' | 'daily'>('endless');

  // Endless mode state
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [round, setRound] = useState(1);
  const [current, setCurrent] = useState<Dilemma>(() => pickRandom());
  const [reaction, setReaction] = useState('');
  const [shareLabel, setShareLabel] = useState('');

  // Daily mode state
  const dailyDateStr = useRef(getTodayStr()).current;
  const dailyDayNumber = useRef(getDayNumber(dailyDateStr)).current;
  const dailySet = useRef(buildDailySet(dailyDateStr)).current;
  const [dailyIndex, setDailyIndex] = useState(0);
  const [dailyPicks, setDailyPicks] = useState<('L' | 'R')[]>([]);
  const [dailyDone, setDailyDone] = useState(false);
  const [dailyShareLabel, setDailyShareLabel] = useState('');

  function pickRandom(): Dilemma {
    let i: number;
    do { i = Math.floor(Math.random() * DILEMMAS.length); } while (i === lastIndexRef.current && DILEMMAS.length > 1);
    lastIndexRef.current = i;
    return DILEMMAS[i];
  }

  // Load best streak + today's daily result (if already played) on mount.
  useEffect(() => {
    try {
      const savedBest = window.localStorage.getItem(BEST_KEY);
      if (savedBest) setBest(parseInt(savedBest, 10) || 0);
    } catch { /* ignore */ }

    try {
      const savedDaily = window.localStorage.getItem(DAILY_KEY);
      if (savedDaily) {
        const parsed = JSON.parse(savedDaily);
        if (parsed.date === dailyDateStr && Array.isArray(parsed.picks)) {
          setDailyPicks(parsed.picks);
          setDailyDone(true);
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function burstConfetti() {
    const layer = confettiLayerRef.current;
    if (!layer) return;
    const colors = ['#ff6f5e', '#ffd23f', '#33b6a3', '#fff8ef'];
    for (let i = 0; i < 26; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.position = 'absolute';
      piece.style.top = '-12px';
      piece.style.width = '8px';
      piece.style.height = '14px';
      piece.style.borderRadius = '2px';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[i % colors.length];
      const duration = 1 + Math.random() * 0.8;
      piece.style.animation = `chaos-fall ${duration}s linear forwards`;
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), duration * 1000 + 50);
    }
  }

  function handleChoice() {
    const nextStreak = streak + 1;
    const nextRound = round + 1;
    setStreak(nextStreak);
    setRound(nextRound);
    setReaction(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);

    if (nextStreak > best) {
      setBest(nextStreak);
      try { window.localStorage.setItem(BEST_KEY, String(nextStreak)); } catch { /* ignore */ }
    }
    if (nextStreak % 5 === 0) burstConfetti();
    setCurrent(pickRandom());
  }

  function handleDailyChoice(side: 'L' | 'R') {
    const picks = [...dailyPicks, side];
    setDailyPicks(picks);
    if (dailyIndex + 1 >= dailySet.length) {
      setDailyDone(true);
      try {
        window.localStorage.setItem(DAILY_KEY, JSON.stringify({ date: dailyDateStr, picks }));
      } catch { /* ignore */ }
      burstConfetti();
    } else {
      setDailyIndex(dailyIndex + 1);
    }
  }

  function titleForPicks(picks: ('L' | 'R')[]) {
    const right = picks.filter((p) => p === 'R').length;
    const left = picks.length - right;
    if (left === picks.length) return 'Full Chaos Mode';
    if (right === picks.length) return 'Certified Overthinker';
    if (left > right) return 'Mostly Unhinged';
    if (right > left) return 'Suspiciously Reasonable';
    return 'Perfectly Balanced Chaos';
  }

  async function shareEndless() {
    const message = `I hit a ${streak}-streak on Chaos or Nah 🌀 my best is ${best}. Think you can beat it?`;
    try {
      await navigator.clipboard.writeText(message);
      setShareLabel(t('shareCopied'));
    } catch {
      setShareLabel(message);
    }
    setTimeout(() => setShareLabel(''), 2200);
  }

  async function shareDaily() {
    const gridEmojis = dailyPicks.map((p) => (p === 'L' ? '🟠' : '🟢')).join('');
    const right = dailyPicks.filter((p) => p === 'R').length;
    const left = dailyPicks.length - right;
    const message = `Chaos or Nah — Daily #${dailyDayNumber}\n${gridEmojis}\n${left} chaotic, ${right} reasonable. Beat my grid.`;
    try {
      await navigator.clipboard.writeText(message);
      setDailyShareLabel(t('shareCopied'));
    } catch {
      setDailyShareLabel(message);
    }
    setTimeout(() => setDailyShareLabel(''), 2200);
  }

  const dailyCurrent = dailySet[Math.min(dailyIndex, dailySet.length - 1)];
  const dailyRight = dailyPicks.filter((p) => p === 'R').length;
  const dailyLeft = dailyPicks.length - dailyRight;

  return (
    <div className="chaos-or-nah">
      <div className="mode-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'endless'} className={mode === 'endless' ? 'active' : ''} onClick={() => setMode('endless')}>
          {t('modeEndless')}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'daily'} className={mode === 'daily' ? 'active' : ''} onClick={() => setMode('daily')}>
          {t('modeDaily')}
        </button>
      </div>

      <div className="hud">
        <div className="stat"><span className="stat__value">{mode === 'endless' ? streak : dailyPicks.length}</span><span className="stat__label">{t('streak')}</span></div>
        <div className="stat"><span className="stat__value">{best}</span><span className="stat__label">{t('best')}</span></div>
      </div>

      {mode === 'endless' && (
        <div className="arena">
          <p className="round-tag">{t('roundLabel', { round })}</p>
          <div className="dilemma-card">
            <button className="option option--left" type="button" onClick={handleChoice}>
              <span className="option__emoji">{current[0].e}</span>
              <span className="option__text">{current[0].t}</span>
            </button>
            <div className="vs"><span>VS</span></div>
            <button className="option option--right" type="button" onClick={handleChoice}>
              <span className="option__emoji">{current[1].e}</span>
              <span className="option__text">{current[1].t}</span>
            </button>
          </div>
          <p className="reaction" aria-live="polite">{reaction || t('startHint')}</p>
          <button className="share-btn" type="button" onClick={shareEndless}>
            {shareLabel || t('shareScore')}
          </button>
        </div>
      )}

      {mode === 'daily' && !dailyDone && (
        <div className="arena">
          <p className="round-tag">{t('dailyRoundLabel', { day: dailyDayNumber, round: dailyIndex + 1 })}</p>
          <div className="dilemma-card">
            <button className="option option--left" type="button" onClick={() => handleDailyChoice('L')}>
              <span className="option__emoji">{dailyCurrent[0].e}</span>
              <span className="option__text">{dailyCurrent[0].t}</span>
            </button>
            <div className="vs"><span>VS</span></div>
            <button className="option option--right" type="button" onClick={() => handleDailyChoice('R')}>
              <span className="option__emoji">{dailyCurrent[1].e}</span>
              <span className="option__text">{dailyCurrent[1].t}</span>
            </button>
          </div>
          <p className="reaction">{t('dailyHint')}</p>
        </div>
      )}

      {mode === 'daily' && dailyDone && (
        <div className="arena">
          <p className="daily-heading">{titleForPicks(dailyPicks)}</p>
          <div className="daily-grid">
            {dailyPicks.map((p, i) => (
              <span key={i} className="daily-square" style={{ background: p === 'L' ? '#ff6f5e' : '#33b6a3' }} />
            ))}
          </div>
          <p className="daily-tally">{dailyLeft} chaotic picks, {dailyRight} reasonable ones.</p>
          <button className="share-btn" type="button" onClick={shareDaily}>
            {dailyShareLabel || t('shareDaily')}
          </button>
          <p className="daily-note">{t('dailyNote')}</p>
        </div>
      )}

      <div ref={confettiLayerRef} className="confetti-layer" aria-hidden="true" />

      <style jsx global>{`
        @keyframes chaos-fall {
          to { transform: translateY(105vh) rotate(360deg); opacity: 0.15; }
        }
      `}</style>

      <style jsx>{`
        .chaos-or-nah {
          --bg-deep: #221731;
          --paper: #fff8ef;
          --ink: #241934;
          --coral: #ff6f5e;
          --mint: #33b6a3;
          --sun: #ffd23f;
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
          padding: 20px;
          border-radius: 24px;
          background: radial-gradient(circle at 12% 8%, #33204a, transparent 55%), radial-gradient(circle at 88% 92%, #33204a, transparent 50%), var(--bg-deep);
          color: var(--paper);
          text-align: center;
        }
        .mode-tabs {
          display: inline-flex;
          gap: 4px;
          background: rgba(255, 248, 239, 0.08);
          padding: 4px;
          border-radius: 999px;
          margin-bottom: 16px;
        }
        .mode-tabs button {
          border: none;
          background: transparent;
          color: rgba(255, 248, 239, 0.65);
          padding: 8px 18px;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
        }
        .mode-tabs button.active {
          background: var(--sun);
          color: var(--ink);
        }
        .hud {
          display: flex;
          justify-content: center;
          gap: 14px;
          margin-bottom: 20px;
        }
        .stat {
          background: rgba(255, 248, 239, 0.08);
          border-radius: 14px;
          padding: 6px 14px;
          min-width: 56px;
        }
        .stat__value {
          display: block;
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--sun);
        }
        .stat__label {
          display: block;
          font-size: 0.68rem;
          color: rgba(255, 248, 239, 0.65);
        }
        .round-tag {
          font-size: 0.85rem;
          color: rgba(255, 248, 239, 0.7);
        }
        .dilemma-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 14px;
          position: relative;
        }
        .option {
          border: 3px solid var(--ink);
          border-radius: 22px;
          padding: 24px 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.28);
          cursor: pointer;
        }
        .option:active { transform: translate(4px, 4px); box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.28); }
        .option--left { background: var(--coral); }
        .option--right { background: var(--mint); }
        .option__emoji { font-size: 1.8rem; }
        .option__text { font-size: 1rem; font-weight: 600; color: var(--ink); line-height: 1.3; }
        .vs {
          align-self: center;
          background: var(--sun);
          color: var(--ink);
          width: 46px;
          height: 46px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          border: 3px solid var(--ink);
          transform: rotate(-8deg);
          margin: -4px auto;
        }
        @media (min-width: 520px) {
          .dilemma-card { flex-direction: row; }
          .option { flex: 1; }
          .vs { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-8deg); }
        }
        .reaction { min-height: 1.4em; margin: 18px 0 6px; color: var(--sun); font-size: 0.95rem; }
        .share-btn, .daily-note ~ .share-btn {
          margin-top: 8px;
          background: transparent;
          border: 2px solid rgba(255, 248, 239, 0.5);
          color: var(--paper);
          padding: 10px 20px;
          border-radius: 999px;
          cursor: pointer;
        }
        .daily-heading { font-size: 1.3rem; font-weight: 700; color: var(--sun); margin: 8px 0 4px; }
        .daily-grid { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin: 18px 0 10px; }
        .daily-square { width: 32px; height: 32px; border-radius: 8px; border: 2px solid var(--ink); }
        .daily-tally { color: rgba(255, 248, 239, 0.78); font-size: 0.92rem; }
        .daily-note { color: rgba(255, 248, 239, 0.5); font-size: 0.8rem; margin-top: 14px; }
        .confetti-layer { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 60; }
      `}</style>
    </div>
  );
}
