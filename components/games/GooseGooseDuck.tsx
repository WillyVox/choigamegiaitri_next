'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/* =====================================================================
   GOOSE GOOSE DUCK — hyper-casual "find the duck" hidden-object game.
   Ported from a vanilla-JS single-file prototype. Game bookkeeping that
   doesn't need to trigger a re-render (timers, running totals) lives in
   refs, mirroring the original imperative `state` object; anything the
   UI reads lives in React state, synced from those refs after each
   mutation via syncHud()/commitTiles(). Ad blocks are simulated
   placeholders — swap in real AdSense/AdMob calls where marked TODO.
   ===================================================================== */

type LoseReason = 'time' | 'suspicion' | 'moves';
type Overlay = 'win' | 'lose' | 'inter' | 'reward' | null;

interface Tile {
  id: number;
  isDuck: boolean;
  found: boolean;
  wrong: boolean;
  covered: boolean;
  rotation: number;
  delay: number;
}

interface LevelConfig {
  cols: number;
  rows: number;
  total: number;
  ducks: number;
  baseTime: number;
  movesLimit: number | null;
  suspicionDrift: number;
  wrongPenalty: number;
  hasSweep: boolean;
}

const AD_MIN_GAP_MS = 75000; // 75s, within the 60-90s pacing rule

function getLevelConfig(level: number): LevelConfig {
  let cols: number;
  let rows: number;
  if (level <= 2) {
    cols = 3;
    rows = 3;
  } else if (level <= 5) {
    cols = 4;
    rows = 4;
  } else if (level <= 8) {
    cols = 5;
    rows = 4;
  } else if (level <= 12) {
    cols = 5;
    rows = 5;
  } else {
    cols = 6;
    rows = 5;
  }
  const total = cols * rows;
  const ducks = Math.min(1 + Math.floor(level / 3), Math.max(2, Math.floor(total / 5)));
  const baseTime = Math.max(12, 42 - level * 2);
  // Moves-limit removed: it was the only mechanic that could end a level in a
  // *loss* even after the player had gone on to tap every duck correctly
  // (it only checked "did I run out of taps", not "did I actually fail").
  // It also happened to be the first new mechanic to switch on at level 6,
  // which is why the "stuck at level 6" reports started there. Keeping the
  // field (always null) instead of deleting it everywhere else that reads it.
  const movesLimit = null;
  const suspicionDrift = level >= 6 ? Math.min(4, Math.floor((level - 5) / 3) + 1) : 0;
  const wrongPenalty = Math.min(32, 12 + level);
  const hasSweep = level >= 8;
  return { cols, rows, total, ducks, baseTime, movesLimit, suspicionDrift, wrongPenalty, hasSweep };
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function GooseGooseDuck() {
  const t = useTranslations('gooseGooseDuck');

  const [screen, setScreen] = useState<'start' | 'playing'>('start');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [hud, setHud] = useState({ level: 1, score: 0, timeLeft: 30, timeTotal: 30, suspicion: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [winInfo, setWinInfo] = useState({ level: 1, score: 0 });
  const [loseInfo, setLoseInfo] = useState<{ reason: LoseReason; score: number; best: number; canRevive: boolean }>({
    reason: 'time',
    score: 0,
    best: 0,
    canRevive: true
  });
  const [interState, setInterState] = useState({ count: 5, skippable: false });
  const [rewardState, setRewardState] = useState({ count: 20 });
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Bookkeeping that doesn't need to re-render on its own.
  const cfgRef = useRef<LevelConfig | null>(null);
  const tilesRef = useRef<Tile[]>([]);
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const ducksTotalRef = useRef(0);
  const ducksFoundRef = useRef(0);
  const suspicionRef = useRef(0);
  const timeLeftRef = useRef(30);
  const timeTotalRef = useRef(30);
  const movesLeftRef = useRef<number | null>(null);
  const revivedRef = useRef(false);
  const lastAdTimeRef = useRef(-999999);
  const pendingAfterAdRef = useRef<(() => void) | null>(null);

  const tickHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sweepHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rewardHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (tickHandleRef.current) clearInterval(tickHandleRef.current);
    if (sweepHandleRef.current) clearInterval(sweepHandleRef.current);
    if (interHandleRef.current) clearInterval(interHandleRef.current);
    if (rewardHandleRef.current) clearInterval(rewardHandleRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  useEffect(() => clearAllTimers, [clearAllTimers]);

  const syncHud = useCallback(() => {
    setHud({
      level: levelRef.current,
      score: scoreRef.current,
      timeLeft: Math.max(0, timeLeftRef.current),
      timeTotal: timeTotalRef.current,
      suspicion: suspicionRef.current
    });
  }, []);

  const commitTiles = useCallback((next: Tile[]) => {
    tilesRef.current = next;
    setTiles(next);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1400);
  }, []);

  const endLevel = useCallback(
    (won: boolean, reason?: LoseReason) => {
      if (tickHandleRef.current) clearInterval(tickHandleRef.current);
      if (sweepHandleRef.current) clearInterval(sweepHandleRef.current);

      if (won) {
        const bonus = timeLeftRef.current * 2;
        scoreRef.current += bonus;
        setWinInfo({
          level: levelRef.current,
          score: 10 * ducksTotalRef.current * levelRef.current + bonus
        });
        setOverlay('win');
      } else {
        bestRef.current = Math.max(bestRef.current, scoreRef.current);
        setLoseInfo({
          reason: reason ?? 'time',
          score: scoreRef.current,
          best: bestRef.current,
          canRevive: !revivedRef.current
        });
        setOverlay('lose');
      }
      syncHud();
    },
    [syncHud]
  );

  const tick = useCallback(() => {
    timeLeftRef.current -= 1;
    const cfg = cfgRef.current;
    if (cfg && cfg.suspicionDrift > 0) {
      suspicionRef.current = Math.min(100, suspicionRef.current + cfg.suspicionDrift);
    }
    syncHud();
    if (timeLeftRef.current <= 0) return endLevel(false, 'time');
    if (suspicionRef.current >= 100) return endLevel(false, 'suspicion');
  }, [endLevel, syncHud]);

  const sweepObstacle = useCallback(() => {
    const candidates = tilesRef.current.filter((tl) => !tl.found && !tl.covered);
    if (!candidates.length) return;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    commitTiles(tilesRef.current.map((tl) => (tl.id === target.id ? { ...tl, covered: true } : tl)));
    showToast(t('sweepToast'));
    setTimeout(() => {
      commitTiles(tilesRef.current.map((tl) => (tl.id === target.id ? { ...tl, covered: false } : tl)));
    }, 1200);
  }, [commitTiles, showToast, t]);

  const buildLevel = useCallback(() => {
    const cfg = getLevelConfig(levelRef.current);
    cfgRef.current = cfg;
    ducksTotalRef.current = cfg.ducks;
    ducksFoundRef.current = 0;
    suspicionRef.current = 0;
    timeTotalRef.current = cfg.baseTime;
    timeLeftRef.current = cfg.baseTime;
    movesLeftRef.current = cfg.movesLimit;

    const idxs = shuffle([...Array(cfg.total).keys()]);
    const duckSet = new Set(idxs.slice(0, cfg.ducks));

    const newTiles: Tile[] = [];
    for (let i = 0; i < cfg.total; i++) {
      newTiles.push({
        id: i,
        isDuck: duckSet.has(i),
        found: false,
        wrong: false,
        covered: false,
        rotation: Number((Math.random() * 10 - 5).toFixed(1)),
        delay: i * 15
      });
    }
    commitTiles(newTiles);
    syncHud();

    if (tickHandleRef.current) clearInterval(tickHandleRef.current);
    if (sweepHandleRef.current) clearInterval(sweepHandleRef.current);
    tickHandleRef.current = setInterval(tick, 1000);
    if (cfg.hasSweep) {
      sweepHandleRef.current = setInterval(sweepObstacle, 3600);
    }
  }, [commitTiles, sweepObstacle, syncHud, tick]);

  const startGame = useCallback(
    (level: number) => {
      setOverlay(null);
      levelRef.current = level;
      revivedRef.current = false;
      buildLevel();
      setScreen('playing');
    },
    [buildLevel]
  );

  const handleTap = useCallback(
    (id: number) => {
      const tile = tilesRef.current.find((tl) => tl.id === id);
      if (!tile || tile.found || tile.covered) return;
      const cfg = cfgRef.current;
      if (!cfg) return;

      if (movesLeftRef.current !== null) movesLeftRef.current -= 1;

      if (tile.isDuck) {
        const nextTiles = tilesRef.current.map((tl) => (tl.id === id ? { ...tl, found: true } : tl));
        commitTiles(nextTiles);
        // Derive the found-count from the tiles we just committed rather than
        // trusting a separately-incremented ref — this can never drift out of
        // sync with what's actually on screen, so "all ducks tapped" always
        // reliably triggers the win.
        ducksFoundRef.current = nextTiles.filter((tl) => tl.isDuck && tl.found).length;
        const gained = 10 * levelRef.current;
        scoreRef.current += gained;
        suspicionRef.current = Math.max(0, suspicionRef.current - 5);
        showToast(t('caughtToast', { points: gained }));
      } else {
        commitTiles(tilesRef.current.map((tl) => (tl.id === id ? { ...tl, wrong: true } : tl)));
        setTimeout(() => {
          commitTiles(tilesRef.current.map((tl) => (tl.id === id ? { ...tl, wrong: false } : tl)));
        }, 350);
        suspicionRef.current = Math.min(100, suspicionRef.current + cfg.wrongPenalty);
      }

      syncHud();

      if (ducksFoundRef.current >= ducksTotalRef.current) return endLevel(true);
      if (suspicionRef.current >= 100) return endLevel(false, 'suspicion');
      // Moves-limit mechanic removed (see getLevelConfig) — movesLeftRef.current
      // will always be null now, so this branch is permanently dormant. Left in
      // place in case a designer wants to re-enable a (non-fatal) moves display
      // later; it can no longer end a level.
      if (movesLeftRef.current !== null && movesLeftRef.current <= 0 && ducksFoundRef.current < ducksTotalRef.current) {
        return endLevel(false, 'moves');
      }
    },
    [commitTiles, endLevel, showToast, syncHud, t]
  );

  const showRewardedAd = useCallback((onReward: () => void) => {
    setOverlay('reward');
    let count = 15 + Math.floor(Math.random() * 16); // 15-30s
    setRewardState({ count });
    if (rewardHandleRef.current) clearInterval(rewardHandleRef.current);
    rewardHandleRef.current = setInterval(() => {
      count -= 1;
      setRewardState({ count });
      if (count <= 0) {
        if (rewardHandleRef.current) clearInterval(rewardHandleRef.current);
        setOverlay(null);
        onReward();
      }
    }, 1000);
    // TODO(real integration): request AdMob/AdSense rewarded unit,
    // call onReward() only from the "user earned reward" callback.
  }, []);

  const maybeShowInterstitial = useCallback((after: () => void) => {
    const now = Date.now();
    if (now - lastAdTimeRef.current < AD_MIN_GAP_MS) {
      after(); // respect the 60-90s spacing rule: skip ad, just continue
      return;
    }
    lastAdTimeRef.current = now;
    pendingAfterAdRef.current = after;
    setOverlay('inter');
    let count = 5;
    setInterState({ count, skippable: false });
    if (interHandleRef.current) clearInterval(interHandleRef.current);
    interHandleRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        if (interHandleRef.current) clearInterval(interHandleRef.current);
        setInterState({ count: 0, skippable: true });
      } else {
        setInterState({ count, skippable: false });
      }
    }, 1000);
    // TODO(real integration): call AdMob/AdSense interstitial show(),
    // then closeInterstitial() from its close callback.
  }, []);

  const closeInterstitial = useCallback(() => {
    setOverlay(null);
    const fn = pendingAfterAdRef.current;
    pendingAfterAdRef.current = null;
    if (fn) fn();
  }, []);

  const proceedNextLevel = useCallback(() => {
    setOverlay(null);
    maybeShowInterstitial(() => {
      levelRef.current += 1;
      revivedRef.current = false;
      buildLevel();
    });
  }, [buildLevel, maybeShowInterstitial]);

  const backToMenuFlow = useCallback(() => {
    setOverlay(null);
    maybeShowInterstitial(() => {
      levelRef.current = 1;
      scoreRef.current = 0;
      setScreen('start');
    });
  }, [maybeShowInterstitial]);

  const usePowerup = useCallback(
    (type: 'hint' | 'shield' | 'time') => {
      showRewardedAd(() => {
        if (type === 'hint') {
          const duck = tilesRef.current.find((tl) => tl.isDuck && !tl.found);
          if (duck) {
            setHighlightId(duck.id);
            showToast(t('hintToast'));
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            highlightTimerRef.current = setTimeout(() => setHighlightId(null), 1500);
          } else {
            showToast(t('hintNoneToast'));
          }
        } else if (type === 'shield') {
          suspicionRef.current = Math.max(0, suspicionRef.current - 40);
          showToast(t('shieldToast'));
          syncHud();
        } else if (type === 'time') {
          timeLeftRef.current += 10;
          timeTotalRef.current += 10;
          showToast(t('timeToast'));
          syncHud();
        }
      });
    },
    [showRewardedAd, showToast, syncHud, t]
  );

  const offerDoubleScore = useCallback(() => {
    showRewardedAd(() => {
      scoreRef.current += 10 * ducksTotalRef.current * levelRef.current;
      showToast(t('doubleToast'));
      proceedNextLevel();
    });
  }, [proceedNextLevel, showRewardedAd, showToast, t]);

  const offerRevive = useCallback(() => {
    showRewardedAd(() => {
      revivedRef.current = true;
      suspicionRef.current = 0;
      timeLeftRef.current = Math.max(10, Math.round(timeTotalRef.current / 2));
      setOverlay(null);
      syncHud();
      if (tickHandleRef.current) clearInterval(tickHandleRef.current);
      tickHandleRef.current = setInterval(tick, 1000);
      if (cfgRef.current?.hasSweep) {
        if (sweepHandleRef.current) clearInterval(sweepHandleRef.current);
        sweepHandleRef.current = setInterval(sweepObstacle, 3600);
      }
      showToast(t('reviveToast'));
    });
  }, [showRewardedAd, showToast, suspicionRef, sweepObstacle, syncHud, t, tick]);

  const cfg = cfgRef.current;
  const timePct = hud.timeTotal > 0 ? Math.max(0, Math.min(100, (hud.timeLeft / hud.timeTotal) * 100)) : 100;
  const loseMsg: Record<LoseReason, { emoji: string; title: string }> = {
    time: { emoji: '⏰', title: t('loseTimeTitle') },
    suspicion: { emoji: '🚨', title: t('loseSuspicionTitle') },
    moves: { emoji: '🐾', title: t('loseMovesTitle') }
  };

  return (
    <div className="ggd-frame">
      <div className="ggd-hud">
        <div className="ggd-hud-top">
          <div className="ggd-stat">
            🎮 {t('levelShort')} <b>{hud.level}</b>
          </div>
          <div className="ggd-stat">
            ⭐ <b>{hud.score}</b>
          </div>
        </div>
        <div className="ggd-time-row">
          ⏱ <span>{hud.timeLeft}</span>s
          <div className="ggd-bar-track">
            <div
              className="ggd-bar-fill"
              style={{ width: `${timePct}%`, background: timePct < 25 ? 'var(--ggd-alert)' : '#fff' }}
            />
          </div>
        </div>
        <div className="ggd-sus-row">
          🚨
          <div className="ggd-bar-track">
            <div
              className="ggd-bar-fill"
              style={{
                width: `${hud.suspicion}%`,
                background:
                  hud.suspicion > 70 ? 'var(--ggd-alert)' : hud.suspicion > 35 ? 'var(--ggd-bill)' : 'var(--ggd-grass)'
              }}
            />
          </div>
        </div>
      </div>

      <div className="ggd-stage">
        <div className="ggd-grid" style={{ gridTemplateColumns: cfg ? `repeat(${cfg.cols}, 1fr)` : undefined }}>
          {tiles.map((tile) => (
            <div
              key={tile.id}
              className={[
                'ggd-tile',
                tile.found && 'is-found',
                tile.wrong && 'is-wrong',
                tile.covered && 'is-covered',
                highlightId === tile.id && 'is-hint'
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ animation: `ggdPopIn .35s ${tile.delay}ms both`, transform: `rotate(${tile.rotation}deg)` }}
              onClick={() => handleTap(tile.id)}
            >
              {tile.covered ? null : tile.isDuck ? '🦆' : '🪿'}
              {tile.found && <span className="ggd-mark">✔️</span>}
            </div>
          ))}
        </div>
        <div className={`ggd-toast${toast ? ' is-show' : ''}`}>{toast}</div>
      </div>

      <div className="ggd-powerbar">
        <div className="ggd-pwr" onClick={() => usePowerup('hint')}>
          <span className="ggd-ic">💡</span>
          {t('hint')}
        </div>
        <div className="ggd-pwr" onClick={() => usePowerup('shield')}>
          <span className="ggd-ic">🛡️</span>
          {t('shield')}
        </div>
        <div className="ggd-pwr" onClick={() => usePowerup('time')}>
          <span className="ggd-ic">⏳</span>
          {t('extraTime')}
        </div>
      </div>

      <div className="ggd-adbanner">{t('adBanner')}</div>

      {screen === 'start' && !overlay && (
        <div className="ggd-overlay">
          <div className="ggd-card">
            <span className="ggd-big-emoji">🦆🪿🪿</span>
            <h2>{t('title')}</h2>
            <p>{t('intro')}</p>
            <div className="ggd-badges">
              <span>{t('badgeOneTap')}</span>
              <span>{t('badgeCurve')}</span>
              <span>{t('badgeRelax')}</span>
            </div>
            <button className="ggd-btn ggd-btn-primary" onClick={() => startGame(1)}>
              {t('start')}
            </button>
          </div>
        </div>
      )}

      {overlay === 'win' && (
        <div className="ggd-overlay">
          <div className="ggd-card">
            <span className="ggd-big-emoji">🎉</span>
            <h2>{t('winTitle', { level: winInfo.level })}</h2>
            <p>{t('winDesc', { score: winInfo.score })}</p>
            <button className="ggd-btn ggd-btn-gold" onClick={offerDoubleScore}>
              {t('doubleAdBtn')}
            </button>
            <button className="ggd-btn ggd-btn-primary" onClick={proceedNextLevel}>
              {t('nextLevelBtn')}
            </button>
          </div>
        </div>
      )}

      {overlay === 'lose' && (
        <div className="ggd-overlay">
          <div className="ggd-card">
            <span className="ggd-big-emoji">{loseMsg[loseInfo.reason].emoji}</span>
            <h2>{loseMsg[loseInfo.reason].title}</h2>
            <p>{t('loseScoreLine', { score: loseInfo.score, best: loseInfo.best })}</p>
            {loseInfo.canRevive && (
              <button className="ggd-btn ggd-btn-gold" onClick={offerRevive}>
                {t('reviveBtn')}
              </button>
            )}
            <button className="ggd-btn ggd-btn-primary" onClick={backToMenuFlow}>
              {t('restartBtn')}
            </button>
          </div>
        </div>
      )}

      {overlay === 'inter' && (
        <div className="ggd-overlay">
          <div className="ggd-adcard">
            <div className="ggd-adscreen">
              <span className="ggd-adtag">{t('adBadge')}</span>
              <div style={{ fontSize: 34 }}>📢</div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{t('interSponsor')}</div>
            </div>
            <div className="ggd-adfoot">
              <span>{interState.skippable ? t('interReady') : t('interSkippableIn', { sec: interState.count })}</span>
              <button
                className="ggd-btn ggd-btn-primary ggd-btn-inline"
                disabled={!interState.skippable}
                onClick={closeInterstitial}
              >
                {t('interSkip')}
              </button>
            </div>
          </div>
        </div>
      )}

      {overlay === 'reward' && (
        <div className="ggd-overlay">
          <div className="ggd-adcard">
            <div className="ggd-adscreen">
              <span className="ggd-adtag">{t('rewardTitle')}</span>
              <div className="ggd-adring" />
              <div style={{ marginTop: 12, fontWeight: 700 }}>{t('rewardPlaying', { sec: rewardState.count })}</div>
            </div>
            <div className="ggd-adfoot ggd-adfoot-center">
              <span style={{ opacity: 0.7 }}>{t('rewardNote')}</span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ggd-frame {
          --ggd-sky: #eaf6f4;
          --ggd-pond: #2fa6a6;
          --ggd-pond-dark: #1c7373;
          --ggd-grass: #7fc95b;
          --ggd-bill: #f5a623;
          --ggd-ink: #173238;
          --ggd-alert: #e85d4e;
          --ggd-cream: #fff8ec;
          --ggd-line: rgba(23, 50, 56, 0.1);
          position: relative;
          width: min(430px, 100%);
          aspect-ratio: 9 / 16;
          max-height: 90vh;
          margin: 0 auto;
          background: linear-gradient(180deg, #fbfffc 0%, var(--ggd-sky) 100%);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 28px;
          box-shadow: 0 30px 80px rgba(20, 60, 60, 0.25);
          font-family: 'Nunito', sans-serif;
          color: var(--ggd-ink);
        }

        .ggd-hud {
          padding: 12px 14px 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 0 0 auto;
          background: var(--ggd-pond);
          color: #fff;
          border-bottom-left-radius: 22px;
          border-bottom-right-radius: 22px;
          box-shadow: 0 6px 14px rgba(20, 60, 60, 0.12);
          z-index: 5;
        }
        .ggd-hud-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ggd-stat {
          font-family: 'Fredoka', sans-serif;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ggd-stat b {
          font-size: 17px;
        }
        .ggd-time-row,
        .ggd-sus-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
        }
        .ggd-bar-track {
          flex: 1;
          height: 9px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.28);
          overflow: hidden;
        }
        .ggd-bar-fill {
          height: 100%;
          border-radius: 6px;
          transition: width 0.25s linear, background-color 0.3s;
        }

        .ggd-stage {
          flex: 1 1 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          min-height: 0;
          position: relative;
        }
        .ggd-grid {
          display: grid;
          gap: 8px;
          width: 100%;
        }
        .ggd-tile {
          position: relative;
          aspect-ratio: 1 / 1;
          border-radius: 16px;
          background: var(--ggd-cream);
          border: 2px solid var(--ggd-line);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: min(9vw, 34px);
          cursor: pointer;
          user-select: none;
          transition: transform 0.12s ease, background 0.2s, border-color 0.2s;
        }
        .ggd-tile:active {
          transform: scale(0.88);
        }
        .ggd-tile.is-found {
          background: #ddf5e3;
          border-color: var(--ggd-grass);
          cursor: default;
        }
        .ggd-tile.is-wrong {
          animation: ggdShake 0.35s;
        }
        .ggd-tile.is-covered {
          background: var(--ggd-pond-dark);
          color: transparent;
        }
        .ggd-tile.is-covered::after {
          content: '👁';
          color: #fff;
          font-size: min(7vw, 26px);
        }
        .ggd-tile.is-hint {
          outline: 3px solid var(--ggd-bill);
        }
        .ggd-mark {
          position: absolute;
          top: -6px;
          right: -6px;
          font-size: 16px;
        }
        @keyframes ggdShake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-6px);
            background: #fbdeda;
          }
          75% {
            transform: translateX(6px);
            background: #fbdeda;
          }
        }
        @keyframes ggdPopIn {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .ggd-powerbar {
          flex: 0 0 auto;
          display: flex;
          gap: 8px;
          padding: 0 14px 10px;
        }
        .ggd-pwr {
          flex: 1;
          background: #fff;
          border: 2px solid var(--ggd-line);
          border-radius: 14px;
          padding: 8px 4px;
          text-align: center;
          font-family: 'Fredoka', sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: var(--ggd-ink);
          cursor: pointer;
          line-height: 1.3;
        }
        .ggd-pwr:active {
          transform: scale(0.94);
        }
        .ggd-ic {
          font-size: 20px;
          display: block;
        }

        .ggd-adbanner {
          flex: 0 0 auto;
          height: 50px;
          margin: 0 auto 6px;
          width: min(320px, calc(100% - 20px));
          background: repeating-linear-gradient(135deg, #dfe7e7, #dfe7e7 10px, #eef3f3 10px, #eef3f3 20px);
          border: 1px dashed #9fb3b3;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #5c7373;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .ggd-overlay {
          position: absolute;
          inset: 0;
          background: rgba(12, 30, 34, 0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 20;
          animation: ggdFadeOv 0.25s ease both;
        }
        @keyframes ggdFadeOv {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .ggd-card {
          background: var(--ggd-cream);
          border-radius: 22px;
          padding: 26px 22px;
          width: 100%;
          max-width: 320px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
        }
        .ggd-card h2 {
          font-family: 'Fredoka', sans-serif;
          margin: 4px 0 6px;
          font-size: 24px;
          color: var(--ggd-pond-dark);
        }
        .ggd-card p {
          margin: 4px 0 16px;
          font-size: 14px;
          color: #43585d;
          line-height: 1.5;
        }
        .ggd-big-emoji {
          font-size: 52px;
          display: block;
          margin-bottom: 4px;
        }
        .ggd-badges {
          display: flex;
          gap: 6px;
          justify-content: center;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .ggd-badges span {
          background: #fff;
          border: 1px solid var(--ggd-line);
          border-radius: 20px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 700;
          color: var(--ggd-pond-dark);
        }
        .ggd-btn {
          display: block;
          width: 100%;
          padding: 13px;
          border: none;
          border-radius: 14px;
          font-family: 'Fredoka', sans-serif;
          font-size: 15px;
          font-weight: 600;
          margin-top: 10px;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .ggd-btn:active {
          transform: scale(0.96);
        }
        .ggd-btn-primary {
          background: var(--ggd-pond);
          color: #fff;
        }
        .ggd-btn-gold {
          background: var(--ggd-bill);
          color: #fff;
        }
        .ggd-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .ggd-btn-inline {
          width: auto;
          margin: 0;
          padding: 8px 14px;
        }

        .ggd-adcard {
          background: #111;
          color: #fff;
          border-radius: 18px;
          width: 100%;
          max-width: 320px;
          padding: 0;
          overflow: hidden;
          text-align: center;
        }
        .ggd-adscreen {
          height: 220px;
          background: linear-gradient(135deg, #2fa6a6, #173238);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Fredoka', sans-serif;
          position: relative;
        }
        .ggd-adtag {
          position: absolute;
          top: 14px;
          left: 14px;
          font-size: 10px;
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 8px;
          border-radius: 20px;
        }
        .ggd-adfoot {
          padding: 14px;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .ggd-adfoot-center {
          justify-content: center;
        }
        .ggd-adring {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: 4px solid rgba(255, 255, 255, 0.25);
          border-top-color: #fff;
          animation: ggdSpin 1s linear infinite;
        }
        @keyframes ggdSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .ggd-toast {
          position: absolute;
          left: 50%;
          bottom: 20px;
          transform: translate(-50%, 20px);
          background: var(--ggd-ink);
          color: #fff;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          opacity: 0;
          transition: opacity 0.3s, transform 0.3s;
          z-index: 30;
          pointer-events: none;
          white-space: nowrap;
        }
        .ggd-toast.is-show {
          opacity: 1;
          transform: translate(-50%, 0);
        }
      `}</style>
    </div>
  );
}