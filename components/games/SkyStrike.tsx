'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const VW = 480;
const VH = 800;
const STORAGE_KEY = 'skystrike_highscore';

type GameState = 'start' | 'playing' | 'paused' | 'over';
type PowerupType = 'rapid' | 'spread' | 'shield' | 'life' | 'score';

interface Player {
  x: number;
  y: number;
  r: number;
  speed: number;
  fireCd: number;
  fireRate: number;
  spread: boolean;
  spreadT: number;
  rapid: boolean;
  rapidT: number;
  shield: boolean;
  shieldT: number;
  invuln: number;
  trail: { x: number; y: number; t: number }[];
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hit?: boolean;
}

interface Enemy {
  type: 'scout' | 'zigzag' | 'bomber' | 'boss';
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp?: number;
  score: number;
  fireCd: number;
  phase?: number;
  entering?: boolean;
  dead?: boolean;
}

interface Powerup {
  x: number;
  y: number;
  r: number;
  vy: number;
  type: PowerupType;
  hit?: boolean;
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

interface Cloud {
  x: number;
  y: number;
  r: number;
  s: number;
  a: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  s: number;
  tw: number;
}

export default function SkyStrike() {
  const t = useTranslations('skyStrike');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);

  // React states
  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [combo, setCombo] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [wave, setWave] = useState<number>(1);
  const [activePowerups, setActivePowerups] = useState<{ shield: boolean; rapid: boolean; spread: boolean }>({
    shield: false,
    rapid: false,
    spread: false,
  });

  // Engine Mutable Refs
  const gameStateRef = useRef<GameState>('start');
  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(0);
  const comboTimerRef = useRef<number>(0);
  const livesRef = useRef<number>(3);
  const maxLives = 5;
  const waveRef = useRef<number>(1);
  const waveTimerRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const difficultyRef = useRef<number>(1);
  const elapsedRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);

  const inputRef = useRef<{
    targetX: number;
    targetY: number;
    keys: Record<string, boolean>;
  }>({
    targetX: VW / 2,
    targetY: VH * 0.8,
    keys: {},
  });

  const playerRef = useRef<Player>({
    x: VW / 2,
    y: VH * 0.8,
    r: 16,
    speed: 9,
    fireCd: 0,
    fireRate: 0.18,
    spread: false,
    spreadT: 0,
    rapid: false,
    rapidT: 0,
    shield: false,
    shieldT: 0,
    invuln: 0,
    trail: [],
  });

  const bulletsRef = useRef<Bullet[]>([]);
  const ebulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const powerupsRef = useRef<Powerup[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const starsRef = useRef<Star[]>([]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10) || 0;
        setHighScore(parsed);
      }
    } catch {
      // Ignore
    }
  }, []);

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const chance = (p: number) => Math.random() < p;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const dist2 = (ax: number, ay: number, bx: number, by: number) => {
    const dx = ax - bx,
      dy = ay - by;
    return dx * dx + dy * dy;
  };

  const updateHUD = () => {
    setScore(Math.floor(scoreRef.current));
    setCombo(comboRef.current);
    setLives(livesRef.current);
    setWave(waveRef.current);

    const p = playerRef.current;
    setActivePowerups({
      shield: p.shield,
      rapid: p.rapid,
      spread: p.spread,
    });
  };

  const saveHighScore = (val: number) => {
    setHighScore(val);
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
    } catch {
      // Ignore
    }
  };

  const initBackground = () => {
    cloudsRef.current = [];
    for (let i = 0; i < 10; i++) {
      cloudsRef.current.push({
        x: rand(0, VW),
        y: rand(0, VH),
        r: rand(30, 80),
        s: rand(20, 50),
        a: rand(0.05, 0.16),
      });
    }
    starsRef.current = [];
    for (let i = 0; i < 50; i++) {
      starsRef.current.push({
        x: rand(0, VW),
        y: rand(0, VH * 0.5),
        r: rand(0.5, 1.6),
        s: rand(6, 18),
        tw: rand(0, Math.PI * 2),
      });
    }
  };

  const resetGame = () => {
    scoreRef.current = 0;
    comboRef.current = 0;
    comboTimerRef.current = 0;
    livesRef.current = 3;
    waveRef.current = 1;
    waveTimerRef.current = 0;
    spawnTimerRef.current = 0;
    difficultyRef.current = 1;
    elapsedRef.current = 0;
    shakeRef.current = 0;

    const p = playerRef.current;
    p.x = VW / 2;
    p.y = VH * 0.8;
    p.fireCd = 0;
    p.spread = false;
    p.rapid = false;
    p.shield = false;
    p.invuln = 1.5;
    p.trail = [];

    bulletsRef.current = [];
    ebulletsRef.current = [];
    enemiesRef.current = [];
    powerupsRef.current = [];
    particlesRef.current = [];

    inputRef.current.targetX = VW / 2;
    inputRef.current.targetY = VH * 0.8;

    updateHUD();
  };

  const burst = (x: number, y: number, color: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 180) * 0.016;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(a) * sp * 10,
        vy: Math.sin(a) * sp * 10,
        life: rand(0.3, 0.7),
        t: 0,
        color,
        r: rand(1.5, 3.5),
      });
    }
  };

  const spawnEnemy = () => {
    const diff = difficultyRef.current;
    const t = chance(0.12 + diff * 0.01) ? 'bomber' : chance(0.75) ? 'scout' : 'zigzag';
    const x = rand(30, VW - 30);

    if (t === 'scout') {
      enemiesRef.current.push({
        type: t,
        x,
        y: -20,
        r: 14,
        vx: 0,
        vy: (rand(90, 130) * 0.01 * 100) / 60 + diff * 0.3 + 1.6,
        hp: 1,
        score: 10,
        fireCd: rand(1, 2),
      });
    } else if (t === 'zigzag') {
      enemiesRef.current.push({
        type: t,
        x,
        y: -20,
        r: 15,
        vx: rand(-1, 1) < 0 ? -1.2 : 1.2,
        vy: 1.3 + diff * 0.25,
        hp: 2,
        score: 18,
        fireCd: rand(1, 2),
        phase: rand(0, 10),
      });
    } else {
      enemiesRef.current.push({
        type: t,
        x,
        y: -30,
        r: 22,
        vx: 0,
        vy: 0.8 + diff * 0.12,
        hp: 5 + Math.floor(diff * 0.6),
        score: 40,
        fireCd: rand(0.6, 1.2),
      });
    }
  };

  const maybeSpawnBoss = () => {
    const w = waveRef.current;
    enemiesRef.current.push({
      type: 'boss',
      x: VW / 2,
      y: -70,
      r: 44,
      vx: 1.4,
      vy: 0.5,
      hp: 60 + w * 18,
      maxHp: 60 + w * 18,
      score: 400 + w * 40,
      fireCd: 1,
      phase: 0,
      entering: true,
    });
  };

  const spawnPowerup = (x: number, y: number) => {
    const roll = Math.random();
    let type: PowerupType;
    if (roll < 0.28) type = 'rapid';
    else if (roll < 0.52) type = 'spread';
    else if (roll < 0.72) type = 'shield';
    else if (roll < 0.86) type = 'life';
    else type = 'score';

    powerupsRef.current.push({ x, y, r: 11, vy: 2.2, type });
  };

  const applyPowerup = (type: PowerupType) => {
    const p = playerRef.current;
    if (type === 'rapid') {
      p.rapid = true;
      p.rapidT = 8;
    } else if (type === 'spread') {
      p.spread = true;
      p.spreadT = 8;
    } else if (type === 'shield') {
      p.shield = true;
      p.shieldT = 5;
    } else if (type === 'life') {
      livesRef.current = Math.min(maxLives, livesRef.current + 1);
    } else if (type === 'score') {
      scoreRef.current += 60;
    }
    updateHUD();
  };

  const damagePlayer = () => {
    const p = playerRef.current;
    if (p.invuln > 0 || p.shield) return;

    livesRef.current -= 1;
    p.invuln = 1.6;
    shakeRef.current = 10;
    burst(p.x, p.y, '#ff4365', 18);
    comboRef.current = 0;
    updateHUD();

    if (livesRef.current <= 0) {
      gameOver();
    }
  };

  const gameOver = () => {
    setGameState('over');
    const finalSc = Math.floor(scoreRef.current);
    const isRecord = finalSc > highScore;
    setIsNewRecord(isRecord);

    if (isRecord) {
      saveHighScore(finalSc);
    }
  };

  const playerShoot = (dt: number) => {
    const p = playerRef.current;
    p.fireCd -= dt;
    const rate = p.rapid ? p.fireRate * 0.45 : p.fireRate;
    if (p.fireCd <= 0) {
      p.fireCd = rate;
      if (p.spread) {
        bulletsRef.current.push({ x: p.x, y: p.y - 18, vx: 0, vy: -11, r: 4 });
        bulletsRef.current.push({ x: p.x, y: p.y - 14, vx: -3.2, vy: -10.4, r: 4 });
        bulletsRef.current.push({ x: p.x, y: p.y - 14, vx: 3.2, vy: -10.4, r: 4 });
      } else {
        bulletsRef.current.push({ x: p.x - 7, y: p.y - 16, vx: 0, vy: -11, r: 3.5 });
        bulletsRef.current.push({ x: p.x + 7, y: p.y - 16, vx: 0, vy: -11, r: 3.5 });
      }
    }
  };

  const update = (dt: number) => {
    elapsedRef.current += dt;
    difficultyRef.current = 1 + elapsedRef.current / 28;

    const p = playerRef.current;
    const keys = inputRef.current.keys;

    const kx = (keys['arrowright'] || keys['d'] ? 1 : 0) - (keys['arrowleft'] || keys['a'] ? 1 : 0);
    const ky = (keys['arrowdown'] || keys['s'] ? 1 : 0) - (keys['arrowup'] || keys['w'] ? 1 : 0);

    if (kx || ky) {
      inputRef.current.targetX += kx * p.speed;
      inputRef.current.targetY += ky * p.speed;
    }

    inputRef.current.targetX = clamp(inputRef.current.targetX, 20, VW - 20);
    inputRef.current.targetY = clamp(inputRef.current.targetY, VH * 0.35, VH - 30);

    p.x += (inputRef.current.targetX - p.x) * Math.min(1, dt * 10);
    p.y += (inputRef.current.targetY - p.y) * Math.min(1, dt * 10);

    p.trail.push({ x: p.x, y: p.y + 16, t: 0 });
    if (p.trail.length > 10) p.trail.shift();

    if (p.invuln > 0) p.invuln -= dt;
    if (p.rapid) {
      p.rapidT -= dt;
      if (p.rapidT <= 0) p.rapid = false;
    }
    if (p.spread) {
      p.spreadT -= dt;
      if (p.spreadT <= 0) p.spread = false;
    }
    if (p.shield) {
      p.shieldT -= dt;
      if (p.shieldT <= 0) p.shield = false;
    }

    playerShoot(dt);

    if (comboTimerRef.current > 0) {
      comboTimerRef.current -= dt;
      if (comboTimerRef.current <= 0) comboRef.current = 0;
    }

    waveTimerRef.current += dt;
    spawnTimerRef.current -= dt;

    const spawnInterval = Math.max(0.35, 1.15 - difficultyRef.current * 0.08);
    if (spawnTimerRef.current <= 0 && enemiesRef.current.filter((e) => e.type !== 'boss').length < 8) {
      spawnTimerRef.current = spawnInterval;
      spawnEnemy();
    }

    if (waveTimerRef.current > 16 + waveRef.current * 1.5) {
      waveTimerRef.current = 0;
      waveRef.current += 1;
      if (waveRef.current % 4 === 0 && !enemiesRef.current.some((e) => e.type === 'boss')) {
        maybeSpawnBoss();
      }
      updateHUD();
    }

    bulletsRef.current.forEach((b) => {
      b.x += b.vx;
      b.y += b.vy;
    });
    bulletsRef.current = bulletsRef.current.filter((b) => b.y > -20 && b.x > -20 && b.x < VW + 20);

    ebulletsRef.current.forEach((b) => {
      b.x += b.vx;
      b.y += b.vy;
    });
    ebulletsRef.current = ebulletsRef.current.filter((b) => b.y < VH + 20 && b.y > -20);

    enemiesRef.current.forEach((e) => {
      if (e.type === 'scout') {
        e.y += e.vy;
      } else if (e.type === 'zigzag') {
        e.y += e.vy;
        e.phase = (e.phase || 0) + dt * 3;
        e.x += Math.sin(e.phase) * 2.2;
        e.x = clamp(e.x, 20, VW - 20);
      } else if (e.type === 'bomber') {
        e.y += e.vy;
      } else if (e.type === 'boss') {
        if (e.entering) {
          e.y += 0.8;
          if (e.y > 90) e.entering = false;
        } else {
          e.phase = (e.phase || 0) + dt;
          e.x = VW / 2 + Math.sin(e.phase * 0.8) * (VW * 0.32);
        }
      }

      e.fireCd -= dt;
      if (!e.entering && e.fireCd <= 0 && e.y > 0) {
        e.fireCd = e.type === 'boss' ? rand(0.35, 0.6) : rand(1.1, 2.2) / difficultyRef.current;
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        const sp = e.type === 'boss' ? 4.6 : 3.6;
        ebulletsRef.current.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          r: e.type === 'boss' ? 5 : 3.5,
        });
      }
    });
    enemiesRef.current = enemiesRef.current.filter((e) => e.y < VH + 60);

    powerupsRef.current.forEach((pu) => {
      pu.y += pu.vy;
    });
    powerupsRef.current = powerupsRef.current.filter((pu) => pu.y < VH + 20);

    particlesRef.current.forEach((pt) => {
      pt.t += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    });
    particlesRef.current = particlesRef.current.filter((pt) => pt.t < pt.life);

    for (const e of enemiesRef.current) {
      for (const b of bulletsRef.current) {
        if (b.hit) continue;
        const rr = (e.r + b.r) * (e.r + b.r);
        if (dist2(e.x, e.y, b.x, b.y) < rr) {
          b.hit = true;
          e.hp -= 1;
          burst(b.x, b.y, '#ffb27a', 4);
          if (e.hp <= 0) {
            e.dead = true;
            comboRef.current += 1;
            comboTimerRef.current = 1.6;
            const gained = e.score * (1 + comboRef.current * 0.12);
            scoreRef.current += gained;
            burst(e.x, e.y, e.type === 'boss' ? '#ff7b54' : '#4fd8eb', e.type === 'boss' ? 46 : 16);
            shakeRef.current = Math.max(shakeRef.current, e.type === 'boss' ? 16 : 4);

            if (chance(e.type === 'boss' ? 1 : 0.22)) spawnPowerup(e.x, e.y);
            if (e.type === 'boss') {
              for (let k = 0; k < 5; k++) spawnPowerup(e.x + rand(-30, 30), e.y + rand(-10, 10));
            }
          }
        }
      }
    }
    bulletsRef.current = bulletsRef.current.filter((b) => !b.hit);
    enemiesRef.current = enemiesRef.current.filter((e) => {
      if (e.dead) updateHUD();
      return !e.dead;
    });

    for (const b of ebulletsRef.current) {
      if (b.hit) continue;
      if (dist2(b.x, b.y, p.x, p.y) < (p.r * 0.6 + b.r) * (p.r * 0.6 + b.r)) {
        b.hit = true;
        damagePlayer();
      }
    }
    ebulletsRef.current = ebulletsRef.current.filter((b) => !b.hit);

    for (const e of enemiesRef.current) {
      if (dist2(e.x, e.y, p.x, p.y) < (p.r * 0.7 + e.r * 0.7) * (p.r * 0.7 + e.r * 0.7)) {
        if (e.type !== 'boss') {
          e.dead = true;
          burst(e.x, e.y, '#ff4365', 10);
        }
        damagePlayer();
      }
    }
    enemiesRef.current = enemiesRef.current.filter((e) => !e.dead);

    for (const pu of powerupsRef.current) {
      if (pu.hit) continue;
      if (dist2(pu.x, pu.y, p.x, p.y) < (p.r + pu.r) * (p.r + pu.r)) {
        pu.hit = true;
        applyPowerup(pu.type);
      }
    }
    powerupsRef.current = powerupsRef.current.filter((pu) => !pu.hit);

    if (shakeRef.current > 0) {
      shakeRef.current = Math.max(0, shakeRef.current - dt * 40);
    }

    updateHUD();
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, p: Player) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#4fd8eb';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 14);
    ctx.lineTo(0, 8);
    ctx.lineTo(-12, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0b1026';
    ctx.beginPath();
    ctx.ellipse(0, -4, 3.4, 6, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: Enemy) => {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === 'scout') {
      ctx.fillStyle = '#ff4365';
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(11, -10);
      ctx.lineTo(0, -4);
      ctx.lineTo(-11, -10);
      ctx.closePath();
      ctx.fill();
    } else if (e.type === 'zigzag') {
      ctx.fillStyle = '#ff7b54';
      ctx.beginPath();
      ctx.moveTo(0, 15);
      ctx.lineTo(13, 0);
      ctx.lineTo(0, -15);
      ctx.lineTo(-13, 0);
      ctx.closePath();
      ctx.fill();
    } else if (e.type === 'bomber') {
      ctx.fillStyle = '#c93b52';
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 13, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#7a1f2f';
      ctx.fillRect(-26, -3, 10, 6);
      ctx.fillRect(16, -3, 10, 6);
    } else if (e.type === 'boss') {
      ctx.fillStyle = '#ff7b54';
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.lineTo(44, -10);
      ctx.lineTo(20, -26);
      ctx.lineTo(0, -8);
      ctx.lineTo(-20, -26);
      ctx.lineTo(-44, -10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a1220';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, 7);
      ctx.fill();
      ctx.restore();
      const w = 90;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(e.x - w / 2, e.y - 58, w, 6);
      ctx.fillStyle = '#ff4365';
      ctx.fillRect(e.x - w / 2, e.y - 58, w * clamp(e.hp / (e.maxHp || 1), 0, 1), 6);
      return;
    }
    ctx.restore();
  };

  const drawPowerup = (ctx: CanvasRenderingContext2D, p: Powerup) => {
    const colors: Record<PowerupType, string> = {
      rapid: '#ffb27a',
      spread: '#ff4365',
      shield: '#4fd8eb',
      life: '#7CFF9B',
      score: '#ffe27a',
    };
    const glyph: Record<PowerupType, string> = {
      rapid: '⚡',
      spread: '✦',
      shield: '◈',
      life: '+',
      score: '$',
    };
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = colors[p.type];
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b1026';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph[p.type], 0, 1);
    ctx.restore();
  };

  const render = (ctx: CanvasRenderingContext2D, dt: number) => {
    ctx.clearRect(0, 0, VW, VH);
    ctx.save();

    if (shakeRef.current > 0) {
      ctx.translate(
        rand(-shakeRef.current, shakeRef.current) * 0.15,
        rand(-shakeRef.current, shakeRef.current) * 0.15
      );
    }

    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0b1026');
    g.addColorStop(0.55, '#1d2951');
    g.addColorStop(1, '#2a3568');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    for (const s of starsRef.current) {
      s.y += s.s * dt;
      if (s.y > VH * 0.55) s.y = -2;
      s.tw += dt * 2;
      ctx.globalAlpha = 0.4 + Math.sin(s.tw) * 0.3;
      ctx.fillStyle = '#eef3f9';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const c of cloudsRef.current) {
      c.y += c.s * dt;
      if (c.y - c.r > VH) {
        c.y = -c.r;
        c.x = rand(0, VW);
      }
      ctx.globalAlpha = c.a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r, c.r * 0.5, 0, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
      const p = playerRef.current;

      for (let i = 0; i < p.trail.length; i++) {
        const t = p.trail[i];
        ctx.globalAlpha = (i / p.trail.length) * 0.5;
        ctx.fillStyle = '#ff7b54';
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0;
      if (!blink) {
        drawPlayer(ctx, p);
      }
      if (p.shield) {
        ctx.strokeStyle = 'rgba(79,216,235,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 8, 0, 7);
        ctx.stroke();
      }

      ctx.fillStyle = '#bff3fb';
      for (const b of bulletsRef.current) {
        ctx.beginPath();
        ctx.rect(b.x - b.r * 0.6, b.y - b.r * 1.6, b.r * 1.2, b.r * 3.2);
        ctx.fill();
      }

      ctx.fillStyle = '#ffb27a';
      for (const b of ebulletsRef.current) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, 7);
        ctx.fill();
      }

      for (const e of enemiesRef.current) {
        drawEnemy(ctx, e);
      }

      for (const pu of powerupsRef.current) {
        drawPowerup(ctx, pu);
      }

      for (const pt of particlesRef.current) {
        ctx.globalAlpha = 1 - pt.t / pt.life;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, 7);
        ctx.fill();
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
      const x = ((clientX - rect.left) / rect.width) * VW;
      const y = ((clientY - rect.top) / rect.height) * VH;
      return { x, y };
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      const p = stageToVirtual(t.clientX, t.clientY);
      inputRef.current.targetX = p.x;
      inputRef.current.targetY = p.y - 40;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      const p = stageToVirtual(t.clientX, t.clientY);
      inputRef.current.targetX = p.x;
      inputRef.current.targetY = p.y - 40;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const p = stageToVirtual(e.clientX, e.clientY);
      inputRef.current.targetX = p.x;
      inputRef.current.targetY = p.y;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      inputRef.current.keys[key] = true;

      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault();
      }

      if (key === 'p') {
        setGameState((prev) => {
          if (prev === 'playing') return 'paused';
          if (prev === 'paused') return 'playing';
          return prev;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      inputRef.current.keys[e.key.toLowerCase()] = false;
    };

    stageWrap.addEventListener('touchstart', handleTouchStart, { passive: false });
    stageWrap.addEventListener('touchmove', handleTouchMove, { passive: false });
    stageWrap.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

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
      stageWrap.removeEventListener('touchstart', handleTouchStart);
      stageWrap.removeEventListener('touchmove', handleTouchMove);
      stageWrap.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
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
      {/* Import Rajdhani font dynamically */}
      <link
        href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap"
        rel="stylesheet"
      />

      <div className="ad-slot ad-top" data-ad-slot="top-banner" aria-hidden="true">
        Vị trí quảng cáo 728×90 / responsive
      </div>

      <div className="game-shell">
        <div className="ad-slot ad-side" data-ad-slot="side-left" aria-hidden="true">
          Quảng cáo 160×600
        </div>

        <div className="stage-wrap" ref={stageWrapRef}>
          <canvas ref={canvasRef} id="game" />

          <div className="hud">
            <div className="hud-top">
              <div className="hud-block">
                <div className="score-label">{t('scoreLabel')}</div>
                <div className="score-value">{score}</div>
                <div className="combo">{combo > 1 ? `x${combo} combo` : ''}</div>
                <div className="lives">
                  {Array.from({ length: maxLives }).map((_, idx) => (
                    <div key={idx} className={`life-dot ${idx < lives ? '' : 'lost'}`} />
                  ))}
                </div>
              </div>
              <button
                className="pause-btn"
                onClick={handleTogglePause}
                aria-label="Tạm dừng"
                style={{ pointerEvents: 'auto' }}
              >
                ⏸
              </button>
            </div>

            <div className="wave-tag">{t('waveTag', { wave })}</div>

            <div className="powerup-bar">
              {activePowerups.shield && (
                <div className="pu-chip">
                  <span className="pu-dot" style={{ background: '#4fd8eb' }} />
                  {t('shield')}
                </div>
              )}
              {activePowerups.rapid && (
                <div className="pu-chip">
                  <span className="pu-dot" style={{ background: '#ffb27a' }} />
                  {t('rapid')}
                </div>
              )}
              {activePowerups.spread && (
                <div className="pu-chip">
                  <span className="pu-dot" style={{ background: '#ff4365' }} />
                  {t('spread')}
                </div>
              )}
            </div>
          </div>

          {gameState === 'start' && (
            <div className="screen">
              <div className="logo">
                SKY<span>STRIKE</span>
              </div>
              <div className="tagline">{t('tagline')}</div>
              <div className="hiscore-pill">{t('hiscorePill', { score: highScore })}</div>
              <button className="btn" onClick={handlePlay}>
                {t('playButton')}
              </button>
              <div
                className="hint"
                dangerouslySetInnerHTML={{ __html: t.raw('hint') }}
              />
            </div>
          )}

          {gameState === 'paused' && (
            <div className="screen">
              <div className="logo" style={{ fontSize: 30 }}>
                {t('pauseTitle')}
              </div>
              <button className="btn" onClick={() => setGameState('playing')}>
                {t('resumeButton')}
              </button>
              <button className="btn secondary" onClick={handlePlay}>
                {t('restartButton')}
              </button>
            </div>
          )}

          {gameState === 'over' && (
            <div className="screen">
              <div className="final-label">{t('finalLabel')}</div>
              <div className="final-score">{score}</div>
              {isNewRecord && <div className="record-badge">{t('newRecord')}</div>}
              <div className="hiscore-pill">
                {t('hiscorePill', { score: Math.max(highScore, score) })}
              </div>
              <button className="btn" onClick={handlePlay}>
                {t('replayButton')}
              </button>
              <div className="interstitial" data-ad-slot="gameover-interstitial" aria-hidden="true">
                Quảng cáo (khi kết thúc lượt chơi)
              </div>
            </div>
          )}
        </div>

        <div className="ad-slot ad-side" data-ad-slot="side-right" aria-hidden="true">
          Quảng cáo 160×600
        </div>
      </div>

      <div className="ad-slot ad-bottom" data-ad-slot="bottom-banner" aria-hidden="true">
        Vị trí quảng cáo 320×50 / responsive
      </div>

      <div className="about">
        <h1>{t('aboutTitle')}</h1>
        <p>{t('aboutP1')}</p>
        <h2>{t('aboutH2_1')}</h2>
        <p>{t('aboutP2')}</p>
        <h2>{t('aboutH2_2')}</h2>
        <p>{t('aboutP3')}</p>
      </div>

      <style jsx global>{`
        :root {
          --sky-deep: #0b1026;
          --sky-mid: #1d2951;
          --sky-horizon: #3a3f7a;
          --sunset: #ff7b54;
          --sunset-soft: #ffb27a;
          --cyan: #4fd8eb;
          --cyan-dim: #2a8fa3;
          --alert: #ff4365;
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
          min-height: 100vh;
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
        }

        .ad-slot {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          color: rgba(238, 243, 249, 0.35);
          font-size: 11px;
          letter-spacing: 0.06em;
          background: repeating-linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.03) 0 10px,
            rgba(255, 255, 255, 0.01) 10px 20px
          );
          border-top: 1px dashed rgba(238, 243, 249, 0.14);
          border-bottom: 1px dashed rgba(238, 243, 249, 0.14);
          flex-shrink: 0;
        }

        .ad-top {
          min-height: 60px;
          max-height: 90px;
        }
        .ad-bottom {
          min-height: 50px;
          max-height: 90px;
          margin-top: 8px;
        }
        .ad-side {
          width: 160px;
          min-width: 160px;
          height: 600px;
          writing-mode: vertical-rl;
        }

        @media (max-width: 900px) {
          .ad-side {
            display: none;
          }
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

        .stage-wrap {
          position: relative;
          width: 100%;
          max-width: 480px;
          aspect-ratio: 480 / 800;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(79, 216, 235, 0.22), 0 20px 60px rgba(0, 0, 0, 0.55),
            0 0 40px rgba(79, 216, 235, 0.08) inset;
          background: var(--sky-deep);
          touch-action: none;
          user-select: none;
        }

        canvas {
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

        .lives {
          display: flex;
          gap: 4px;
          margin-top: 4px;
        }

        .life-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--alert);
          box-shadow: 0 0 6px var(--alert);
        }

        .life-dot.lost {
          background: rgba(255, 255, 255, 0.12);
          box-shadow: none;
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
          top: 60px;
          right: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pu-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          background: var(--panel);
          border: 1px solid var(--panel-border);
          padding: 3px 8px;
          border-radius: 8px;
          font-size: 11px;
        }

        .pu-dot {
          width: 8px;
          height: 8px;
          border-radius: 2px;
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
          backdrop-filter: blur(2px);
          z-index: 10;
        }

        .logo {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 44px;
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
          max-width: 260px;
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

        .btn.secondary {
          background: transparent;
          color: var(--cloud);
          border: 1px solid var(--panel-border);
          box-shadow: none;
          padding: 10px 28px;
          font-size: 14px;
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
          font-size: 12px;
          color: #1a1206;
          background: var(--sunset-soft);
          padding: 3px 12px;
          border-radius: 20px;
          font-weight: 700;
        }

        .interstitial {
          width: 100%;
          max-width: 280px;
          min-height: 70px;
          border: 1px dashed rgba(238, 243, 249, 0.2);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(238, 243, 249, 0.35);
          font-size: 11px;
        }

        .about {
          max-width: 640px;
          width: 100%;
          padding: 28px 20px 40px;
          color: rgba(238, 243, 249, 0.55);
          font-size: 13px;
          line-height: 1.7;
        }

        .about h1 {
          font-size: 15px;
          color: var(--cloud);
          font-weight: 700;
          margin: 0 0 8px;
        }

        .about h2 {
          font-size: 13px;
          color: var(--sunset-soft);
          font-weight: 700;
          margin: 18px 0 6px;
        }
      `}</style>
    </div>
  );
}