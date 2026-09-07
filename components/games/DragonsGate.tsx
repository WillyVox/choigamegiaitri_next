'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/* ============================================================================
 * DRAGON GATE — Hyper-Casual Endless Flyer
 * Layout & Container structure aligned with SkyStrike template
 * ==========================================================================*/

const VW = 450; // 9:16 virtual width
const VH = 800; // 9:16 virtual height

const STORAGE_KEY_BEST = 'dragons-gate:best';
const STORAGE_KEY_MUTE = 'dragons-gate:muted';
const STORAGE_KEY_LAST_AD = 'dragons-gate:lastAd';

const GRAVITY = 1500;
const FLAP_VELOCITY = -420;

const BASE_GATE_GAP = 190;
const MIN_GATE_GAP = 122;
const BASE_GATE_WIDTH = 68;
const MAX_GATE_WIDTH = 88;
const GATE_SPACING = 260;
const BASE_SCROLL_SPEED = 168;
const MAX_SCROLL_SPEED = 320;

const SCORE_PER_LEVEL = 8;
const LEVEL_DIFFICULTY_CAP = 24;

const INTERSTITIAL_MIN_GAP_MS = 60_000;
const INTERSTITIAL_MAX_GAP_MS = 90_000;

// Do-Re-Mi-Fa-Sol-La-Si-Do ascending combo scale
const COMBO_SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5];

// Background palette progression per world (every 3 levels)
const LEVEL_PALETTES: [string, string, string][] = [
  ['#180b28', '#381652', '#70226c'], // Twilight Mystic Void
  ['#081d33', '#13496b', '#268a88'], // Deep Ocean Sanctuary
  ['#2d0a1e', '#661b3c', '#b53f4d'], // Crimson Sunset Peak
  ['#071626', '#172f4f', '#2a5b82'], // Eclipse Horizon
  ['#1a0b29', '#461852', '#7e2b6e'], // Astral Obsidian Gate
  ['#0e1d0b', '#284f22', '#679e33'], // Jade Emerald Valley
];

type GameState = 'start' | 'playing' | 'paused' | 'over';

interface Dragon {
  x: number;
  y: number;
  vy: number;
  r: number;
  rot: number;
  flapAnim: number;
}

interface Gate {
  x: number;
  centerY: number;
  baseCenterY: number;
  width: number;
  passed: boolean;
  oscAmp: number;
  oscSpeed: number;
  phase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  colorBase: string;
}

interface Cloud {
  x: number;
  y: number;
  r: number;
  speed: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  speed: number;
  twinkle: number;
}

interface Shake {
  time: number;
  total: number;
  mag: number;
}

interface Flash {
  colorBase: string;
  alpha: number;
}

/* ---------------------------- difficulty curve --------------------------- */

function levelFromScore(score: number) {
  return 1 + Math.floor(score / SCORE_PER_LEVEL);
}
function speedForLevel(level: number) {
  const lv = Math.min(level, LEVEL_DIFFICULTY_CAP);
  return Math.min(MAX_SCROLL_SPEED, BASE_SCROLL_SPEED + (lv - 1) * 7);
}
function gapForLevel(level: number) {
  const lv = Math.min(level, LEVEL_DIFFICULTY_CAP);
  return Math.max(MIN_GATE_GAP, BASE_GATE_GAP - (lv - 1) * 3.2);
}
function widthForLevel(level: number) {
  const lv = Math.min(level, LEVEL_DIFFICULTY_CAP);
  return Math.min(MAX_GATE_WIDTH, BASE_GATE_WIDTH + Math.floor((lv - 1) / 2) * 2.5);
}
function oscillationForLevel(level: number): { amp: number; speed: number } | null {
  if (level < 3) return null;
  const lv = Math.min(level, LEVEL_DIFFICULTY_CAP);
  return { amp: Math.min(70, (lv - 2) * 7), speed: 0.5 + lv * 0.035 };
}
function paletteForLevel(level: number) {
  return LEVEL_PALETTES[Math.floor((level - 1) / 3) % LEVEL_PALETTES.length];
}

/* ------------------------------ tiny synth -------------------------------- */

let sharedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx) sharedAudioCtx = new Ctor();
  if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume().catch(() => {});
  return sharedAudioCtx;
}

function playTone(
  muted: boolean,
  freq: number,
  duration = 0.14,
  type: OscillatorType = 'triangle',
  volume = 0.16
) {
  if (muted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    /* ignore audio failures */
  }
}

function playComboTone(muted: boolean, comboIndex: number) {
  const octaveBoost = Math.floor(comboIndex / COMBO_SCALE.length) * 0.5;
  const freq = COMBO_SCALE[comboIndex % COMBO_SCALE.length] * (1 + octaveBoost);
  playTone(muted, freq, 0.13, 'triangle', 0.15);
}

function playCollisionTone(muted: boolean) {
  playTone(muted, 180, 0.22, 'sawtooth', 0.18);
  setTimeout(() => playTone(muted, 90, 0.28, 'sawtooth', 0.16), 70);
}

function playLevelUpFanfare(muted: boolean) {
  [784.0, 987.77, 1174.66].forEach((f, i) => {
    setTimeout(() => playTone(muted, f, 0.16, 'square', 0.14), i * 90);
  });
}

/* -------------------------------------------------------------------------- */

export default function DragonsGate() {
  const t = useTranslations('dragonsGate');
  const tt = (key: string, fallback: string) => {
    try {
      const v = t(key as any);
      return v && v !== key ? v : fallback;
    } catch {
      return fallback;
    }
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const mutedRef = useRef(false);
  const levelUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelUpToast, setLevelUpToast] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [doubledApplied, setDoubledApplied] = useState(false);

  // Revive state
  const [showReviveOffer, setShowReviveOffer] = useState(false);
  const [reviveAvailable, setReviveAvailable] = useState(true);

  // Interstitial overlay state
  const [showInterstitial, setShowInterstitial] = useState(false);

  useEffect(() => {
    try {
      const savedBest = window.localStorage.getItem(STORAGE_KEY_BEST);
      if (savedBest) setBest(parseInt(savedBest, 10) || 0);
      const savedMute = window.localStorage.getItem(STORAGE_KEY_MUTE);
      if (savedMute === '1') {
        setMuted(true);
        mutedRef.current = true;
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    try {
      window.localStorage.setItem(STORAGE_KEY_MUTE, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  /* --------------------------- main game engine --------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = stageWrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let DPR = 1;
    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2.5);
      const rect = wrap!.getBoundingClientRect();
      canvas!.width = Math.round(VW * DPR);
      canvas!.height = Math.round(VH * DPR);
      canvas!.style.width = rect.width + 'px';
      canvas!.style.height = rect.height + 'px';
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    window.addEventListener('resize', resize);
    resize();

    let dragon: Dragon = { x: 0, y: 0, vy: 0, r: 16, rot: 0, flapAnim: 0 };
    let gates: Gate[] = [];
    let particles: Particle[] = [];
    let clouds: Cloud[] = [];
    let stars: Star[] = [];
    let runScore = 0;
    let curLevel = 1;
    let running = false;
    let isPaused = false;
    let hasStarted = false;
    let lastTime = 0;
    let elapsed = 0;
    let invincibleUntil = -1;
    let reviveUsed = false;
    let localBest = best;

    let lastInterstitialAt = 0;
    let nextInterstitialGap =
      INTERSTITIAL_MIN_GAP_MS + Math.random() * (INTERSTITIAL_MAX_GAP_MS - INTERSTITIAL_MIN_GAP_MS);
    try {
      const savedAt = window.localStorage.getItem(STORAGE_KEY_LAST_AD);
      if (savedAt) lastInterstitialAt = parseInt(savedAt, 10) || 0;
    } catch {
      /* ignore */
    }

    const shake: Shake = { time: 0, total: 0, mag: 0 };
    const flash: Flash = { colorBase: '255,255,255', alpha: 0 };

    function triggerShake(mag: number, duration: number) {
      shake.mag = mag;
      shake.time = duration;
      shake.total = duration;
    }
    function triggerFlash(colorBase: string, alpha: number) {
      flash.colorBase = colorBase;
      flash.alpha = alpha;
    }

    function burstParticles(
      x: number,
      y: number,
      count: number,
      opts: { speed?: number; speedVar?: number; life?: number; r?: number; colorBase?: string }
    ) {
      const speed = opts.speed ?? 80;
      const speedVar = opts.speedVar ?? 80;
      const life = opts.life ?? 0.55;
      const colorBase = opts.colorBase ?? '255,200,120';
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const s = speed + Math.random() * speedVar;
        particles.push({
          x,
          y,
          vx: Math.cos(ang) * s,
          vy: Math.sin(ang) * s,
          life,
          maxLife: life,
          r: (opts.r ?? 2) + Math.random() * 2,
          colorBase,
        });
      }
    }

    function initEnvironment() {
      clouds = [];
      for (let i = 0; i < 6; i++) {
        clouds.push({
          x: Math.random() * VW,
          y: 30 + Math.random() * 220,
          r: 22 + Math.random() * 32,
          speed: 10 + Math.random() * 16,
        });
      }
      stars = [];
      for (let i = 0; i < 40; i++) {
        stars.push({
          x: Math.random() * VW,
          y: Math.random() * (VH * 0.7),
          r: 0.8 + Math.random() * 1.5,
          speed: 4 + Math.random() * 8,
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    }

    function spawnGate(x: number) {
      const gap = gapForLevel(curLevel);
      const width = widthForLevel(curLevel);
      const margin = 70;
      const baseCenterY = margin + Math.random() * (VH - margin * 2 - gap) + gap / 2;
      const osc = oscillationForLevel(curLevel);
      gates.push({
        x,
        centerY: baseCenterY,
        baseCenterY,
        width,
        passed: false,
        oscAmp: osc?.amp ?? 0,
        oscSpeed: osc?.speed ?? 0,
        phase: Math.random() * Math.PI * 2,
      });
    }

    function resetRun() {
      dragon = { x: VW * 0.28, y: VH * 0.45, vy: 0, r: 16, rot: 0, flapAnim: 0 };
      gates = [];
      particles = [];
      runScore = 0;
      curLevel = 1;
      elapsed = 0;
      invincibleUntil = -1;
      reviveUsed = false;
      running = true;
      isPaused = false;
      setGameState('playing');
      setScore(0);
      setLevel(1);
      setReviveAvailable(true);
      setShowReviveOffer(false);
      setShowInterstitial(false);
      spawnGate(VW + 100);
      spawnGate(VW + 100 + GATE_SPACING);
      spawnGate(VW + 100 + GATE_SPACING * 2);
    }

    function flap() {
      if (!running || isPaused) return;
      dragon.vy = FLAP_VELOCITY;
      dragon.flapAnim = 1;
      for (let i = 0; i < 4; i++) {
        particles.push({
          x: dragon.x - 10,
          y: dragon.y + 8,
          vx: -60 - Math.random() * 60,
          vy: (Math.random() - 0.5) * 80,
          life: 0.4,
          maxLife: 0.4,
          r: 2 + Math.random() * 2,
          colorBase: '255,200,120',
        });
      }
    }

    function finalizeGameOver(finalRunScore: number) {
      let record = false;
      if (finalRunScore > localBest) {
        localBest = finalRunScore;
        setBest(localBest);
        record = true;
        try {
          window.localStorage.setItem(STORAGE_KEY_BEST, String(localBest));
        } catch {
          /* ignore */
        }
      }
      setIsNewRecord(record);
      setDoubledApplied(false);
      setFinalScore(finalRunScore);
      setGameState('over');

      const now = Date.now();
      if (now - lastInterstitialAt > nextInterstitialGap) {
        lastInterstitialAt = now;
        nextInterstitialGap =
          INTERSTITIAL_MIN_GAP_MS + Math.random() * (INTERSTITIAL_MAX_GAP_MS - INTERSTITIAL_MIN_GAP_MS);
        try {
          window.localStorage.setItem(STORAGE_KEY_LAST_AD, String(lastInterstitialAt));
        } catch {
          /* ignore */
        }
        setShowInterstitial(true);
      }
    }

    function endRun() {
      running = false;
      if (!reviveUsed) {
        setShowReviveOffer(true);
      } else {
        finalizeGameOver(runScore);
      }
    }

    function hitDragon() {
      if (elapsed < invincibleUntil) return;
      triggerShake(10, 0.3);
      triggerFlash('255,60,90', 0.4);
      playCollisionTone(mutedRef.current);
      burstParticles(dragon.x, dragon.y, 18, { speed: 130, speedVar: 110, life: 0.6, colorBase: '255,110,90' });
      endRun();
    }

    function update(dt: number) {
      if (!running || isPaused) return;
      elapsed += dt;

      dragon.vy += GRAVITY * dt;
      dragon.y += dragon.vy * dt;
      dragon.rot = Math.max(-0.5, Math.min(1.1, dragon.vy / 600));
      dragon.flapAnim = Math.max(0, dragon.flapAnim - dt * 4);

      if (dragon.y - dragon.r < 0) {
        dragon.y = dragon.r;
        dragon.vy = 0;
      }
      if (dragon.y + dragon.r > VH) {
        hitDragon();
      }

      const scrollSpeed = speedForLevel(curLevel);

      for (const g of gates) {
        g.x -= scrollSpeed * dt;
        if (g.oscAmp > 0) {
          g.centerY = g.baseCenterY + Math.sin(elapsed * g.oscSpeed + g.phase) * g.oscAmp;
        }
        if (!g.passed && g.x + g.width / 2 < dragon.x) {
          g.passed = true;
          runScore++;
          setScore(runScore);
          playComboTone(mutedRef.current, runScore - 1);
          burstParticles(dragon.x, dragon.y, 12, {
            speed: 70,
            speedVar: 80,
            life: 0.5,
            colorBase: '255,215,100',
          });

          const newLevel = levelFromScore(runScore);
          if (newLevel !== curLevel) {
            curLevel = newLevel;
            setLevel(curLevel);
            triggerShake(4, 0.22);
            triggerFlash('255,255,255', 0.3);
            burstParticles(dragon.x, dragon.y, 26, {
              speed: 90,
              speedVar: 120,
              life: 0.9,
              colorBase: '255,225,140',
            });
            playLevelUpFanfare(mutedRef.current);
            setLevelUpToast(curLevel);
            if (levelUpTimeoutRef.current) clearTimeout(levelUpTimeoutRef.current);
            levelUpTimeoutRef.current = setTimeout(() => setLevelUpToast(null), 1400);
          }
        }
        const withinX = dragon.x + dragon.r > g.x - g.width / 2 && dragon.x - dragon.r < g.x + g.width / 2;
        if (withinX) {
          const gap = gapForLevel(curLevel);
          const topEdge = g.centerY - gap / 2;
          const botEdge = g.centerY + gap / 2;
          if (dragon.y - dragon.r < topEdge || dragon.y + dragon.r > botEdge) hitDragon();
        }
      }
      gates = gates.filter((g) => g.x > -MAX_GATE_WIDTH);
      const rightMost = gates.length ? Math.max(...gates.map((g) => g.x)) : VW;
      if (rightMost < VW + GATE_SPACING * 2) spawnGate(rightMost + GATE_SPACING);

      for (const c of clouds) {
        c.x -= c.speed * dt;
        if (c.x < -60) c.x = VW + 60;
      }

      for (const s of stars) {
        s.x -= s.speed * dt;
        if (s.x < -10) s.x = VW + 10;
        s.twinkle += dt * 3;
      }

      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      particles = particles.filter((p) => p.life > 0);

      if (shake.time > 0) shake.time = Math.max(0, shake.time - dt);
      if (flash.alpha > 0) flash.alpha = Math.max(0, flash.alpha - dt * 2.4);
    }

    /* ---------------- Beautiful Dragon Gate Visual Rendering --------------- */

    function drawDragonGatePillar(x: number, topY: number, botY: number, width: number, isTop: boolean) {
      const w = width;
      const halfW = w / 2;
      const time = elapsed;

      ctx!.save();

      // Dragon Gate Main Body
      const bodyGrad = ctx!.createLinearGradient(x - halfW, 0, x + halfW, 0);
      bodyGrad.addColorStop(0, '#1c1328');
      bodyGrad.addColorStop(0.3, '#3d2252');
      bodyGrad.addColorStop(0.7, '#241538');
      bodyGrad.addColorStop(1, '#120b1c');

      ctx!.fillStyle = bodyGrad;
      ctx!.strokeStyle = '#7c3fad';
      ctx!.lineWidth = 2;

      if (isTop) {
        ctx!.fillRect(x - halfW, 0, w, topY);
        ctx!.strokeRect(x - halfW, 0, w, topY);

        // Dragon Arch Crown / Cap
        ctx!.fillStyle = '#ff7b54';
        ctx!.beginPath();
        ctx!.moveTo(x - halfW - 8, topY - 18);
        ctx!.lineTo(x + halfW + 8, topY - 18);
        ctx!.lineTo(x + halfW + 3, topY);
        ctx!.lineTo(x - halfW - 3, topY);
        ctx!.closePath();
        ctx!.fill();

        // Flaming Rune Markings
        ctx!.fillStyle = 'rgba(255, 214, 107, 0.85)';
        for (let ry = 30; ry < topY - 25; ry += 35) {
          ctx!.beginPath();
          ctx!.arc(x, ry, 3.5, 0, Math.PI * 2);
          ctx!.fill();
        }

        // Glowing Energy Orb at Gate Tip
        const orbGlow = 8 + Math.sin(time * 6) * 3;
        ctx!.fillStyle = '#4fd8eb';
        ctx!.shadowColor = '#4fd8eb';
        ctx!.shadowBlur = 12;
        ctx!.beginPath();
        ctx!.arc(x, topY - 8, orbGlow, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;
      } else {
        ctx!.fillRect(x - halfW, botY, w, VH - botY);
        ctx!.strokeRect(x - halfW, botY, w, VH - botY);

        // Dragon Arch Base Cap
        ctx!.fillStyle = '#ff7b54';
        ctx!.beginPath();
        ctx!.moveTo(x - halfW - 8, botY + 18);
        ctx!.lineTo(x + halfW + 8, botY + 18);
        ctx!.lineTo(x + halfW + 3, botY);
        ctx!.lineTo(x - halfW - 3, botY);
        ctx!.closePath();
        ctx!.fill();

        // Flaming Rune Markings
        ctx!.fillStyle = 'rgba(255, 214, 107, 0.85)';
        for (let ry = botY + 35; ry < VH - 20; ry += 35) {
          ctx!.beginPath();
          ctx!.arc(x, ry, 3.5, 0, Math.PI * 2);
          ctx!.fill();
        }

        // Glowing Energy Orb at Gate Tip
        const orbGlow = 8 + Math.sin(time * 6 + 1.5) * 3;
        ctx!.fillStyle = '#4fd8eb';
        ctx!.shadowColor = '#4fd8eb';
        ctx!.shadowBlur = 12;
        ctx!.beginPath();
        ctx!.arc(x, botY + 8, orbGlow, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      ctx!.restore();
    }

    function drawDragon() {
      const invincible = elapsed < invincibleUntil;
      ctx!.save();
      ctx!.translate(dragon.x, dragon.y);
      ctx!.rotate(dragon.rot * 0.5);

      if (invincible) {
        ctx!.globalAlpha = 0.55 + 0.45 * Math.sin(elapsed * 25);
      }

      const wingLift = Math.sin(dragon.flapAnim * Math.PI) * 14;

      // Wings
      ctx!.fillStyle = '#ff4365';
      ctx!.beginPath();
      ctx!.ellipse(-6, -2 - wingLift * 0.4, 15, 9, -0.4, 0, Math.PI * 2);
      ctx!.fill();

      // Body
      ctx!.fillStyle = '#ff7b54';
      ctx!.beginPath();
      ctx!.ellipse(0, 0, 18, 13, 0, 0, Math.PI * 2);
      ctx!.fill();

      // Belly Highlight
      ctx!.fillStyle = '#ffd66b';
      ctx!.beginPath();
      ctx!.ellipse(2, 4, 11, 7, 0, 0, Math.PI * 2);
      ctx!.fill();

      // Head
      ctx!.fillStyle = '#ff7b54';
      ctx!.beginPath();
      ctx!.ellipse(15, -1, 9, 7, 0, 0, Math.PI * 2);
      ctx!.fill();

      // Eye
      ctx!.fillStyle = '#0b1026';
      ctx!.beginPath();
      ctx!.arc(17, -4, 2.5, 0, Math.PI * 2);
      ctx!.fill();

      // Tail
      ctx!.strokeStyle = '#ff7b54';
      ctx!.lineWidth = 5;
      ctx!.lineCap = 'round';
      ctx!.beginPath();
      ctx!.moveTo(-15, 2);
      ctx!.quadraticCurveTo(-26, 6, -22, 14);
      ctx!.stroke();

      ctx!.restore();
    }

    function draw() {
      ctx!.clearRect(0, 0, VW, VH);

      const shakeFactor = shake.total > 0 ? shake.time / shake.total : 0;
      const offsetX = (Math.random() - 0.5) * shake.mag * shakeFactor;
      const offsetY = (Math.random() - 0.5) * shake.mag * shakeFactor;

      ctx!.save();
      ctx!.translate(offsetX, offsetY);

      // Gradient Sky Canvas Background
      const [c0, c1, c2] = paletteForLevel(curLevel);
      const grad = ctx!.createLinearGradient(0, 0, 0, VH);
      grad.addColorStop(0, c0);
      grad.addColorStop(0.55, c1);
      grad.addColorStop(1, c2);
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, VW, VH);

      // Twinkling Celestial Stars
      for (const s of stars) {
        ctx!.globalAlpha = 0.3 + Math.sin(s.twinkle) * 0.3;
        ctx!.fillStyle = '#ffffff';
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      // Cloud Layers
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.18)';
      for (const c of clouds) {
        ctx!.beginPath();
        ctx!.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx!.arc(c.x + c.r * 0.7, c.y + 4, c.r * 0.7, 0, Math.PI * 2);
        ctx!.arc(c.x - c.r * 0.7, c.y + 6, c.r * 0.6, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Dragon Gates
      for (const g of gates) {
        const topEdge = g.centerY - gapForLevel(curLevel) / 2;
        const botEdge = g.centerY + gapForLevel(curLevel) / 2;
        drawDragonGatePillar(g.x, topEdge, botEdge, g.width, true);
        drawDragonGatePillar(g.x, topEdge, botEdge, g.width, false);
      }

      // Particles
      for (const p of particles) {
        ctx!.fillStyle = `rgba(${p.colorBase},${Math.max(0, p.life / p.maxLife)})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      drawDragon();

      if (flash.alpha > 0) {
        ctx!.fillStyle = `rgba(${flash.colorBase},${flash.alpha})`;
        ctx!.fillRect(0, 0, VW, VH);
      }

      ctx!.restore();
    }

    function loop(time: number) {
      if (!lastTime) lastTime = time;
      const dt = Math.min(0.033, (time - lastTime) / 1000);
      lastTime = time;
      update(dt);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    function handleInput(e: Event) {
      if (e.type === 'keydown' && (e as KeyboardEvent).code !== 'Space') return;
      if ((e as any).cancelable) e.preventDefault();
      if (!hasStarted || !running) return;
      flap();
    }

    wrap.addEventListener('pointerdown', handleInput);
    window.addEventListener('keydown', handleInput);

    (wrap as any).__startGame = () => {
      hasStarted = true;
      setStarted(true);
      resetRun();
    };
    (wrap as any).__retryGame = () => {
      setShowReviveOffer(false);
      resetRun();
    };
    (wrap as any).__declineRevive = () => {
      setShowReviveOffer(false);
      finalizeGameOver(runScore);
    };
    (wrap as any).__completeRevive = () => {
      reviveUsed = true;
      invincibleUntil = elapsed + 1.8;
      dragon.y = VH / 2;
      dragon.vy = 0;
      gates = [];
      spawnGate(VW + 100);
      spawnGate(VW + 100 + GATE_SPACING);
      spawnGate(VW + 100 + GATE_SPACING * 2);
      running = true;
      setGameState('playing');
      setShowReviveOffer(false);
      lastTime = 0;
    };

    initEnvironment();
    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      wrap.removeEventListener('pointerdown', handleInput);
      window.removeEventListener('keydown', handleInput);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (levelUpTimeoutRef.current) clearTimeout(levelUpTimeoutRef.current);
    };
  }, []);

  const [started, setStarted] = useState(false);
  const progressInLevel = ((score % SCORE_PER_LEVEL) / SCORE_PER_LEVEL) * 100;

  return (
    <div id="app">
      <link
        href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap"
        rel="stylesheet"
      />

      <div className="game-shell">
        {/* Left Side Ad Slot (aligned with SkyStrike layout) */}
        <div className="ad-slot ad-side" data-ad-slot="side-left" aria-hidden="true">
          <span>{tt('adBannerPlaceholder', 'Quảng cáo Banner')}</span>
        </div>

        {/* STAGE WRAPPER */}
        <div className="stage-wrap" ref={stageWrapRef}>
          <canvas ref={canvasRef} id="game" />

          {/* HUD (SkyStrike Style) */}
          {gameState === 'playing' && (
            <div className="hud">
              <div className="hud-top">
                <div className="hud-block">
                  <div className="score-label">{tt('scoreLabel', 'ĐIỂM')}</div>
                  <div className="score-value">{score}</div>
                  <div className="best-hud">
                    {tt('best', 'Kỷ lục')}: {best}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="level-pill">
                    <span>{tt('level', 'Cấp')} {level}</span>
                    <div className="level-progress">
                      <div className="level-progress-fill" style={{ width: `${progressInLevel}%` }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pause-btn"
                    onClick={toggleMute}
                    aria-label={muted ? tt('unmute', 'Bật âm') : tt('mute', 'Tắt âm')}
                  >
                    {muted ? '🔇' : '🔊'}
                  </button>
                </div>
              </div>

              {levelUpToast !== null && (
                <div className="level-flash">
                  <span>LÊN CẤP {levelUpToast}!</span>
                  <small>{tt('instructionsExtra', 'Độ khó tăng dần — cố lên!')}</small>
                </div>
              )}
            </div>
          )}

          {/* START OVERLAY SCREEN */}
          {!started && (
            <div className="screen">
              <div className="logo">
                🐉 DRAGON<span>GATE</span>
              </div>
              <div className="tagline">{tt('subtitle', 'Bay xuyên cổng rồng, phá kỷ lục của chính bạn')}</div>
              <div className="hiscore-pill">
                {tt('best', 'Kỷ lục')}: {best}
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => (stageWrapRef.current as any)?.__startGame?.()}
              >
                {tt('playButton', 'CHƠI NGAY')}
              </button>
              <div className="hint">
                {tt('instructions', 'Chạm màn hình hoặc nhấn phím Space để bay lên')}
              </div>
            </div>
          )}

          {/* REVIVE OFFER OVERLAY */}
          {showReviveOffer && (
            <div className="screen">
              <div className="final-label">{tt('gameOverScore', 'ĐIỂM')}</div>
              <div className="final-score">{score}</div>
              {reviveAvailable ? (
                <>
                  <div className="tagline">
                    {tt('continuePrompt', 'Xem quảng cáo để hồi sinh và chơi tiếp?')}
                  </div>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => (stageWrapRef.current as any)?.__completeRevive?.()}
                  >
                    ▶ {tt('watchAdContinue', 'XEM QC ĐỂ HỒI SINH')}
                  </button>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => (stageWrapRef.current as any)?.__declineRevive?.()}
                  >
                    {tt('endRunButton', 'Kết thúc lượt chơi')}
                  </button>
                </>
              ) : (
                <button
                  className="btn"
                  type="button"
                  onClick={() => (stageWrapRef.current as any)?.__declineRevive?.()}
                >
                  {tt('continueButton', 'TIẾP TỤC')}
                </button>
              )}
            </div>
          )}

          {/* INTERSTITIAL AD OVERLAY */}
          {showInterstitial && (
            <div className="screen ad-screen">
              <div className="ad-badge">{tt('adLabel', 'QUẢNG CÁO')}</div>
              <div className="ad-mock-box">
                <div className="ad-mock-title">{tt('adPlaceholder', 'Vị trí quảng cáo xen kẽ (Interstitial)')}</div>
              </div>
              <button className="btn" type="button" onClick={() => setShowInterstitial(false)}>
                ✕ {tt('adClose', 'Đóng')}
              </button>
            </div>
          )}

          {/* GAME OVER SCREEN */}
          {gameState === 'over' && !showReviveOffer && (
            <div className="screen">
              {isNewRecord && <div className="record-badge">🏆 {tt('newRecord', 'KỶ LỤC MỚI!')}</div>}
              <div className="final-label">{tt('gameOverScore', 'ĐIỂM')}</div>
              <div className="final-score">{finalScore}</div>
              <div className="hiscore-pill">
                {tt('best', 'Kỷ lục')}: {best}
              </div>
              {!doubledApplied && (
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    setDoubledApplied(true);
                    setFinalScore((prev) => prev * 2);
                  }}
                >
                  🎬 {tt('watchAdDouble', 'XEM QC NHÂN ĐÔI ĐIỂM')}
                </button>
              )}
              <button
                className="btn"
                type="button"
                onClick={() => (stageWrapRef.current as any)?.__retryGame?.()}
              >
                {tt('retryButton', 'CHƠI LẠI')}
              </button>
            </div>
          )}
        </div>

        {/* Right Side Ad Slot (aligned with SkyStrike layout) */}
        <div className="ad-slot ad-side" data-ad-slot="side-right" aria-hidden="true">
          <span>{tt('adBannerPlaceholder', 'Quảng cáo Banner')}</span>
        </div>
      </div>

      <div className="about">
        <p className="footer-note">
          {tt('footerNote', 'DragonGate — trò chơi giải trí nhẹ nhàng, chơi mọi lúc rảnh rỗi.')}
        </p>
      </div>

      {/* Sticky Bottom Banner */}
      <div className="banner-ad-slot" aria-hidden="true">
        <span>{tt('adBannerPlaceholder', 'Quảng cáo Banner 320×50')}</span>
      </div>

      <style jsx global>{`
        :root {
          --sky-deep: #0b1026;
          --sky-mid: #1d2951;
          --sky-horizon: #3a3f7a;
          --sunset-soft: #ffb27a;
          --cyan: #4fd8eb;
          --cyan-dim: #2a8fa3;
          --gold: #ffd66b;
          --cloud: #eef3f9;
          --ink: #0b1026;
          --panel: rgba(11, 16, 38, 0.82);
          --panel-border: rgba(79, 216, 235, 0.28);
          --font-display: 'Rajdhani', system-ui, sans-serif;
          --font-body: 'Rajdhani', system-ui, sans-serif;
        }

        #app * {
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }

        #app {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: radial-gradient(
            ellipse at 50% 0%,
            var(--sky-horizon) 0%,
            var(--sky-mid) 45%,
            var(--sky-deep) 100%
          );
          font-family: var(--font-body);
          color: var(--cloud);
          overflow-x: hidden;
          min-height: 100vh;
          padding-bottom: calc(74px + env(safe-area-inset-bottom, 0px));
        }

        .game-shell {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 16px;
          width: 100%;
          max-width: 1200px;
          min-width: 320px;
        }

        .ad-slot.ad-side {
          display: none;
          width: 160px;
          height: 600px;
          background: rgba(11, 16, 38, 0.6);
          border: 1px dashed var(--panel-border);
          border-radius: 12px;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: rgba(238, 243, 249, 0.4);
        }

        @media (min-width: 900px) {
          .ad-slot.ad-side {
            display: flex;
          }
        }

        .stage-wrap {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 450px;
          aspect-ratio: 9 / 16;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(79, 216, 235, 0.22), 0 20px 60px rgba(0, 0, 0, 0.55);
          background: var(--sky-deep);
          touch-action: none;
          user-select: none;
        }

        .stage-wrap canvas {
          display: block;
          width: 100%;
          height: 100%;
        }

        .hud {
          position: absolute;
          inset: 0;
          pointer-events: none;
          font-family: var(--font-display);
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
          gap: 8px;
        }

        .hud-block {
          background: var(--panel);
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          padding: 6px 12px;
          backdrop-filter: blur(4px);
        }

        .score-label {
          font-size: 10px;
          letter-spacing: 0.1em;
          color: var(--sunset-soft);
        }

        .score-value {
          font-size: 24px;
          font-weight: 700;
          line-height: 1;
          color: var(--cloud);
        }

        .best-hud {
          font-size: 11px;
          color: var(--cyan);
          margin-top: 2px;
        }

        .level-pill {
          background: var(--panel);
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          padding: 6px 12px;
          font-size: 12px;
          color: var(--gold);
          min-width: 76px;
        }

        .level-progress {
          margin-top: 4px;
          width: 100%;
          height: 4px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.15);
          overflow: hidden;
        }

        .level-progress-fill {
          height: 100%;
          background: var(--gold);
          transition: width 0.2s ease;
        }

        .pause-btn {
          pointer-events: auto;
          background: var(--panel);
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          width: 34px;
          height: 34px;
          font-size: 14px;
          cursor: pointer;
          color: var(--cloud);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .level-flash {
          position: absolute;
          top: 70px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(11, 16, 38, 0.88);
          border: 1px solid var(--gold);
          padding: 8px 20px;
          border-radius: 20px;
          box-shadow: 0 0 20px rgba(255, 214, 107, 0.4);
          animation: flash-pop 0.3s ease;
        }

        .level-flash span {
          font-size: 18px;
          font-weight: 700;
          color: var(--gold);
        }

        .level-flash small {
          font-size: 10px;
          color: rgba(238, 243, 249, 0.7);
        }

        @keyframes flash-pop {
          from {
            transform: translateX(-50%) scale(0.8);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
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
          background: linear-gradient(180deg, rgba(11, 16, 38, 0.92), rgba(11, 16, 38, 0.97));
          backdrop-filter: blur(4px);
          z-index: 10;
        }

        .ad-screen {
          background: linear-gradient(180deg, rgba(5, 8, 20, 0.97), rgba(5, 8, 20, 0.99));
        }

        .ad-badge {
          font-size: 11px;
          letter-spacing: 0.14em;
          color: rgba(238, 243, 249, 0.55);
        }

        .ad-mock-box {
          width: 84%;
          max-width: 300px;
          padding: 26px 16px;
          border: 1px dashed var(--panel-border);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
        }

        .ad-mock-title {
          font-size: 14px;
          color: var(--cloud);
        }

        .logo {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 38px;
          letter-spacing: 0.02em;
          color: var(--cloud);
          text-shadow: 0 0 18px rgba(79, 216, 235, 0.55);
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
          color: rgba(238, 243, 249, 0.6);
          max-width: 280px;
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
          letter-spacing: 0.04em;
          color: var(--ink);
          background: linear-gradient(180deg, var(--cyan), var(--cyan-dim));
          border: none;
          border-radius: 12px;
          padding: 14px 40px;
          cursor: pointer;
          box-shadow: 0 6px 0 var(--cyan-dim), 0 10px 24px rgba(79, 216, 235, 0.35);
          transition: transform 0.08s ease;
        }

        .btn:active {
          transform: translateY(4px);
          box-shadow: 0 2px 0 var(--cyan-dim);
        }

        .btn-ghost {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.03em;
          color: var(--gold);
          background: transparent;
          border: 1px solid rgba(255, 214, 107, 0.4);
          border-radius: 10px;
          padding: 9px 20px;
          cursor: pointer;
        }

        .final-score {
          font-size: 40px;
          font-weight: 700;
          color: var(--cloud);
        }

        .final-label {
          font-size: 11px;
          letter-spacing: 0.1em;
          color: var(--sunset-soft);
        }

        .record-badge {
          font-size: 13px;
          font-weight: 700;
          color: var(--gold);
        }

        .about {
          max-width: 640px;
          width: 100%;
          padding: 16px 20px;
          text-align: center;
        }

        .footer-note {
          font-size: 12px;
          color: rgba(238, 243, 249, 0.6);
        }

        .banner-ad-slot {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: calc(50px + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: rgba(11, 16, 38, 0.94);
          border-top: 1px solid var(--panel-border);
        }

        .banner-ad-slot span {
          width: 320px;
          max-width: 92vw;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: rgba(238, 243, 249, 0.4);
          border: 1px dashed rgba(238, 243, 249, 0.2);
          border-radius: 6px;
        }
      `}</style>
    </div>
  );
}