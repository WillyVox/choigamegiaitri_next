'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

import { useTranslations } from 'next-intl';

// =========================================================
// TYPES & DATA STRUCTURES
// =========================================================
export type Language = 'en' | 'vi';

export interface PlantDef {
  // nameKey/descKey drive translated copy for the original roster. New
  // plants added here can instead set `name`/`desc` directly (plain text)
  // since they don't have translation entries yet — see plantLabel/plantDesc.
  nameKey?: string;
  name?: string;
  emoji: string;
  cost: number;
  cooldown: number;
  hp: number;
  role: 'sun' | 'shooter' | 'wall' | 'bomb';
  sunAmount?: number;
  sunEvery?: number;
  dmg?: number;
  rate?: number;
  shots?: number;
  slow?: number;
  slowTime?: number;
  splash?: number;
  fuse?: number;
  radius?: number;
  // Wall-type plants can chill any bug that claws at them, slowing the
  // attacker down for a bit — a cheap, simple way to add crowd control
  // without a new engine mechanic.
  contactSlow?: number;
  contactSlowTime?: number;
  unlock: number;
  descKey?: string;
  desc?: string;
}

export interface BugDef {
  nameKey: string;
  emoji: string;
  hp: number;
  speed: number;
  dmg: number;
  atkRate: number;
  points: number;
  flying?: boolean;
  boss?: boolean;
  color: string;
  factKey: string;
}

const PLANTS: Record<string, PlantDef> = {
  sunflower: { nameKey: 'plants_sunflower_name', emoji: '🌻', cost: 50, cooldown: 6000, hp: 100, role: 'sun', sunAmount: 25, sunEvery: 6000, unlock: 1, descKey: 'plants_sunflower_desc' },
  peashooter: { nameKey: 'plants_peashooter_name', emoji: '🌱', cost: 100, cooldown: 4000, hp: 100, role: 'shooter', dmg: 20, rate: 1200, shots: 1, unlock: 1, descKey: 'plants_peashooter_desc' },
  wallnut: { nameKey: 'plants_wallnut_name', emoji: '🌰', cost: 50, cooldown: 8000, hp: 400, role: 'wall', unlock: 1, descKey: 'plants_wallnut_desc' },
  // New: two more options unlock right after the tutorial level so players
  // have real choices to experiment with early, not just three cards.
  icewall: { name: 'Ice Wall', desc: 'A frosty wall — any bug that claws at it gets chilled and slows down.', emoji: '🧊', cost: 75, cooldown: 9000, hp: 500, role: 'wall', contactSlow: 0.5, contactSlowTime: 2500, unlock: 2 },
  twinsunflower: { name: 'Twin Sunflower', desc: 'Produces double the sun of a regular sunflower. Great for a fast economy.', emoji: '🌼', cost: 90, cooldown: 7000, hp: 120, role: 'sun', sunAmount: 50, sunEvery: 6000, unlock: 2 },
  snowpea: { nameKey: 'plants_snowpea_name', emoji: '🥶', cost: 150, cooldown: 6000, hp: 100, role: 'shooter', dmg: 15, rate: 1400, shots: 1, slow: 0.5, slowTime: 2000, unlock: 3, descKey: 'plants_snowpea_desc' },
  repeater: { nameKey: 'plants_repeater_name', emoji: '🌿', cost: 200, cooldown: 6000, hp: 100, role: 'shooter', dmg: 20, rate: 1200, shots: 2, unlock: 4, descKey: 'plants_repeater_desc' },
  cherrybomb: { nameKey: 'plants_cherrybomb_name', emoji: '🍒', cost: 150, cooldown: 20000, hp: 1, role: 'bomb', dmg: 900, radius: 1.6, fuse: 900, unlock: 5, descKey: 'plants_cherrybomb_desc' },
  melonpult: { nameKey: 'plants_melonpult_name', emoji: '🍉', cost: 300, cooldown: 8000, hp: 100, role: 'shooter', dmg: 70, rate: 2000, shots: 1, splash: 1.1, unlock: 6, descKey: 'plants_melonpult_desc' },
  gatlingpea: { name: 'Gatling Pea', desc: 'Unloads four peas per volley — the heaviest sustained damage in the garden.', emoji: '🎯', cost: 350, cooldown: 9000, hp: 100, role: 'shooter', dmg: 20, rate: 1300, shots: 4, unlock: 7 }
};

const PLANT_ORDER = ['sunflower', 'peashooter', 'wallnut', 'icewall', 'twinsunflower', 'snowpea', 'repeater', 'cherrybomb', 'melonpult', 'gatlingpea'];

// The caterpillar now uses the classic 🐛 "bug" emoji (that's literally its
// Unicode name) so it reads as THE bug of the garden — the gentle, slow
// tutorial enemy for round one. Aphid gets its own look so the two are no
// longer visually identical.
const BUGS: Record<string, BugDef> = {
  aphid: { nameKey: 'bugs_aphid_name', emoji: '🐜', hp: 45, speed: 10, dmg: 1, atkRate: 1100, points: 10, color: '#a8e6a1', factKey: 'bugs_aphid_fact' },
  beetle: { nameKey: 'bugs_beetle_name', emoji: '🐞', hp: 105, speed: 8, dmg: 2, atkRate: 1100, points: 18, color: '#ff8a80', factKey: 'bugs_beetle_fact' },
  hopper: { nameKey: 'bugs_hopper_name', emoji: '🦗', hp: 55, speed: 17, dmg: 1, atkRate: 1000, points: 16, color: '#c5e1a5', factKey: 'bugs_hopper_fact' },
  snail: { nameKey: 'bugs_snail_name', emoji: '🐌', hp: 180, speed: 5, dmg: 2, atkRate: 1100, points: 24, color: '#d7ccc8', factKey: 'bugs_snail_fact' },
  wasp: { nameKey: 'bugs_wasp_name', emoji: '🐝', hp: 45, speed: 19, dmg: 1, atkRate: 1000, points: 20, flying: true, color: '#fff59d', factKey: 'bugs_wasp_fact' },
  caterpillar: { nameKey: 'bugs_caterpillar_name', emoji: '🐛', hp: 20, speed: 6, dmg: 1, atkRate: 1100, points: 8, color: '#dce775', factKey: 'bugs_caterpillar_fact' },
  slugboss: { nameKey: 'bugs_slugboss_name', emoji: '🐢', hp: 950, speed: 4, dmg: 3, atkRate: 900, points: 200, boss: true, color: '#b2dfdb', factKey: 'bugs_slugboss_fact' }
};

const ROWS = 5;
const COLS = 7;
const SAVE_KEY = 'pvb_garden_defense_save_v1';

interface PlantEntity {
  key: string;
  row: number;
  col: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  timer: number;
  fuse: number;
}

interface BugEntity {
  key: string;
  row: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  slowUntil: number;
  atkTimer: number;
  speedBase: number;
  dying: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  dmg: number;
  row: number;
  slow?: boolean;
  slowTimeMs?: number;
  splash?: number;
}

interface SunEntity {
  x: number;
  y: number;
  vy: number;
  value: number;
  phase: number;
  targetY: number;
  life?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  color: string;
  size: number;
}

interface Floater {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}


export const PlantsVsBugs = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const t = useTranslations('plansVsBugs');

  // Persistence State
  const [save, setSave] = useState<{ maxLevel: number; stars: Record<number, number>; muted: boolean }>(() => {
    if (typeof window === 'undefined') return { maxLevel: 1, stars: {}, muted: false };
    try {
      const s = localStorage.getItem(SAVE_KEY);
      return s ? JSON.parse(s) : { maxLevel: 1, stars: {}, muted: false };
    } catch {
      return { maxLevel: 1, stars: {}, muted: false };
    }
  });

  // UI / Modals State
  const [modal, setModal] = useState<'start' | 'levels' | 'tip' | 'win' | 'lose' | 'rewarded' | null>('start');
  const [paused, setPaused] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(save.muted);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // Active Game State Variables
  const [level, setLevel] = useState<number>(1);
  const [sun, setSun] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [bossBanner, setBossBanner] = useState<boolean>(false);
  // Hover-only instructions: which tray card is currently hovered, so we can
  // show its "how it's used" copy without ever popping a blocking modal.
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Rewarded Modal parameters
  const [rewardConfig, setRewardConfig] = useState<{ title: string; desc: string; onReward: () => void } | null>(null);
  const [rewardProgress, setRewardProgress] = useState<number>(0);

  // Refs for Game Engine Loop
  const engineRef = useRef({
    screen: 'start' as 'start' | 'playing' | 'idle',
    level: 1,
    sun: 0,
    lives: 3,
    maxLives: 3,
    selectedCard: null as string | null,
    cooldowns: {} as Record<string, number>,
    plants: [] as PlantEntity[],
    bugs: [] as BugEntity[],
    projectiles: [] as Projectile[],
    suns: [] as SunEntity[],
    particles: [] as Particle[],
    waveIndex: 0,
    waveTimer: 0,
    spawnedInWave: 0,
    levelFinishedSpawning: false,
    combo: 0,
    comboTimer: 0,
    shakeT: 0,
    shakeMag: 0,
    doubleSunUntil: 0,
    freezeUntil: 0,
    win: false,
    carryBonus: 0,
    pendingBonus: 0,
    lastInterstitial: 0,
    ambientAcc: 0,
    trayTick: 0
  });

  const actxRef = useRef<AudioContext | null>(null);

  // New plants ship with plain-text name/desc (no translation entries yet);
  // the original roster keeps using nameKey/descKey. These helpers paper
  // over the difference everywhere copy is shown.
  const plantLabel = useCallback((def: PlantDef) => def.name ?? (def.nameKey ? t(def.nameKey) : ''), [t]);
  const plantDesc = useCallback((def: PlantDef) => def.desc ?? (def.descKey ? t(def.descKey) : ''), [t]);

  // Audio helper
  const ensureAudio = useCallback(() => {
    if (!actxRef.current && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) actxRef.current = new AudioCtx();
    }
  }, []);

  const tone = useCallback((freq: number, dur: number, type: OscillatorType, vol: number) => {
    if (muted || !actxRef.current) return;
    try {
      const t = actxRef.current.currentTime;
      const osc = actxRef.current.createOscillator();
      const gain = actxRef.current.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(actxRef.current.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {}
  }, [muted]);

  const sfxPlant = useCallback(() => tone(220, 0.12, 'triangle', 0.15), [tone]);
  const sfxShoot = useCallback(() => tone(600, 0.06, 'square', 0.06), [tone]);
  const sfxHit = useCallback(() => tone(150, 0.08, 'sawtooth', 0.08), [tone]);
  const sfxSun = useCallback(() => tone(880, 0.15, 'sine', 0.15), [tone]);
  const sfxError = useCallback(() => tone(120, 0.15, 'square', 0.12), [tone]);
  const sfxExplode = useCallback(() => tone(80, 0.3, 'sawtooth', 0.25), [tone]);
  const sfxWin = useCallback(() => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.2), i * 120));
  }, [tone]);
  const sfxLose = useCallback(() => {
    [400, 320, 240].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.18), i * 150));
  }, [tone]);

  const saveToStorage = useCallback((updated: typeof save) => {
    setSave(updated);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(updated)); } catch {}
  }, []);

  const spawnFloater = useCallback((x: number, y: number, text: string, color: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setFloaters(prev => [...prev, { id, x, y, text, color }]);
    setTimeout(() => {
      setFloaters(prev => prev.filter(f => f.id !== id));
    }, 950);
  }, []);

  const getLevels = useCallback(() => {
    const levels = [];
    for (let n = 1; n <= 10; n++) {
      // Round 1 is an all-caterpillar tutorial: THE bug, slow and gentle.
      // Tougher species phase in one at a time from level 2 onward.
      const pool = ['caterpillar'];
      if (n >= 2) pool.push('aphid');
      if (n >= 3) pool.push('beetle');
      if (n >= 4) pool.push('hopper');
      if (n >= 5) pool.push('snail');
      if (n >= 6) pool.push('wasp');

      const isFirstLevel = n === 1;
      const waveCount = isFirstLevel ? 2 : 3 + Math.floor(n / 2);
      const baseInterval = isFirstLevel ? 2800 : Math.max(2400 - n * 70, 1000);
      // Fewer, slower bugs on round 1 so brand-new players get a real,
      // relaxed introduction instead of getting swarmed immediately.
      const speedMult = isFirstLevel ? 0.6 : 1;

      const waves = [];
      for (let w = 0; w < waveCount; w++) {
        const bugCount = isFirstLevel ? 2 + w : 3 + Math.floor(n * 0.7) + w;
        const isFinal = w === waveCount - 1;
        const boss = isFinal && (n === 5 || n === 10);
        waves.push({ bugCount, interval: baseInterval, pool: pool.slice(), boss });
      }
      levels.push({
        num: n,
        // Much more generous starting sun so players can experiment with
        // several plants right away instead of waiting one out.
        startSun: 320 + (n - 1) * 25,
        speedMult,
        waves,
        unlocksPlants: PLANT_ORDER.filter(p => PLANTS[p].unlock === n),
        title: `${t('game_modalTip_levelTitle')} ${n}`,
        fact: t(BUGS[pool[pool.length - 1]].factKey)
      });
    }
    return levels;
  }, [t]);

  // Main Canvas Loop Engine
  useEffect(() => {
    let animationFrameId: number;
    let lastT = performance.now();

    const loop = (tTime: number) => {
      const dt = Math.min(40, tTime - lastT);
      lastT = tTime;

      const engine = engineRef.current;
      const canvas = canvasRef.current;

      if (engine.screen === 'playing' && !paused && canvas) {
        const ctx = canvas.getContext('2d');
        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.width / DPR;
        const h = canvas.height / DPR;
        const cellW = w / COLS;
        const cellH = h / ROWS;

        // Ambient sun trickle
        engine.ambientAcc += dt / 1000;
        if (engine.ambientAcc > 10) {
          engine.ambientAcc = 0;
          const col = Math.floor(Math.random() * COLS);
          const row = Math.floor(Math.random() * ROWS);
          engine.suns.push({ x: col * cellW + cellW / 2, y: -20, vy: 40, value: 25, phase: Math.random() * 10, targetY: row * cellH + cellH / 2 });
        }

        // Combo & Shake updates
        if (engine.comboTimer > 0) {
          engine.comboTimer -= dt;
          if (engine.comboTimer <= 0) engine.combo = 0;
        }
        if (engine.shakeT > 0) engine.shakeT -= dt;

        // Spawning Logic
        const currentLevels = getLevels();
        const lv = currentLevels[engine.level - 1];

        if (!engine.levelFinishedSpawning) {
          const wave = lv.waves[engine.waveIndex];
          engine.waveTimer -= dt;
          if (engine.waveTimer <= 0) {
            if (wave.boss && engine.spawnedInWave === 0) {
              const def = BUGS.slugboss;
              const row = Math.floor(ROWS / 2);
              engine.bugs.push({ key: 'slugboss', row, x: COLS * cellW + 40, y: row * cellH + cellH / 2, hp: def.hp, maxHp: def.hp, speedBase: def.speed * (lv.speedMult || 1), slowUntil: 0, atkTimer: 0, dying: 0 });
              setBossBanner(true);
              setTimeout(() => setBossBanner(false), 2500);
              sfxExplode();
              engine.spawnedInWave = wave.bugCount;
            } else if (engine.spawnedInWave < wave.bugCount) {
              const key = wave.pool[Math.floor(Math.random() * wave.pool.length)];
              const def = BUGS[key];
              const row = Math.floor(Math.random() * ROWS);
              engine.bugs.push({ key, row, x: COLS * cellW + 30, y: row * cellH + cellH / 2, hp: def.hp, maxHp: def.hp, speedBase: def.speed * (lv.speedMult || 1), slowUntil: 0, atkTimer: 0, dying: 0 });
              engine.spawnedInWave++;
            }
            engine.waveTimer = wave.interval;
          }
          if (engine.spawnedInWave >= wave.bugCount) {
            engine.waveIndex++;
            engine.spawnedInWave = 0;
            // Shorter gap before the next wave rolls in — less standing
            // around waiting, more time actually playing.
            engine.waveTimer = 400;
            if (engine.waveIndex >= lv.waves.length) engine.levelFinishedSpawning = true;
          }
        }

        // Plants tick
        engine.plants.forEach(p => {
          const def = PLANTS[p.key];
          p.timer += dt;
          if (def.role === 'sun') {
            if (p.timer >= (def.sunEvery || 6000)) {
              p.timer = 0;
              engine.suns.push({ x: p.x + (Math.random() * 20 - 10), y: p.y - 10, vy: 22, value: def.sunAmount || 25, phase: Math.random() * Math.PI * 2, targetY: p.y + 18 });
            }
          } else if (def.role === 'shooter') {
            const bugAhead = engine.bugs.find(b => b.row === p.row && b.x > p.x && !b.dying);
            if (bugAhead && p.timer >= (def.rate || 1200)) {
              p.timer = 0;
              sfxShoot();
              for (let s = 0; s < (def.shots || 1); s++) {
                setTimeout(() => {
                  if (engine.screen === 'playing') {
                    engine.projectiles.push({ x: p.x + cellW * 0.3, y: p.y, vx: 420, dmg: def.dmg || 20, row: p.row, slow: !!def.slow, slowTimeMs: def.slowTime || 0, splash: def.splash || 0 });
                  }
                }, s * 110);
              }
            }
          } else if (def.role === 'bomb') {
            p.fuse -= dt;
            if (p.fuse <= 0) {
              sfxExplode();
              engine.shakeMag = 16; engine.shakeT = 400;
              engine.bugs.forEach(b => {
                if (b.dying) return;
                const dx = (b.x - p.x) / cellW; const dy = b.row - p.row;
                if (Math.sqrt(dx * dx + dy * dy) <= (def.radius || 1.5)) {
                  b.hp -= def.dmg || 900;
                  if (b.hp <= 0) b.dying = 260;
                }
              });
              engine.plants = engine.plants.filter(pp => pp !== p);
            }
          }
        });

        // Projectiles tick
        for (let i = engine.projectiles.length - 1; i >= 0; i--) {
          const pr = engine.projectiles[i];
          pr.x += pr.vx * (dt / 1000);
          let hit = false;
          for (const b of engine.bugs) {
            if (b.dying || b.row !== pr.row) continue;
            if (Math.abs(b.x - pr.x) < cellW * 0.35) {
              b.hp -= pr.dmg;
              if (pr.slow) b.slowUntil = tTime + (pr.slowTimeMs || 2000);
              if (b.hp <= 0 && !b.dying) {
                b.dying = 260;
                sfxHit();
              }
              hit = true;
              break;
            }
          }
          if (hit || pr.x > COLS * cellW + 40) engine.projectiles.splice(i, 1);
        }

        // Bugs tick
        const frozen = tTime < engine.freezeUntil;
        for (let i = engine.bugs.length - 1; i >= 0; i--) {
          const b = engine.bugs[i];
          if (b.dying) {
            b.dying -= dt;
            if (b.dying <= 0) engine.bugs.splice(i, 1);
            continue;
          }
          if (frozen) continue;
          const def = BUGS[b.key];
          const speed = b.speedBase * (tTime < b.slowUntil ? 0.5 : 1);
          let blocker: PlantEntity | undefined;
          if (!def.flying) blocker = engine.plants.find(p => p.row === b.row && Math.abs(p.x - b.x) < cellW * 0.42);

          if (blocker) {
            b.atkTimer -= dt;
            if (b.atkTimer <= 0) {
              b.atkTimer = def.atkRate;
              blocker.hp -= def.dmg * 4;
              const blockerDef = PLANTS[blocker.key];
              if (blockerDef.contactSlow) {
                b.slowUntil = tTime + (blockerDef.contactSlowTime || 2000);
              }
              if (blocker.hp <= 0) engine.plants = engine.plants.filter(p => p !== blocker);
            }
          } else {
            b.x -= speed * (dt / 1000);
          }

          if (b.x < -20) {
            engine.bugs.splice(i, 1);
            engine.lives--;
            setLives(engine.lives);
            sfxLose();
            if (engine.lives <= 0) {
              engine.screen = 'idle';
              sfxLose();
              setModal('lose');
            }
          }
        }

        // Falling Sun Physics
        for (let i = engine.suns.length - 1; i >= 0; i--) {
          const s = engine.suns[i];
          if (s.y < s.targetY) s.y += s.vy * (dt / 1000);
          s.phase += (dt / 1000) * 4;
          s.life = (s.life || 0) + dt / 1000;
          if (s.life > 8) engine.suns.splice(i, 1);
        }

        // Win check
        if (engine.levelFinishedSpawning && engine.bugs.length === 0 && !engine.win) {
          engine.win = true;
          engine.screen = 'idle';
          const stars = engine.lives === 3 ? 3 : engine.lives === 2 ? 2 : 1;
          const updatedSave = {
            ...save,
            maxLevel: Math.max(save.maxLevel, Math.min(10, engine.level + 1)),
            stars: { ...save.stars, [engine.level]: Math.max(save.stars[engine.level] || 0, stars) }
          };
          saveToStorage(updatedSave);
          sfxWin();
          engine.pendingBonus = 30 + engine.level * 5;
          setModal('win');
        }

        // Sync React UI Sun
        setSun(Math.floor(engine.sun));

        // RENDER CANVAS
        if (ctx) {
          ctx.save();
          ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
          ctx.clearRect(0, 0, w, h);

          let shakeX = 0, shakeY = 0;
          if (engine.shakeT > 0) {
            shakeX = (Math.random() * 2 - 1) * engine.shakeMag * (engine.shakeT / 400);
            shakeY = (Math.random() * 2 - 1) * engine.shakeMag * (engine.shakeT / 400);
          }
          ctx.translate(shakeX, shakeY);

          // Lawn Grid
          for (let r = 0; r < ROWS; r++) {
            ctx.fillStyle = r % 2 === 0 ? '#7bc850' : '#72c048';
            ctx.fillRect(0, r * cellH, w, cellH);
          }

          // Suns
          engine.suns.forEach(s => {
            ctx.save();
            ctx.translate(s.x, s.y + Math.sin(s.phase) * 3);
            ctx.font = '26px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('☀️', 0, 0);
            ctx.restore();
          });

          // Plants
          engine.plants.forEach(p => {
            const def = PLANTS[p.key];
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.font = `${cellH * 0.55}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(def.emoji, 0, 2);
            ctx.restore();
            if (def.role !== 'bomb') {
              const pct = Math.max(0, p.hp / p.maxHp);
              ctx.fillStyle = 'rgba(0,0,0,.25)';
              ctx.fillRect(p.x - 16, p.y + cellH * 0.28, 32, 4);
              ctx.fillStyle = pct > 0.5 ? '#7bc850' : pct > 0.25 ? '#ffc93c' : '#e74c3c';
              ctx.fillRect(p.x - 16, p.y + cellH * 0.28, 32 * pct, 4);
            }
          });

          // Projectiles
          engine.projectiles.forEach(pr => {
            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.fillStyle = pr.slow ? '#a7e3ff' : '#3f8f1f';
            ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
            ctx.restore();
          });

          // Bugs
          engine.bugs.forEach(b => {
            const def = BUGS[b.key];
            ctx.save();
            ctx.translate(b.x, b.y + Math.sin(tTime / 150 + b.x) * 2);
            if (b.dying) ctx.globalAlpha = Math.max(0, b.dying / 260);

            // soft pastel glow so the bug reads as cute, not menacing
            const glowR = def.boss ? cellH * 0.7 : cellH * 0.34;
            ctx.beginPath();
            ctx.fillStyle = `${def.color}66`;
            ctx.arc(0, 0, glowR, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = `${def.boss ? cellH * 1.1 : cellH * 0.5}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.save(); ctx.scale(-1, 1); ctx.fillText(def.emoji, 0, 2); ctx.restore();

            // little blush cheeks for extra loveliness
            ctx.fillStyle = 'rgba(255,140,170,0.55)';
            const cheekDx = def.boss ? cellH * 0.34 : cellH * 0.17;
            const cheekY = def.boss ? cellH * 0.12 : cellH * 0.07;
            const cheekRx = def.boss ? cellH * 0.09 : cellH * 0.05;
            const cheekRy = cheekRx * 0.7;
            ctx.beginPath(); ctx.ellipse(-cheekDx, cheekY, cheekRx, cheekRy, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cheekDx, cheekY, cheekRx, cheekRy, 0, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
            if (!b.dying) {
              const pct = Math.max(0, b.hp / b.maxHp);
              const barW = def.boss ? 60 : 28;
              ctx.fillStyle = 'rgba(0,0,0,.3)';
              ctx.fillRect(b.x - barW / 2, b.y - cellH * 0.38, barW, 4);
              ctx.fillStyle = '#e74c3c';
              ctx.fillRect(b.x - barW / 2, b.y - cellH * 0.38, barW * pct, 4);
            }
          });

          if (tTime < engine.freezeUntil) {
            ctx.fillStyle = 'rgba(150,220,255,0.18)';
            ctx.fillRect(0, 0, w, h);
          }

          ctx.restore();
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [paused, getLevels, save, saveToStorage, sfxExplode, sfxHit, sfxLose, sfxShoot, sfxWin]);

  // Resize Listener — reacts to window resizes AND to the stage container
  // changing size on its own (e.g. the desktop side-ad slots mounting,
  // orientation change, or the app shell being resized without a window
  // resize event).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const handleResize = () => {
      if (!canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * DPR);
      canvas.height = Math.round(rect.height * DPR);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleResize);
      ro.observe(canvas.parentElement);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
    };
  }, []);

  // Card Selection & Cooldown Calculation
  const cooldownPct = (key: string) => {
    const now = performance.now();
    const end = engineRef.current.cooldowns[key] || 0;
    const p = PLANTS[key];
    const remain = Math.max(0, end - now);
    return Math.min(100, (remain / p.cooldown) * 100);
  };

  const showRewardedAd = (title: string, desc: string, onReward: () => void) => {
    ensureAudio();
    setRewardConfig({ title, desc, onReward });
    setRewardProgress(0);
    setModal('rewarded');

    let elapsed = 0;
    const AD_DURATION = 1800; // shorter simulated ad — less waiting, more playing
    const interval = setInterval(() => {
      elapsed += 100;
      setRewardProgress(Math.min(100, (elapsed / AD_DURATION) * 100));
      if (elapsed >= AD_DURATION) {
        clearInterval(interval);
        setModal(null);
        onReward();
      }
    }, 100);
  };

  const resetLevelState = (levelNum: number) => {
    const lv = getLevels()[levelNum - 1];
    const engine = engineRef.current;
    engine.level = levelNum;
    engine.sun = lv.startSun + engine.carryBonus;
    engine.carryBonus = 0;
    engine.lives = 3; engine.maxLives = 3;
    engine.plants = []; engine.bugs = []; engine.projectiles = []; engine.suns = []; engine.particles = [];
    engine.waveIndex = 0; engine.waveTimer = 0; engine.spawnedInWave = 0;
    engine.levelFinishedSpawning = false; engine.combo = 0; engine.comboTimer = 0;
    engine.selectedCard = null; engine.cooldowns = {}; engine.doubleSunUntil = 0; engine.freezeUntil = 0; engine.win = false;

    setLevel(levelNum);
    setSun(engine.sun);
    setLives(3);
    setSelectedCard(null);
  };

  const startLevelFlow = (levelNum: number) => {
    engineRef.current.level = levelNum;
    setLevel(levelNum);
    setModal('tip');
  };

  const handleCanvasInteraction = (clientX: number, clientY: number) => {
    if (engineRef.current.screen !== 'playing' || paused) return;
    ensureAudio();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;

    const cellW = rect.width / COLS;
    const cellH = rect.height / ROWS;

    // Check collectible suns tap
    const suns = engineRef.current.suns;
    for (let i = suns.length - 1; i >= 0; i--) {
      const s = suns[i];
      const dx = cx - s.x; const dy = cy - s.y;
      if (dx * dx + dy * dy < 34 * 34) {
        const mult = performance.now() < engineRef.current.doubleSunUntil ? 2 : 1;
        engineRef.current.sun += s.value * mult;
        sfxSun();
        spawnFloater(s.x, s.y, `+${s.value * mult} ☀️`, '#e8a415');
        suns.splice(i, 1);
        setSun(Math.floor(engineRef.current.sun));
        return;
      }
    }

    const col = Math.floor(cx / cellW);
    const row = Math.floor(cy / cellH);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

    const selected = selectedCard;
    if (!selected) return;

    if (selected === 'shovel') {
      const existing = engineRef.current.plants.find(p => p.row === row && p.col === col);
      if (existing) {
        engineRef.current.plants = engineRef.current.plants.filter(p => p !== existing);
        sfxPlant();
      }
      return;
    }

    const pDef = PLANTS[selected];
    const now = performance.now();
    if (engineRef.current.cooldowns[selected] && engineRef.current.cooldowns[selected] > now) {
      sfxError(); return;
    }
    if (engineRef.current.sun < pDef.cost) {
      sfxError();
      spawnFloater(rect.width / 2, 20, t('game_hud_notEnoughSun'), '#ff6f91');
      return;
    }
    if (engineRef.current.plants.find(p => p.row === row && p.col === col)) {
      sfxError(); return;
    }

    engineRef.current.sun -= pDef.cost;
    engineRef.current.cooldowns[selected] = now + pDef.cooldown;
    const px = col * cellW + cellW / 2;
    const py = row * cellH + cellH / 2;
    engineRef.current.plants.push({
      key: selected, row, col, x: px, y: py, hp: pDef.hp, maxHp: pDef.hp, timer: 0, fuse: pDef.role === 'bomb' ? (pDef.fuse || 900) : 0
    });
    sfxPlant();
    setSun(Math.floor(engineRef.current.sun));
    setSelectedCard(null);
    engineRef.current.selectedCard = null;
  };

  const handleCanvasTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    handleCanvasInteraction(e.clientX, e.clientY);
  };

  const unlockedPlantsList = PLANT_ORDER.filter(k => PLANTS[k].unlock <= level);
  const currentLevelObj = getLevels()[level - 1] || getLevels()[0];

  // Hover-only "how it's used" info for the tray — never opens on click/tap,
  // just reflects whatever card the pointer is currently resting on.
  const hoveredInfo = (() => {
    if (hoveredKey === 'shovel') return { emoji: '🪓', name: t('game_tray_shovel'), desc: t('game_tray_shovel') };
    if (hoveredKey === 'freeze') return { emoji: '🧊', name: t('game_tray_freezeTitle'), desc: t('game_tray_freezeDesc') };
    if (hoveredKey === 'boost') return { emoji: '⏫', name: t('game_tray_boostTitle'), desc: t('game_tray_boostDesc') };
    const p = hoveredKey ? PLANTS[hoveredKey] : null;
    return p ? { emoji: p.emoji, name: plantLabel(p), desc: plantDesc(p) } : null;
  })();

  return (
    <div id="pvb-app">
      {/* Self-contained frame: fixed aspect ratio, its own stacking context,
          no fixed-to-viewport chrome — drops cleanly into any app layout,
          and every modal below is positioned/clipped relative to it rather
          than the whole browser viewport. */}
      <div className="pvb-stage-wrap">
          {/* Background Backdrop */}
          <div
            className="pvb-backdrop"
            style={{
              background:
                'radial-gradient(circle at 20% 15%, #fff7c9 0%, transparent 40%), linear-gradient(180deg,#8fd3f4 0%, #cdf2bf 55%, #7bc850 56%, #6fbb46 100%)',
            }}
          />

          <div
            className="pvb-stage"
            style={{
              background: 'linear-gradient(180deg,#8fd3f4 0%, #cdf2bf 38%, #7bc850 40%, #6fbb46 100%)',
            }}
          >
          {/* HUD Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'linear-gradient(180deg,#7a4b2a,#5a3a22)', borderBottom: '3px solid #6e4a29', zIndex: 5 }}>
            <div className="hud-pill" style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,.25)', borderRadius: 20, padding: '4px 10px', color: '#fff6e0', fontWeight: 800, fontSize: 14 }}>
              <span>☀️</span><span>{sun}</span>
            </div>
            <div className="hud-pill" style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,.25)', borderRadius: 20, padding: '4px 10px', fontSize: 14 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i}>{i < lives ? '❤️' : '🤍'}</span>
              ))}
            </div>
            <div className="hud-pill" style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,.25)', borderRadius: 20, padding: '4px 10px', color: '#fff6e0', fontWeight: 800, fontSize: 14 }}>
              <span>🌿</span><span>{level}/10</span>
            </div>
            <div style={{ flex: 1 }} />
            <button
              style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,.25)', border: 'none', color: '#fff6e0', fontSize: 16, cursor: 'pointer' }}
              onClick={() => {
                const nextMuted = !muted;
                setMuted(nextMuted);
                saveToStorage({ ...save, muted: nextMuted });
              }}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,.25)', border: 'none', color: '#fff6e0', fontSize: 16, cursor: 'pointer' }}
              onClick={() => setPaused(true)}
            >
              ⏸️
            </button>
          </div>

          {/* Hover-only instructions dock — shows "how it's used" for whatever
              card the pointer rests on; stays quiet and never blocks play. */}
          <div className="pvb-hint-dock">
            {hoveredInfo ? (
              <><span style={{ marginRight: 6 }}>{hoveredInfo.emoji}</span><b>{hoveredInfo.name}:</b> {hoveredInfo.desc}</>
            ) : (
              <span style={{ opacity: 0.65 }}>💡 Hover a card to see what it does</span>
            )}
          </div>

          {/* Plant Selection Tray */}
          <div style={{ background: 'linear-gradient(180deg,#8b5e34,#6e4a29)', borderBottom: '3px solid #4a3018', padding: 6 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {/* Shovel */}
              <button
                onClick={() => setSelectedCard(selectedCard === 'shovel' ? null : 'shovel')}
                onMouseEnter={() => setHoveredKey('shovel')}
                onMouseLeave={() => setHoveredKey(prev => (prev === 'shovel' ? null : prev))}
                style={{
                  position: 'relative', width: 54, height: 64, borderRadius: 10, border: '2px solid #3a7dc9',
                  background: 'linear-gradient(180deg,#dceeff,#b9dcf7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  boxShadow: selectedCard === 'shovel' ? '0 0 0 3px #fff' : 'none'
                }}
              >
                <div style={{ fontSize: 22 }}>🪓</div>
                <div style={{ fontSize: 10, fontWeight: 800, background: '#3a7dc9', color: '#fff', borderRadius: 8, padding: '0 5px' }}>{t('game_tray_shovel')}</div>
              </button>

              {/* Freeze Powerup */}
              <button
                onClick={() => showRewardedAd(t('game_tray_freezeTitle'), t('game_tray_freezeDesc'), () => {
                  engineRef.current.freezeUntil = performance.now() + 5000;
                })}
                onMouseEnter={() => setHoveredKey('freeze')}
                onMouseLeave={() => setHoveredKey(prev => (prev === 'freeze' ? null : prev))}
                style={{
                  position: 'relative', width: 54, height: 64, borderRadius: 10, border: '2px solid #e08a2b',
                  background: 'linear-gradient(180deg,#ffe3c2,#ffcf94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: 22 }}>🧊</div>
                <div style={{ fontSize: 10, fontWeight: 800, background: '#e08a2b', color: '#fff', borderRadius: 8, padding: '0 5px' }}>{t('game_tray_ad')}</div>
              </button>

              {/* Sun Boost Powerup */}
              <button
                onClick={() => showRewardedAd(t('game_tray_boostTitle'), t('game_tray_boostDesc'), () => {
                  engineRef.current.doubleSunUntil = performance.now() + 20000;
                })}
                onMouseEnter={() => setHoveredKey('boost')}
                onMouseLeave={() => setHoveredKey(prev => (prev === 'boost' ? null : prev))}
                style={{
                  position: 'relative', width: 54, height: 64, borderRadius: 10, border: '2px solid #e08a2b',
                  background: 'linear-gradient(180deg,#ffe3c2,#ffcf94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: 22 }}>⏫</div>
                <div style={{ fontSize: 10, fontWeight: 800, background: '#e08a2b', color: '#fff', borderRadius: 8, padding: '0 5px' }}>{t('game_tray_ad')}</div>
              </button>

              {/* Unlocked Plants */}
              {unlockedPlantsList.map(key => {
                const p = PLANTS[key];
                const ready = cooldownPct(key) === 0;
                const affordable = sun >= p.cost;
                const selected = selectedCard === key;

                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (!ready) { sfxError(); return; }
                      setSelectedCard(selected ? null : key);
                      engineRef.current.selectedCard = selected ? null : key;
                    }}
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() => setHoveredKey(prev => (prev === key ? null : prev))}
                    style={{
                      position: 'relative', width: 54, height: 64, borderRadius: 10, border: '2px solid #c98a3a',
                      background: 'linear-gradient(180deg,#fff6e0,#f3e3bd)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: ready ? 'pointer' : 'not-allowed', opacity: !affordable && ready ? 0.55 : 1,
                      boxShadow: selected ? '0 0 0 3px #fff' : 'none'
                    }}
                  >
                    <div style={{ fontSize: 22 }}>{p.emoji}</div>
                    <div style={{ fontSize: 10, fontWeight: 800, background: '#ffc93c', color: '#2c1c0e', borderRadius: 8, padding: '0 5px', marginTop: 2 }}>{p.cost}</div>
                    {!ready && (
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', borderRadius: '0 0 8px 8px', height: `${cooldownPct(key)}%` }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Interactive Canvas Wrap */}
          <div style={{ flex: '1 1 auto', position: 'relative', minHeight: 0 }}>
            <canvas ref={canvasRef} onPointerDown={handleCanvasTap} style={{ display: 'block', width: '100%', height: '100%' }} />

            {/* Boss Banner */}
            {bossBanner && (
              <div style={{
                position: 'absolute', top: '40%', left: 0, right: 0, textAlign: 'center', zIndex: 8,
                fontFamily: 'cursive', fontWeight: 800, fontSize: 26, color: '#fff', textShadow: '0 3px 6px rgba(0,0,0,.6)'
              }}>
                {t('game_bossBanner')}
              </div>
            )}

            {/* Floater Overlay */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {floaters.map(f => (
                <div key={f.id} style={{
                  position: 'absolute', left: f.x, top: f.y, color: f.color, fontSize: 18, fontWeight: 800,
                  transform: 'translate(-50%, -50%)', textShadow: '0 2px 3px rgba(0,0,0,.4)'
                }}>
                  {f.text}
                </div>
              ))}
            </div>

            {/* Pause Overlay */}
            {paused && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, background: 'rgba(0,0,0,.4)' }}>
                <div style={{ textAlign: 'center', color: '#fff' }}>
                  <div style={{ fontSize: 30, marginBottom: 12 }}>⏸️ {t('game_pauseOverlay_title')}</div>
                  <button
                    onClick={() => setPaused(false)}
                    style={{ background: '#4a9c3f', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, margin: 5, cursor: 'pointer' }}
                  >
                    {t('game_pauseOverlay_resume')}
                  </button>
                  <button
                    onClick={() => {
                      setPaused(false);
                      engineRef.current.screen = 'start';
                      setModal('start');
                    }}
                    style={{ background: '#8a8a8a', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, margin: 5, cursor: 'pointer' }}
                  >
                    {t('game_pauseOverlay_quit')}
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>

      {/* ================= MODALS =================
          Positioned absolute within this same frame (not fixed to the
          viewport), so they stay contained wherever this component is
          embedded rather than covering the whole host page. */}

      {/* Start Modal */}
      {modal === 'start' && (
        <div className="modal-bg" style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(10,15,8,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'linear-gradient(180deg,#fff8e6,#f2e0b8)', border: '4px solid #c98a3a', borderRadius: 18, padding: '22px 20px', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px', color: '#2c1c0e', fontSize: 24 }}>🌻 Plants vs Bugs</h2>
            <h3 style={{ marginTop: -6, color: '#7a4b2a' }}>Garden Defense</h3>
            <p style={{ color: '#4a3620', fontSize: 14.5, lineHeight: 1.5 }}>{t('game_modalStart_desc')}</p>
            <div style={{ background: '#eef7e2', border: '2px dashed #7bb85a', borderRadius: 12, padding: '10px 12px', fontSize: 13, color: '#2c4a1c', textAlign: 'left', margin: '10px 0' }}>
              💡 <b>{t('game_modalStart_tipTitle')}:</b> {t('game_modalStart_tipDesc')}
            </div>
            <button
              onClick={() => startLevelFlow(Math.min(10, save.maxLevel || 1))}
              style={{ background: '#4a9c3f', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, fontSize: 16, cursor: 'pointer', margin: 5 }}
            >
              ▶ {t('game_modalStart_btnPlay')}
            </button>
            <button
              onClick={() => setModal('levels')}
              style={{ background: '#e08a2b', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, fontSize: 16, cursor: 'pointer', margin: 5 }}
            >
              🗺️ {t('game_modalStart_btnLevels')}
            </button>
          </div>
        </div>
      )}

      {/* Level Select Modal */}
      {modal === 'levels' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(10,15,8,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'linear-gradient(180deg,#fff8e6,#f2e0b8)', border: '4px solid #c98a3a', borderRadius: 18, padding: '22px 20px', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px', color: '#2c1c0e', fontSize: 24 }}>{t('game_modalLevels_title')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, margin: '12px 0' }}>
              {Array.from({ length: 10 }).map((_, idx) => {
                const lvlNum = idx + 1;
                const locked = lvlNum > save.maxLevel;
                const stars = save.stars[lvlNum] || 0;
                return (
                  <button
                    key={lvlNum}
                    disabled={locked}
                    onClick={() => startLevelFlow(lvlNum)}
                    style={{
                      aspectRatio: '1', borderRadius: 10, border: '2px solid #c98a3a',
                      background: locked ? '#ccc' : '#fff6e0', color: locked ? '#888' : '#2c1c0e',
                      fontWeight: 800, fontSize: 16, cursor: locked ? 'not-allowed' : 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <span>{lvlNum}</span>
                    <span style={{ fontSize: 9 }}>{locked ? '🔒' : ('⭐'.repeat(stars) || '·')}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setModal('start')}
              style={{ background: '#8a8a8a', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, cursor: 'pointer' }}
            >
              {t('game_modalLevels_back')}
            </button>
          </div>
        </div>
      )}

      {/* Level Tip Modal */}
      {modal === 'tip' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(10,15,8,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'linear-gradient(180deg,#fff8e6,#f2e0b8)', border: '4px solid #c98a3a', borderRadius: 18, padding: '22px 20px', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px', color: '#2c1c0e', fontSize: 24 }}>{currentLevelObj.title}</h2>
            {currentLevelObj.unlocksPlants.length > 0 && (
              <p style={{ margin: '0 0 8px', color: '#7a4b2a', fontWeight: 700, fontSize: 14 }}>
                🔓 {currentLevelObj.unlocksPlants.map((k: string) => `${PLANTS[k].emoji} ${plantLabel(PLANTS[k])}`).join(' · ')}
              </p>
            )}
            <p style={{ color: '#4a3620', fontSize: 14.5 }}>
              {t('game_modalTip_desc')} {currentLevelObj.waves.length}.
            </p>
            <div style={{ background: '#eef7e2', border: '2px dashed #7bb85a', borderRadius: 12, padding: '10px 12px', fontSize: 13, color: '#2c4a1c', textAlign: 'left', margin: '10px 0' }}>
              💡 <b>{t('game_modalTip_factTitle')}:</b> {currentLevelObj.fact}
            </div>
            <button
              onClick={() => {
                setModal(null);
                resetLevelState(level);
                engineRef.current.screen = 'playing';
              }}
              style={{ background: '#4a9c3f', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
            >
              {t('game_modalTip_btnStart')}
            </button>
          </div>
        </div>
      )}

      {/* Win Modal */}
      {modal === 'win' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(10,15,8,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'linear-gradient(180deg,#fff8e6,#f2e0b8)', border: '4px solid #c98a3a', borderRadius: 18, padding: '22px 20px', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <h2>🎉 {t('game_modalWin_title')}</h2>
            <div style={{ fontSize: 34, letterSpacing: 6, margin: '8px 0' }}>
              {'⭐'.repeat(lives)}{'☆'.repeat(3 - lives)}
            </div>
            <p>{t('game_modalWin_desc')} {level}!</p>
            <div style={{ background: '#eef7e2', border: '2px dashed #7bb85a', borderRadius: 12, padding: '10px 12px', fontSize: 13, color: '#2c4a1c', margin: '10px 0' }}>
              +{engineRef.current.pendingBonus} ☀️ {t('game_modalWin_bonus')}
            </div>
            <button
              onClick={() => showRewardedAd(t('game_modalWin_doubleTitle'), t('game_modalWin_doubleDesc'), () => {
                engineRef.current.pendingBonus *= 2;
              })}
              style={{ background: '#e08a2b', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, margin: 5, cursor: 'pointer' }}
            >
              📺 {t('game_modalWin_btnDouble')}
            </button>
            <br />
            {level < 10 && (
              <button
                onClick={() => {
                  setModal(null);
                  engineRef.current.carryBonus = engineRef.current.pendingBonus;
                  startLevelFlow(level + 1);
                }}
                style={{ background: '#4a9c3f', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, margin: 5, cursor: 'pointer' }}
              >
                {t('game_modalWin_btnNext')} ▶
              </button>
            )}
            <button
              onClick={() => {
                setModal('start');
                engineRef.current.screen = 'start';
              }}
              style={{ background: '#8a8a8a', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, margin: 5, cursor: 'pointer' }}
            >
              {t('game_modalWin_btnMenu')}
            </button>
          </div>
        </div>
      )}

      {/* Lose Modal */}
      {modal === 'lose' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(10,15,8,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'linear-gradient(180deg,#fff8e6,#f2e0b8)', border: '4px solid #c98a3a', borderRadius: 18, padding: '22px 20px', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <h2>😵 {t('game_modalLose_title')}</h2>
            <p>{t('game_modalLose_desc')}</p>
            <button
              onClick={() => showRewardedAd(t('game_modalLose_reviveTitle'), t('game_modalLose_reviveDesc'), () => {
                setModal(null);
                engineRef.current.lives = 1;
                setLives(1);
                engineRef.current.screen = 'playing';
              })}
              style={{ background: '#e08a2b', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, margin: 5, cursor: 'pointer' }}
            >
              📺 {t('game_modalLose_btnRevive')}
            </button>
            <br />
            <button
              onClick={() => {
                setModal(null);
                resetLevelState(level);
                engineRef.current.screen = 'playing';
              }}
              style={{ background: '#4a9c3f', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, margin: 5, cursor: 'pointer' }}
            >
              🔁 {t('game_modalLose_btnRetry')}
            </button>
            <button
              onClick={() => {
                setModal('start');
                engineRef.current.screen = 'start';
              }}
              style={{ background: '#8a8a8a', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, margin: 5, cursor: 'pointer' }}
            >
              {t('game_modalLose_btnMenu')}
            </button>
          </div>
        </div>
      )}

      {/* Rewarded Ad Placeholder Modal */}
      {modal === 'rewarded' && rewardConfig && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(10,15,8,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'linear-gradient(180deg,#fff8e6,#f2e0b8)', border: '4px solid #c98a3a', borderRadius: 18, padding: '22px 20px', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <h2>{rewardConfig.title}</h2>
            <p>{rewardConfig.desc}</p>
            <div style={{ background: '#ddd', borderRadius: 8, height: 14, overflow: 'hidden', margin: '14px 0' }}>
              <div style={{ height: '100%', width: `${rewardProgress}%`, background: 'linear-gradient(90deg,#e08a2b,#ffc93c)', transition: 'width .1s linear' }} />
            </div>
            <button
              onClick={() => setModal(null)}
              style={{ background: '#8a8a8a', color: '#fff', border: 'none', borderRadius: 26, padding: '12px 22px', fontWeight: 700, cursor: 'pointer' }}
            >
              {t('game_rewarded_cancel')}
            </button>
          </div>
        </div>
      )}
      </div>

      <style jsx>{`
        #pvb-app :global(*) {
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }

        /* Self-contained widget: centers itself wherever it's dropped, but
           never assumes it owns the whole page (no min-height:100vh, no
           fixed-position children) — safe to embed inline in another app. */
        #pvb-app {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .pvb-stage-wrap {
          position: relative;
          width: min(430px, 100%);
          aspect-ratio: 9 / 16;
          max-height: 90vh;
          margin: 0 auto;
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(255, 214, 130, 0.18), 0 20px 60px rgba(0, 0, 0, 0.45);
          background: #1c2b17;
          touch-action: none;
        }

        .pvb-backdrop {
          position: absolute;
          inset: -20%;
          z-index: 0;
          filter: blur(18px) saturate(1.15) brightness(0.85);
          transform: scale(1.15);
        }

        .pvb-stage {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .pvb-hint-dock {
          flex-shrink: 0;
          min-height: 30px;
          display: flex;
          align-items: center;
          padding: 5px 10px;
          font-size: 11.5px;
          line-height: 1.3;
          color: #fff6e0;
          background: rgba(0, 0, 0, 0.28);
          border-bottom: 1px solid rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

export default PlantsVsBugs;