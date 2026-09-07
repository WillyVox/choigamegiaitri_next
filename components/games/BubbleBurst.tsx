'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const VW = 480;
const VH = 800;
const STORAGE_KEY = 'bubbleburst_highscore';
const MUTE_KEY = 'bubbleburst_muted';

const COLORS = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#3742fa', '#e84393'];
const COMBO_NOTES = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];

const INTERSTITIAL_MIN_GAP_MS = 60_000;
const REWARDED_POWERUP_COOLDOWN_MS = 30_000;

function simulateInterstitialAd(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1200));
}

function simulateRewardedAd(onReward: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      onReward();
      resolve(true);
    }, 1800);
  });
}

type GameState = 'start' | 'playing' | 'paused' | 'over';
type BubbleKind = 'normal' | 'bomb' | 'star';

interface Bubble {
  id: number;
  x: number;
  y: number;
  r: number;
  color: string;
  speed: number;
  wobble: number;
  wobbleSpeed: number;
  kind: BubbleKind;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  t: number;
  color: string;
  r: number;
}

interface TextPop {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  s: number;
  tw: number;
}

export default function BubbleBurst() {
  const t = useTranslations('bubbleBurst');

  // Multi-language fallback helpers
  const getText = (key: string, fallbackEn: string, fallbackVi: string, values?: Record<string, any>) => {
    try {
      if (t) {
        const res = t(key, values);
        if (res && res !== `bubbleBurst.${key}`) return res;
      }
    } catch {
      // Ignore translation errors
    }
    let res = fallbackEn;
    if (typeof window !== 'undefined' && navigator.language.startsWith('vi')) {
      res = fallbackVi;
    }
    if (values) {
      Object.keys(values).forEach((k) => {
        res = res.replace(new RegExp(`{${k}}`, 'g'), values[k]);
      });
    }
    return res;
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);

  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [combo, setCombo] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [muted, setMuted] = useState<boolean>(false);
  const [levelFlash, setLevelFlash] = useState<number | null>(null);

  const [canContinue, setCanContinue] = useState<boolean>(false);
  const [continueSecondsLeft, setContinueSecondsLeft] = useState<number>(6);
  const [adBusy, setAdBusy] = useState<'none' | 'continue' | 'powerup' | 'double' | 'interstitial'>('none');
  const [doubledScore, setDoubledScore] = useState<boolean>(false);
  const [rewardedPowerupReady, setRewardedPowerupReady] = useState<boolean>(true);
  const [showInterstitial, setShowInterstitial] = useState<boolean>(false);

  const gameStateRef = useRef<GameState>('start');
  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(0);
  const levelRef = useRef<number>(1);
  const shakeRef = useRef<number>(0);
  const mutedRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const usedContinueRef = useRef<boolean>(false);

  const lastSpawnRef = useRef<number>(0);
  const lastInterstitialAtRef = useRef<number>(0);
  const bombImmunityUntilRef = useRef<number>(0);
  const slowUntilRef = useRef<number>(0);
  const continueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bubblesRef = useRef<Bubble[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const textsRef = useRef<TextPop[]>([]);
  const starsRef = useRef<Star[]>([]);
  const nextIdRef = useRef<number>(1);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (levelFlash === null) return;
    const id = setTimeout(() => setLevelFlash(null), 1400);
    return () => clearTimeout(id);
  }, [levelFlash]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHighScore(parseInt(saved, 10) || 0);
      const mutedSaved = localStorage.getItem(MUTE_KEY) === '1';
      setMuted(mutedSaved);
      mutedRef.current = mutedSaved;
    } catch {
      // Ignore
    }
  }, []);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const getAudioCtx = () => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctor) audioCtxRef.current = new Ctor();
    }
    return audioCtxRef.current;
  };

  const playTone = (freq: number, duration = 0.1, type: OscillatorType = 'sine', gain = 0.1) => {
    if (mutedRef.current) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const playComboTone = (c: number) => {
    const idx = Math.min(Math.max(c - 1, 0), COMBO_NOTES.length - 1);
    playTone(COMBO_NOTES[idx], 0.12, 'triangle', 0.12);
  };

  const playBombSound = () => {
    if (mutedRef.current) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  };

  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  const initBackground = () => {
    starsRef.current = [];
    for (let i = 0; i < 40; i++) {
      starsRef.current.push({
        x: rand(0, VW),
        y: rand(0, VH),
        r: rand(0.8, 2.2),
        s: rand(10, 30),
        tw: rand(0, Math.PI * 2),
      });
    }
  };

  const saveHighScore = (val: number) => {
    setHighScore(val);
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
    } catch {
      // Ignore
    }
  };

  const updateHUD = () => {
    setScore(scoreRef.current);
    setCombo(comboRef.current);
    setLevel(levelRef.current);
  };

  const resetGame = () => {
    scoreRef.current = 0;
    comboRef.current = 0;
    levelRef.current = 1;
    shakeRef.current = 0;
    bombImmunityUntilRef.current = 0;
    slowUntilRef.current = 0;

    bubblesRef.current = [];
    particlesRef.current = [];
    textsRef.current = [];

    usedContinueRef.current = false;
    if (continueTimerRef.current) clearInterval(continueTimerRef.current);
    setCanContinue(false);
    setDoubledScore(false);
    setShowInterstitial(false);
    setAdBusy('none');

    updateHUD();
  };

  const burstParticles = (x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 200);
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.3, 0.6),
        t: 0,
        color,
        r: rand(2, 4),
      });
    }
  };

  const spawnBubble = () => {
    const r = rand(24, 34);
    const x = rand(r + 10, VW - r - 10);
    const speed = rand(70, 110) + levelRef.current * 8;
    const isBomb = Math.random() < Math.min(0.22, levelRef.current * 0.025);
    const isStar = !isBomb && Math.random() < 0.08;

    let kind: BubbleKind = 'normal';
    if (isBomb && Date.now() > bombImmunityUntilRef.current) kind = 'bomb';
    else if (isStar) kind = 'star';

    const color =
      kind === 'bomb' ? '#2b2b2b' : kind === 'star' ? '#ffd700' : COLORS[Math.floor(Math.random() * COLORS.length)];

    bubblesRef.current.push({
      id: nextIdRef.current++,
      x,
      y: VH + r,
      r,
      color,
      speed,
      wobble: rand(0, Math.PI * 2),
      wobbleSpeed: rand(1.5, 3),
      kind,
    });
  };

  const popBubble = (b: Bubble) => {
    if (b.kind === 'bomb') {
      comboRef.current = 0;
      scoreRef.current = Math.max(0, scoreRef.current - 15);
      shakeRef.current = 12;
      playBombSound();
      burstParticles(b.x, b.y, '#ff4757', 16);
      textsRef.current.push({ x: b.x, y: b.y, text: '-15', color: '#ff4757', alpha: 1 });
    } else if (b.kind === 'star') {
      comboRef.current += 1;
      scoreRef.current += 50;
      shakeRef.current = 4;
      playComboTone(comboRef.current);
      burstParticles(b.x, b.y, '#ffd700', 16);
      textsRef.current.push({ x: b.x, y: b.y, text: '★ +50', color: '#ffd700', alpha: 1 });
    } else {
      comboRef.current += 1;
      const pts = 10 + Math.min(comboRef.current, 10) * 2;
      scoreRef.current += pts;
      shakeRef.current = 2;
      playComboTone(comboRef.current);
      burstParticles(b.x, b.y, b.color, 10);
      textsRef.current.push({
        x: b.x,
        y: b.y,
        text: comboRef.current > 2 ? `+${pts} (${comboRef.current}x)` : `+${pts}`,
        color: comboRef.current > 2 ? '#fbbf24' : '#ffffff',
        alpha: 1,
      });
    }

    const nextLvl = 1 + Math.floor(scoreRef.current / 120);
    if (nextLvl !== levelRef.current) {
      levelRef.current = nextLvl;
      setLevelFlash(nextLvl);
      playTone(600, 0.15, 'triangle', 0.1);
      setTimeout(() => playTone(800, 0.2, 'triangle', 0.1), 100);
    }

    updateHUD();
  };

  const triggerGameOver = () => {
    setGameState('over');
    if (!usedContinueRef.current) {
      setCanContinue(true);
      setContinueSecondsLeft(6);
      if (continueTimerRef.current) clearInterval(continueTimerRef.current);
      continueTimerRef.current = setInterval(() => {
        setContinueSecondsLeft((s) => {
          if (s <= 1) {
            if (continueTimerRef.current) clearInterval(continueTimerRef.current);
            setCanContinue(false);
            finalizeGameOver();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      finalizeGameOver();
    }
  };

  const finalizeGameOver = () => {
    setCanContinue(false);
    const finalSc = scoreRef.current;
    const isRecord = finalSc > highScore;
    setIsNewRecord(isRecord);
    if (isRecord) saveHighScore(finalSc);

    const now = Date.now();
    if (now - lastInterstitialAtRef.current >= INTERSTITIAL_MIN_GAP_MS) {
      lastInterstitialAtRef.current = now;
      setShowInterstitial(true);
      setAdBusy('interstitial');
      simulateInterstitialAd().then(() => setAdBusy('none'));
    } else {
      setShowInterstitial(false);
    }
  };

  const handleWatchContinueAd = async () => {
    if (continueTimerRef.current) clearInterval(continueTimerRef.current);
    setAdBusy('continue');
    await simulateRewardedAd(() => {
      usedContinueRef.current = true;
      bubblesRef.current = [];
    });
    setAdBusy('none');
    setCanContinue(false);
    setGameState('playing');
    updateHUD();
  };

  const handleDeclineContinue = () => {
    if (continueTimerRef.current) clearInterval(continueTimerRef.current);
    setCanContinue(false);
    finalizeGameOver();
  };

  const handleWatchDoubleScoreAd = async () => {
    if (doubledScore) return;
    setAdBusy('double');
    await simulateRewardedAd(() => {
      const doubled = scoreRef.current * 2;
      scoreRef.current = doubled;
      setScore(doubled);
      if (doubled > highScore) saveHighScore(doubled);
      setDoubledScore(true);
    });
    setAdBusy('none');
  };

  const handleDefusePowerup = async () => {
    if (!rewardedPowerupReady || gameStateRef.current !== 'playing') return;
    setRewardedPowerupReady(false);
    setAdBusy('powerup');
    await simulateRewardedAd(() => {
      bubblesRef.current = bubblesRef.current.filter((b) => b.kind !== 'bomb');
      bombImmunityUntilRef.current = Date.now() + 6000;
      shakeRef.current = 6;
    });
    setAdBusy('none');
    setTimeout(() => setRewardedPowerupReady(true), REWARDED_POWERUP_COOLDOWN_MS);
  };

  const handleSlowPowerup = async () => {
    if (!rewardedPowerupReady || gameStateRef.current !== 'playing') return;
    setRewardedPowerupReady(false);
    setAdBusy('powerup');
    await simulateRewardedAd(() => {
      slowUntilRef.current = Date.now() + 7000;
    });
    setAdBusy('none');
    setTimeout(() => setRewardedPowerupReady(true), REWARDED_POWERUP_COOLDOWN_MS);
  };

  const update = (dt: number) => {
    const now = Date.now();
    const spawnInterval = Math.max(0.4, 1.4 - levelRef.current * 0.08);

    if (now - lastSpawnRef.current > spawnInterval * 1000) {
      spawnBubble();
      lastSpawnRef.current = now;
    }

    const isSlow = now < slowUntilRef.current;
    const speedMult = isSlow ? 0.45 : 1.0;

    const bubbles = bubblesRef.current;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y -= b.speed * speedMult * dt;
      b.wobble += b.wobbleSpeed * dt;
      b.x += Math.sin(b.wobble) * 0.8;

      // Kiem tra bong cham canh tren
      if (b.y - b.r <= 70) {
        if (b.kind === 'bomb') {
          // Khi bom vuot qua ranh gioi, xoa bom ma KHONG ket thuc game
          bubbles.splice(i, 1);
        } else {
          // Bong thuong va bong sao vuot qua ranh gioi se thua game
          triggerGameOver();
          break;
        }
      }
    }

    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
    }
    particlesRef.current = particles.filter((p) => p.t < p.life);

    const texts = textsRef.current;
    for (let i = texts.length - 1; i >= 0; i--) {
      const tx = texts[i];
      tx.y -= 40 * dt;
      tx.alpha -= 0.8 * dt;
    }
    textsRef.current = texts.filter((tx) => tx.alpha > 0);

    if (shakeRef.current > 0) {
      shakeRef.current = Math.max(0, shakeRef.current - dt * 30);
    }
  };

  const render = (ctx: CanvasRenderingContext2D, dt: number) => {
    ctx.clearRect(0, 0, VW, VH);
    ctx.save();

    if (shakeRef.current > 0) {
      ctx.translate(rand(-shakeRef.current, shakeRef.current), rand(-shakeRef.current, shakeRef.current));
    }

    // Sky Background Gradient
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0f172a');
    g.addColorStop(0.6, '#1e1b4b');
    g.addColorStop(1, '#311042');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    // Stars
    for (const s of starsRef.current) {
      s.y += s.s * dt;
      if (s.y > VH) s.y = 0;
      s.tw += dt * 3;
      ctx.globalAlpha = 0.3 + Math.sin(s.tw) * 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
      // Bubbles
      for (const b of bubblesRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);

        const grad = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, b.color);
        grad.addColorStop(1, '#000000');

        ctx.fillStyle = grad;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fill();

        if (b.kind === 'bomb') {
          ctx.font = `${Math.round(b.r * 1.1)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('💣', b.x, b.y + 1);
        } else if (b.kind === 'star') {
          ctx.font = `${Math.round(b.r * 1.1)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('⭐', b.x, b.y + 1);
        } else {
          ctx.beginPath();
          ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.fill();
        }

        ctx.restore();
      }

      // Particles
      for (const p of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Floating Score Texts
      for (const tx of textsRef.current) {
        ctx.globalAlpha = Math.max(0, tx.alpha);
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillStyle = tx.color;
        ctx.textAlign = 'center';
        ctx.fillText(tx.text, tx.x, tx.y);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };

  useEffect(() => {
    initBackground();

    const canvas = canvasRef.current;
    const stageWrap = stageWrapRef.current;
    if (!canvas || !stageWrap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      const rect = stageWrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(VW * dpr);
      canvas.height = Math.round(VH * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const stageToVirtual = (clientX: number, clientY: number) => {
      const rect = stageWrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: VW / 2, y: VH / 2 };
      return {
        x: ((clientX - rect.left) / rect.width) * VW,
        y: ((clientY - rect.top) / rect.height) * VH,
      };
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing') return;
      e.preventDefault();

      const pt = stageToVirtual(e.clientX, e.clientY);
      let hit = false;
      const bubbles = bubblesRef.current;

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        const dist = Math.hypot(pt.x - b.x, pt.y - b.y);

        if (dist <= b.r + 12) {
          popBubble(b);
          bubbles.splice(i, 1);
          hit = true;
          break;
        }
      }

      if (!hit) {
        comboRef.current = 0;
        updateHUD();
      }
    };

    stageWrap.addEventListener('pointerdown', handlePointerDown, { passive: false });

    let animId: number;
    let lastT = performance.now();

    const loop = (now: number) => {
      let dt = (now - lastT) / 1000;
      lastT = now;
      dt = Math.min(dt, 0.033);

      if (gameStateRef.current === 'playing') {
        update(dt);
      }
      render(ctx, dt);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      stageWrap.removeEventListener('pointerdown', handlePointerDown);
      if (continueTimerRef.current) clearInterval(continueTimerRef.current);
    };
  }, []);

  const handlePlay = () => {
    resetGame();
    setGameState('playing');
  };

  const handleTogglePause = () => {
    setGameState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
  };

  return (
    <div id="app">
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap" rel="stylesheet" />

      <div className="game-shell">
        <div className="ad-slot ad-side" data-ad-slot="side-left" aria-hidden="true">
          Ad
        </div>

        <div className="stage-wrap" ref={stageWrapRef}>
          <canvas ref={canvasRef} id="game" />

          {gameState === 'playing' && (
            <div className="hud">
              <div className="hud-top">
                <div className="hud-block">
                  <div className="score-label">{getText('scoreLabel', 'SCORE', 'ĐIỂM')}</div>
                  <div className="score-value">{score}</div>
                  <div className="combo">{combo > 1 ? `x${combo} combo` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="pause-btn" onClick={toggleMute} aria-label="Mute">
                    {muted ? '🔇' : '🔊'}
                  </button>
                  <button className="pause-btn" onClick={handleTogglePause} aria-label="Pause">
                    ⏸
                  </button>
                </div>
              </div>

              <div className="wave-tag">{getText('levelLabel', `LEVEL ${level}`, `CẤP ${level}`, { level })}</div>

              {levelFlash !== null && (
                <div className="level-flash">
                  <span>{getText('levelUpTitle', `LEVEL ${levelFlash}`, `CẤP ${levelFlash}`)}</span>
                  <small>{getText('levelUpSub', 'Speed Increased!', 'Tốc độ tăng lên!')}</small>
                </div>
              )}

              <div className="powerup-bar">
                <button
                  className={`pwr-btn ${!rewardedPowerupReady ? 'disabled' : ''}`}
                  onClick={handleDefusePowerup}
                  disabled={!rewardedPowerupReady || adBusy === 'powerup'}
                >
                  💣 {getText('defuse', 'Defuse', 'Gỡ Bom')}
                </button>
                <button
                  className={`pwr-btn ${!rewardedPowerupReady ? 'disabled' : ''}`}
                  onClick={handleSlowPowerup}
                  disabled={!rewardedPowerupReady || adBusy === 'powerup'}
                >
                  🐌 {getText('slow', 'Slow-Mo', 'Làm Chậm')}
                </button>
              </div>
            </div>
          )}

          {gameState === 'start' && (
            <div className="screen">
              <button className="mute-corner" onClick={toggleMute} aria-label="Mute" type="button">
                {muted ? '🔇' : '🔊'}
              </button>
              <div className="logo">
                BUBBLE<span>BURST</span>
              </div>
              <div className="tagline">
                {getText('tagline', "Don't let bubbles cross the top boundary!", 'Không để bong bóng trôi lên hết màn hình!')}
              </div>
              <div className="hiscore-pill">
                {getText('hiscorePill', `BEST: ${highScore}`, `KỶ LỤC: ${highScore}`, { score: highScore })}
              </div>
              <button className="btn" onClick={handlePlay} type="button">
                {getText('playButton', 'PLAY NOW', 'CHƠI NGAY')}
              </button>
              <div className="hint">
                {getText(
                  'hint',
                  'Tap or click bubbles to burst them.<br/>Avoid letting them reach the top boundary!',
                  'Chạm hoặc bấm vào bong bóng để làm vỡ.<br/>Đừng để chúng chạm tới cạnh trên!'
                )}
              </div>
            </div>
          )}

          {gameState === 'paused' && (
            <div className="screen">
              <div className="logo" style={{ fontSize: 30 }}>
                {getText('pauseTitle', 'PAUSED', 'TẠM DỪNG')}
              </div>
              <button className="btn" onClick={() => setGameState('playing')} type="button">
                {getText('resumeButton', 'RESUME', 'TIẾP TỤC')}
              </button>
              <button className="btn secondary" onClick={handlePlay} type="button">
                {getText('restartButton', 'RESTART', 'CHƠI LẠI')}
              </button>
            </div>
          )}

          {gameState === 'over' && canContinue && (
            <div className="screen">
              <div className="final-label">{getText('continueTitle', 'OUT OF BOUNDS!', 'CHẠM CẠNH TRÊN!')}</div>
              <div className="final-score">{score}</div>
              <p className="hint">
                {getText(
                  'continueHint',
                  'Watch a short ad to clear screen and keep playing!',
                  'Xem quảng cáo ngắn để dọn màn hình và chơi tiếp!'
                )}
              </p>
              <button
                className="btn"
                onClick={handleWatchContinueAd}
                disabled={adBusy === 'continue'}
                type="button"
              >
                {adBusy === 'continue'
                  ? '⏳ Loading...'
                  : getText(
                      'watchAdContinue',
                      `▶ Watch Ad & Continue (${continueSecondsLeft}s)`,
                      `▶ Xem QC & Chơi tiếp (${continueSecondsLeft}s)`
                    )}
              </button>
              <button className="btn secondary" onClick={handleDeclineContinue} type="button">
                {getText('giveUp', 'End Game', 'Kết thúc lượt chơi')}
              </button>
            </div>
          )}

          {gameState === 'over' && !canContinue && (
            <div className="screen">
              <div className="final-label">{getText('finalLabel', 'GAME OVER', 'KẾT THÚC')}</div>
              <div className="final-score">{score}</div>
              {isNewRecord && (
                <div className="record-badge">{getText('newRecord', 'NEW HIGH SCORE!', 'KỶ LỤC MỚI!')}</div>
              )}
              <div className="hiscore-pill">
                {getText(
                  'hiscorePill',
                  `BEST: ${Math.max(highScore, score)}`,
                  `KỶ LỤC: ${Math.max(highScore, score)}`
                )}
              </div>

              {!doubledScore && (
                <button
                  className="btn secondary double-btn"
                  onClick={handleWatchDoubleScoreAd}
                  disabled={adBusy === 'double'}
                  type="button"
                >
                  {adBusy === 'double' ? '⏳ Loading...' : getText('doubleBtn', '🎬 2x Score with Ad', '🎬 Xem QC nhận x2 điểm')}
                </button>
              )}

              <button className="btn" onClick={handlePlay} type="button">
                {getText('replayButton', 'PLAY AGAIN', 'CHƠI LẠI')}
              </button>

              {showInterstitial && (
                <div className="interstitial" data-ad-slot="gameover-interstitial" aria-hidden="true">
                  {adBusy === 'interstitial' ? 'Loading Ad...' : 'Interstitial Ad'}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ad-slot ad-side" data-ad-slot="side-right" aria-hidden="true">
          Ad
        </div>
      </div>

      <div className="banner-ad" data-ad-slot="sticky-bottom-banner" aria-hidden="true">
        Ad banner 320×50
      </div>

      <style jsx global>{`
        :root {
          --sky-deep: #0f172a;
          --sky-mid: #1e1b4b;
          --sky-horizon: #311042;
          --sunset-soft: #fbbf24;
          --cyan: #38ef7d;
          --alert: #f43f5e;
          --cloud: #f8fafc;
          --panel: rgba(15, 23, 42, 0.85);
          --panel-border: rgba(56, 239, 125, 0.28);
          --font-display: 'Rajdhani', system-ui, sans-serif;
        }

        #app * {
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }

        #app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: radial-gradient(ellipse at 50% 0%, var(--sky-horizon) 0%, var(--sky-mid) 45%, var(--sky-deep) 100%);
          font-family: var(--font-display);
          color: var(--cloud);
          overflow-x: hidden;
        }

        .game-shell {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 16px;
          padding: 16px;
          width: 100%;
          max-width: 1200px;
        }

        .ad-slot {
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(248, 250, 252, 0.35);
          font-size: 11px;
          letter-spacing: 0.06em;
          background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0 10px, rgba(255, 255, 255, 0.01) 10px 20px);
          border: 1px dashed rgba(248, 250, 252, 0.14);
          flex-shrink: 0;
        }

        .ad-side {
          width: 160px;
          height: 600px;
          writing-mode: vertical-rl;
          border-radius: 12px;
        }

        @media (max-width: 900px) {
          .ad-side {
            display: none;
          }
        }

        .stage-wrap {
          position: relative;
          width: 100%;
          max-width: 480px;
          aspect-ratio: 480 / 800;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(56, 239, 125, 0.22), 0 20px 60px rgba(0, 0, 0, 0.55);
          background: var(--sky-deep);
          user-select: none;
          touch-action: none;
        }

        canvas {
          display: block;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }

        .hud {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 5;
        }

        .hud-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 10px 12px;
        }

        .hud-block {
          background: var(--panel);
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          padding: 6px 10px;
          backdrop-filter: blur(4px);
        }

        .score-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          color: var(--sunset-soft);
        }

        .score-value {
          font-size: 22px;
          font-weight: 700;
          line-height: 1;
          color: var(--cloud);
        }

        .combo {
          font-size: 11px;
          color: var(--cyan);
          height: 14px;
        }

        .wave-tag {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          letter-spacing: 0.1em;
          color: var(--sunset-soft);
          background: var(--panel);
          border: 1px solid var(--panel-border);
          padding: 4px 12px;
          border-radius: 20px;
        }

        .pause-btn {
          pointer-events: auto;
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: var(--panel);
          border: 1px solid var(--panel-border);
          color: var(--cloud);
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .powerup-bar {
          position: absolute;
          bottom: 12px;
          left: 12px;
          right: 12px;
          display: flex;
          gap: 8px;
          pointer-events: auto;
        }

        .pwr-btn {
          flex: 1;
          background: var(--panel);
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          padding: 8px;
          color: var(--cloud);
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          backdrop-filter: blur(4px);
        }

        .pwr-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .screen {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          text-align: center;
          padding: 24px;
          background: rgba(15, 23, 42, 0.94);
          backdrop-filter: blur(4px);
          z-index: 10;
          pointer-events: auto;
        }

        .logo {
          font-size: 40px;
          font-weight: 700;
          color: var(--cloud);
          text-shadow: 0 0 18px rgba(56, 239, 125, 0.4);
          line-height: 1;
        }

        .logo span {
          color: var(--cyan);
        }

        .tagline {
          color: var(--sunset-soft);
          font-size: 14px;
          max-width: 280px;
        }

        .hint {
          font-size: 12px;
          color: rgba(248, 250, 252, 0.6);
          max-width: 280px;
          line-height: 1.5;
        }

        .hiscore-pill {
          font-size: 12px;
          color: var(--cyan);
          border: 1px solid var(--panel-border);
          padding: 4px 12px;
          border-radius: 20px;
          background: var(--panel);
        }

        .btn {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 18px;
          color: #0f172a;
          background: linear-gradient(135deg, #38ef7d, #11998e);
          border: none;
          border-radius: 30px;
          padding: 12px 36px;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(56, 239, 125, 0.3);
          transition: transform 0.15s;
        }

        .btn:active {
          transform: scale(0.96);
        }

        .btn.secondary {
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          box-shadow: 0 8px 20px rgba(251, 191, 36, 0.3);
        }

        .mute-corner {
          position: absolute;
          top: 14px;
          right: 14px;
          background: var(--panel);
          border: 1px solid var(--panel-border);
          border-radius: 8px;
          padding: 6px;
          cursor: pointer;
          color: var(--cloud);
        }

        .level-flash {
          position: absolute;
          top: 35%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--panel);
          border: 2px solid var(--cyan);
          padding: 12px 24px;
          border-radius: 12px;
          text-align: center;
          animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .level-flash span {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: var(--cyan);
        }

        .level-flash small {
          font-size: 12px;
          color: var(--sunset-soft);
        }

        .final-label {
          font-size: 28px;
          font-weight: 700;
          color: var(--alert);
        }

        .final-score {
          font-size: 52px;
          font-weight: 700;
          color: var(--sunset-soft);
          line-height: 1;
        }

        .record-badge {
          background: var(--alert);
          color: #fff;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 700;
        }

        .banner-ad {
          width: 320px;
          height: 50px;
          margin-top: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px dashed rgba(248, 250, 252, 0.2);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: rgba(248, 250, 252, 0.4);
        }

        .interstitial {
          margin-top: 10px;
          padding: 8px 16px;
          background: rgba(244, 63, 94, 0.15);
          border: 1px solid var(--alert);
          border-radius: 8px;
          font-size: 12px;
          color: var(--alert);
        }

        @keyframes popIn {
          from {
            transform: translate(-50%, -50%) scale(0.6);
            opacity: 0;
          }
          to {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}