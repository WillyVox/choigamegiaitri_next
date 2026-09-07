'use client';

/**
 * ============================================================================
 *  BUBBLE BLAST! — React + TypeScript bubble-shooter game component
 * ============================================================================
 *
 *  A self-contained, dependency-free (besides React) casual puzzle game:
 *  aim, shoot, and pop matching-colour bubble clusters across endless,
 *  progressively-harder levels. Designed to be dropped into any React app
 *  (Next.js, Vite, CRA, Remix…) as a single component.
 *
 *  WHAT'S INSIDE
 *  --------------------------------------------------------------------------
 *  1. Game engine   — canvas rendering, hex-grid bubble physics, flood-fill
 *                      matching, particles/confetti, procedural level design.
 *  2. Game UI       — HUD, menu, level-up, game-over screens, responsive
 *                      layout that looks good on phones AND desktop.
 *  3. Monetization  — ready-to-wire ad placeholders:
 *       - a skippable "interstitial" video-ad slot shown right in the game
 *         frame after a level ends or on game over (10s min. watch time),
 *       - a banner ad slot on the menu / game-over screens.
 *     Search for "AD INTEGRATION" comments to plug in AdSense/AdMob/IMA/etc.
 *  4. SEO           — semantic landmarks, a real <h1>, descriptive alt/aria
 *                      text, and a ready-made JSON-LD snippet
 *                      (`bubbleBlastJsonLd`) to drop in your page's <head>.
 *
 *  USAGE
 *  --------------------------------------------------------------------------
 *    import BubbleShootGame from './BubbleShootGame';
 *    export default function Page() {
 *      return <BubbleShootGame />;
 *    }
 *
 *  For Next.js App Router SEO, in the page/layout that renders this
 *  component, export metadata using the fields suggested at the bottom of
 *  this file (see `bubbleBlastSeo`).
 * ============================================================================
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================================
 * TYPES
 * ========================================================================== */

type Difficulty = 'easy' | 'medium' | 'hard';
type Screen = 'menu' | 'playing' | 'levelup' | 'gameover';
/** What the skippable interstitial ad should do when it finishes. */
type AdIntent = 'toLevelUp' | 'toGameOver' | 'toNextLevel' | 'toMenu' | 'toRestart' | null;

interface BubbleCell {
  color: string;
  r: number;
  c: number;
  alive: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  rot: number;
  rotV: number;
  shape: 'rect' | 'circle';
}

interface Star {
  x: number;
  y: number;
  r: number;
  sp: number;
  a: number;
}

interface AnimBubble {
  x: number;
  y: number;
  color: string;
  vx: number;
  vy: number;
}

interface Shooter {
  color: string;
}

/** Authoritative, mutable game state. Lives in a ref — NOT React state —
 *  because it changes every animation frame and must never trigger re-renders. */
interface GameCore {
  running: boolean; // true only while the "playing" screen is active
  diff: Difficulty;
  level: number;
  score: number;
  moves: number;
  maxMoves: number;
  combo: number;
  grid: (BubbleCell | undefined)[][];
  rows: number;
  cols: number;
  shooter: Shooter | null;
  nextColor: string | null;
  particles: Particle[];
  confetti: ConfettiPiece[];
  stars: Star[];
  bgHue: number;
  bgT: number;
  animBubble: AnimBubble | null;
  aimAngle: number;
  soundOn: boolean;
  shooting: boolean;
}

/** Everything the render/animation loop needs, held in one ref so plain
 *  functions (not hooks) can read/mutate it without stale closures. */
interface Engine {
  W: number;
  H: number;
  BUBBLE_R: number;
  GRID_COLS: number;
  bgCtx: CanvasRenderingContext2D | null;
  ctx: CanvasRenderingContext2D | null;
  confCtx: CanvasRenderingContext2D | null;
  audioCtx: AudioContext | null;
  rafId: number | null;
  G: GameCore;
}

/** Callbacks the engine uses to notify React of user-facing events.
 *  Populated once and kept in a ref so the engine functions (plain,
 *  module-level) always call the latest versions. */
interface EngineHandlers {
  onHud: (level: number, score: number, moves: number, combo: number, progressPct: number) => void;
  onNextColor: (color: string) => void;
  onToast: (msg: string, color: string) => void;
  onLevelCleared: (level: number, score: number) => void; // grid emptied -> show level-up screen
  onGameOver: (score: number, level: number) => void;
}

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const ALL_COLORS = [
  '#ff4fa3', '#ff7043', '#ffd600', '#69f0ae', '#40c4ff',
  '#d500f9', '#ff6d00', '#00e5ff', '#76ff03', '#e040fb',
  '#ff1744', '#00bfa5', '#ffab40', '#651fff', '#00b0ff',
];

const BUBBLE_COLORS_BY_DIFF: Record<Difficulty, number> = { easy: 4, medium: 6, hard: 8 };
const CONF_COLORS = ['#fde68a', '#f9a8d4', '#a5f3fc', '#86efac', '#c084fc', '#fb923c', '#67e8f9', '#fca5a5'];
const LEVEL_HUES = [260, 200, 30, 160, 310, 190, 280, 350, 90, 15];
const LEVELUP_MESSAGES = ['Tuyệt vời! 🌟', 'Tiếp tục nào! 🔥', 'Bạn đang bùng nổ! 🚀', 'Không thể tin được! 💥', 'Không thể cản phá! 🏆', 'Huyền thoại! 👑', 'THẦN THÁNH! 🌈'];
const AD_MIN_SECONDS = 10; // required watch time before "Skip" becomes available

/* ============================================================================
 * PURE HELPERS (level design / procedural difficulty curve)
 * ========================================================================== */

function levelHue(lvl: number): number {
  return LEVEL_HUES[(lvl - 1) % LEVEL_HUES.length];
}
function numColorsForLevel(diff: Difficulty, lvl: number): number {
  return Math.min(BUBBLE_COLORS_BY_DIFF[diff] + Math.floor((lvl - 1) / 3), ALL_COLORS.length);
}
function startMovesForLevel(diff: Difficulty, lvl: number): number {
  const base = { easy: 22, medium: 18, hard: 14 }[diff];
  const floor = { easy: 12, medium: 9, hard: 6 }[diff];
  return Math.max(base - Math.floor((lvl - 1) / 2), floor);
}
function numRowsForLevel(lvl: number): number {
  return Math.min(4 + Math.floor((lvl - 1) / 2), 10);
}
function minMatchForDiff(diff: Difficulty): number {
  return diff === 'easy' ? 2 : 3;
}
function paletteFor(engine: Engine): string[] {
  return ALL_COLORS.slice(0, numColorsForLevel(engine.G.diff, engine.G.level));
}
function randColor(engine: Engine): string {
  const p = paletteFor(engine);
  return p[Math.floor(Math.random() * p.length)];
}

/* ============================================================================
 * GEOMETRY
 * ========================================================================== */

function bx(engine: Engine, c: number, r: number): number {
  const { W, BUBBLE_R, GRID_COLS } = engine;
  const gridW = GRID_COLS * BUBBLE_R * 2;
  const startX = (W - gridW) / 2 + BUBBLE_R;
  const offset = r % 2 === 0 ? 0 : BUBBLE_R;
  return startX + c * BUBBLE_R * 2 + offset;
}
function by(engine: Engine, r: number): number {
  const topPad = 64;
  return topPad + r * (engine.BUBBLE_R * 1.72) + engine.BUBBLE_R;
}
function shooterY(engine: Engine): number {
  return engine.H - 90;
}
function clampAngle(angle: number): number {
  if (angle > -0.15) return -0.15;
  if (angle < -Math.PI + 0.15) return -Math.PI + 0.15;
  return angle;
}

/* ============================================================================
 * AUDIO (tiny synthesized SFX, no asset files needed)
 * ========================================================================== */

function getAudioCtx(engine: Engine): AudioContext | null {
  if (!engine.audioCtx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    engine.audioCtx = new Ctor();
  }
  return engine.audioCtx;
}
function playTone(engine: Engine, freq: number, type: OscillatorType = 'sine', dur = 0.08, vol = 0.18, delay = 0) {
  if (!engine.G.soundOn) return;
  try {
    const ac = getAudioCtx(engine);
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g);
    g.connect(ac.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime + delay);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, ac.currentTime + delay + dur * 0.3);
    g.gain.setValueAtTime(vol, ac.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + dur);
    o.start(ac.currentTime + delay);
    o.stop(ac.currentTime + delay + dur);
  } catch {
    /* Audio can fail before a user gesture unlocks it — safe to ignore. */
  }
}
function playPop(engine: Engine, n: number) {
  const freqs = [523, 659, 784, 1047];
  for (let i = 0; i < Math.min(n, 4); i++) playTone(engine, freqs[i % freqs.length], 'triangle', 0.12, 0.15, i * 0.04);
}
function playShoot(engine: Engine) {
  playTone(engine, 300, 'sine', 0.06, 0.1);
}
function playLevelUpSfx(engine: Engine) {
  [523, 659, 784, 1047, 1318].forEach((f, i) => playTone(engine, f, 'triangle', 0.15, 0.2, i * 0.1));
}
function playFail(engine: Engine) {
  playTone(engine, 220, 'sawtooth', 0.3, 0.15);
}

/* ============================================================================
 * GRID / MATCH LOGIC
 * ========================================================================== */

function neighbors(G: GameCore, r: number, c: number): [number, number][] {
  const even = r % 2 === 0;
  const dirs: [number, number][] = even
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  return dirs
    .map(([dr, dc]): [number, number] => [r + dr, c + dc])
    .filter(([nr, nc]) => nr >= 0 && nr < G.rows && nc >= 0 && nc < G.cols && G.grid[nr]?.[nc]?.alive);
}

function floodColor(G: GameCore, r: number, c: number, color: string, visited: Set<string> = new Set()): [number, number][] {
  const key = `${r},${c}`;
  if (visited.has(key)) return [];
  const b = G.grid[r]?.[c];
  if (!b || !b.alive || b.color !== color) return [];
  visited.add(key);
  let cluster: [number, number][] = [[r, c]];
  for (const [nr, nc] of neighbors(G, r, c)) cluster = cluster.concat(floodColor(G, nr, nc, color, visited));
  return cluster;
}

function findFloating(G: GameCore): [number, number][] {
  const connected = new Set<string>();
  const q: [number, number][] = [];
  for (let c = 0; c < G.cols; c++) {
    if (G.grid[0]?.[c]?.alive) {
      connected.add(`0,${c}`);
      q.push([0, c]);
    }
  }
  while (q.length) {
    const [r, c] = q.shift() as [number, number];
    for (const [nr, nc] of neighbors(G, r, c)) {
      const key = `${nr},${nc}`;
      if (!connected.has(key)) {
        connected.add(key);
        q.push([nr, nc]);
      }
    }
  }
  const floating: [number, number][] = [];
  for (let r = 0; r < G.rows; r++)
    for (let c = 0; c < G.cols; c++)
      if (G.grid[r]?.[c]?.alive && !connected.has(`${r},${c}`)) floating.push([r, c]);
  return floating;
}

function countAlive(G: GameCore): number {
  let n = 0;
  for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) if (G.grid[r]?.[c]?.alive) n++;
  return n;
}

function snapToGrid(engine: Engine, x: number, y: number): [number, number] | null {
  const { G, BUBBLE_R } = engine;
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let r = 0; r <= G.rows + 1; r++) {
    for (let c = 0; c < G.cols; c++) {
      const gx = bx(engine, c, r);
      const gy = by(engine, r);
      const d = Math.hypot(x - gx, y - gy);
      const occupied = !!G.grid[r]?.[c]?.alive;
      if (!occupied && d < bestD && d < BUBBLE_R * 2.8) {
        bestD = d;
        best = [r, c];
      }
    }
  }
  return best;
}

function isLost(engine: Engine): boolean {
  const { G } = engine;
  const dangerY = shooterY(engine) - engine.BUBBLE_R * 3;
  for (let r = 0; r < G.rows; r++)
    for (let c = 0; c < G.cols; c++)
      if (G.grid[r]?.[c]?.alive && by(engine, r) > dangerY) return true;
  return false;
}

/* ============================================================================
 * PARTICLES / CONFETTI
 * ========================================================================== */

function spawnParticles(G: GameCore, x: number, y: number, color: string, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 5 + 1.5;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, r: Math.random() * 5 + 2, color, life: 90 + Math.random() * 40 });
  }
}
function drawParticles(engine: Engine) {
  const { ctx, G } = engine;
  if (!ctx) return;
  G.particles = G.particles.filter((p) => p.life > 0);
  G.particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / 100);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  });
}
function spawnConfetti(G: GameCore, W: number, H: number) {
  G.confetti = [];
  for (let i = 0; i < 120; i++) {
    G.confetti.push({
      x: Math.random() * W,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 5,
      r: 5 + Math.random() * 7,
      color: CONF_COLORS[Math.floor(Math.random() * CONF_COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.2,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    });
  }
}
function drawConfetti(engine: Engine) {
  const { confCtx, G, W, H } = engine;
  if (!confCtx) return;
  if (!G.confetti.length) {
    confCtx.clearRect(0, 0, W, H);
    return;
  }
  confCtx.clearRect(0, 0, W, H);
  G.confetti = G.confetti.filter((c) => c.y < H + 20);
  G.confetti.forEach((c) => {
    c.x += c.vx;
    c.y += c.vy;
    c.rot += c.rotV;
    confCtx.save();
    confCtx.translate(c.x, c.y);
    confCtx.rotate(c.rot);
    confCtx.fillStyle = c.color;
    if (c.shape === 'rect') confCtx.fillRect(-c.r / 2, -c.r * 0.35, c.r, c.r * 0.7);
    else {
      confCtx.beginPath();
      confCtx.arc(0, 0, c.r * 0.5, 0, Math.PI * 2);
      confCtx.fill();
    }
    confCtx.restore();
  });
}

/* ============================================================================
 * DRAWING — background, bubbles, shooter
 * ========================================================================== */

function initStars(engine: Engine) {
  engine.G.stars = Array.from({ length: 70 }, () => ({
    x: Math.random() * engine.W,
    y: Math.random() * engine.H,
    r: Math.random() * 1.8 + 0.4,
    sp: Math.random() * 0.4 + 0.1,
    a: Math.random() * Math.PI * 2,
  }));
}

function drawBg(engine: Engine) {
  const { bgCtx, G, W, H } = engine;
  if (!bgCtx) return;
  G.bgT += 0.004;
  const hue = (G.bgHue + G.bgT * 8) % 360;
  const grad = bgCtx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.85);
  grad.addColorStop(0, `hsl(${hue},55%,12%)`);
  grad.addColorStop(1, `hsl(${(hue + 50) % 360},75%,5%)`);
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, W, H);
  G.stars.forEach((s) => {
    s.a += s.sp * 0.02;
    const alpha = 0.3 + 0.5 * Math.abs(Math.sin(s.a));
    bgCtx.beginPath();
    bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    bgCtx.fillStyle = `rgba(255,255,255,${alpha})`;
    bgCtx.fill();
  });
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, r: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.27, y - r * 0.29, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.2, y + r * 0.25, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.restore();
}

function drawGrid(engine: Engine) {
  const { ctx, G } = engine;
  if (!ctx) return;
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      const b = G.grid[r]?.[c];
      if (!b || !b.alive) continue;
      drawBubble(ctx, bx(engine, c, r), by(engine, r), b.color, engine.BUBBLE_R);
    }
  }
}

function drawShooter(engine: Engine) {
  const { ctx, G, W, BUBBLE_R } = engine;
  if (!ctx || !G.shooter) return;
  const sx = W / 2;
  const sy = shooterY(engine);
  ctx.save();
  ctx.setLineDash([5, 9]);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  let lx = sx;
  let ly = sy;
  let lvx = Math.cos(G.aimAngle);
  let lvy = Math.sin(G.aimAngle);
  for (let i = 0; i < 3; i++) {
    const dist = 300;
    let nx = lx + lvx * dist;
    let ny = ly + lvy * dist;
    if (nx < BUBBLE_R) {
      const t = (lx - BUBBLE_R) / -lvx;
      nx = BUBBLE_R;
      ny = ly + lvy * t;
      lvx *= -1;
    }
    if (nx > W - BUBBLE_R) {
      const t = (W - BUBBLE_R - lx) / lvx;
      nx = W - BUBBLE_R;
      ny = ly + lvy * t;
      lvx *= -1;
    }
    ctx.moveTo(lx, ly);
    ctx.lineTo(nx, ny);
    lx = nx;
    ly = ny;
    if (ny < 0) break;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, BUBBLE_R + 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  drawBubble(ctx, sx, sy, G.shooter.color, BUBBLE_R);
}

function drawAnim(engine: Engine) {
  const { ctx, G } = engine;
  if (!ctx || !G.animBubble) return;
  drawBubble(ctx, G.animBubble.x, G.animBubble.y, G.animBubble.color, engine.BUBBLE_R);
}

function drawAll(engine: Engine) {
  const { ctx, W, H } = engine;
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  drawGrid(engine);
  drawAnim(engine);
  drawShooter(engine);
  drawParticles(engine);
}

/* ============================================================================
 * GAME FLOW — init / place / shoot
 * ========================================================================== */

function resize(engine: Engine, bgCanvas: HTMLCanvasElement, mainCanvas: HTMLCanvasElement, confCanvas: HTMLCanvasElement, containerW: number, containerH: number) {
  engine.W = bgCanvas.width = mainCanvas.width = confCanvas.width = containerW;
  engine.H = bgCanvas.height = mainCanvas.height = confCanvas.height = containerH;
  engine.GRID_COLS = engine.W < 400 ? 7 : 9;
  engine.BUBBLE_R = Math.floor(Math.min(engine.W / (engine.GRID_COLS * 2 + 1), 28));
}

function initGrid(engine: Engine, handlers: EngineHandlers) {
  const { G } = engine;
  G.cols = engine.GRID_COLS;
  const rows = numRowsForLevel(G.level);
  G.rows = rows;
  G.grid = [];
  for (let r = 0; r < rows; r++) {
    G.grid[r] = [];
    for (let c = 0; c < G.cols; c++) {
      G.grid[r][c] = { color: randColor(engine), r, c, alive: true };
    }
  }
  G.moves = startMovesForLevel(G.diff, G.level);
  G.maxMoves = G.moves;
  G.combo = 0;
  G.animBubble = null;
  G.shooting = false;
  G.shooter = { color: randColor(engine) };
  G.nextColor = randColor(engine);
  handlers.onNextColor(G.nextColor);
  reportHud(engine, handlers);
}

function reportHud(engine: Engine, handlers: EngineHandlers) {
  const { G } = engine;
  const total = countAlive(G);
  const orig = numRowsForLevel(G.level) * G.cols;
  const progressPct = Math.max(0, 100 - (total / Math.max(orig, 1)) * 100);
  handlers.onHud(G.level, G.score, G.moves, G.combo, progressPct);
}

function placeBubble(engine: Engine, r: number, c: number, color: string, handlers: EngineHandlers) {
  const { G } = engine;
  if (!G.grid[r]) G.grid[r] = [];
  G.grid[r][c] = { color, r, c, alive: true };
  if (r >= G.rows) G.rows = r + 1;

  const cluster = floodColor(G, r, c, color);
  const need = minMatchForDiff(G.diff);

  if (cluster.length >= need) {
    G.combo++;
    const pts = cluster.length * 10 * G.combo;
    G.score += pts;
    cluster.forEach(([br, bc]) => {
      const cell = G.grid[br]?.[bc];
      if (!cell) return;
      spawnParticles(G, bx(engine, bc, br), by(engine, br), cell.color);
      cell.alive = false;
    });
    playPop(engine, cluster.length);
    if (G.combo >= 3) handlers.onToast(`🔥 COMBO x${G.combo}! +${pts}`, '#fde68a');
    else handlers.onToast(`+${pts} ✨`, '#a5f3fc');

    const floaters = findFloating(G);
    let bonus = 0;
    floaters.forEach(([fr, fc]) => {
      const cell = G.grid[fr]?.[fc];
      if (!cell) return;
      spawnParticles(G, bx(engine, fc, fr), by(engine, fr), cell.color, 8);
      cell.alive = false;
      bonus += 15 * G.combo;
    });
    G.score += bonus;
    if (floaters.length >= 3) {
      setTimeout(() => handlers.onToast(`💥 ${floaters.length} rơi! +${bonus}`, '#f9a8d4'), 400);
    }
  } else {
    G.combo = 0;
  }

  G.moves--;
  reportHud(engine, handlers);

  if (countAlive(G) === 0) {
    G.shooting = false;
    G.running = false;
    setTimeout(() => {
      playLevelUpSfx(engine);
      handlers.onLevelCleared(G.level, G.score);
    }, 450);
    return;
  }
  if (G.moves <= 0 || isLost(engine)) {
    G.shooting = false;
    G.running = false;
    setTimeout(() => {
      playFail(engine);
      handlers.onGameOver(G.score, G.level);
    }, 450);
    return;
  }
  G.shooting = false;
}

function shoot(engine: Engine, angle: number, handlers: EngineHandlers) {
  const { G, W } = engine;
  if (G.shooting || !G.running || !G.shooter) return;
  G.shooting = true;
  playShoot(engine);
  const sx = W / 2;
  const sy = shooterY(engine);
  const color = G.shooter.color;
  G.shooter.color = G.nextColor as string;
  G.nextColor = randColor(engine);
  handlers.onNextColor(G.nextColor);

  const speed = 14;
  G.animBubble = { x: sx, y: sy, color, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };

  const step = () => {
    if (!G.animBubble) {
      G.shooting = false;
      return;
    }
    G.animBubble.x += G.animBubble.vx;
    G.animBubble.y += G.animBubble.vy;

    if (G.animBubble.x < engine.BUBBLE_R) {
      G.animBubble.x = engine.BUBBLE_R;
      G.animBubble.vx *= -1;
    }
    if (G.animBubble.x > W - engine.BUBBLE_R) {
      G.animBubble.x = W - engine.BUBBLE_R;
      G.animBubble.vx *= -1;
    }
    if (G.animBubble.y < engine.BUBBLE_R + 60) {
      const pos = snapToGrid(engine, G.animBubble.x, G.animBubble.y);
      const c2 = G.animBubble.color;
      G.animBubble = null;
      if (pos) placeBubble(engine, pos[0], pos[1], c2, handlers);
      else G.shooting = false;
      return;
    }

    let hit = false;
    outer: for (let r = 0; r < G.rows && !hit; r++) {
      for (let c = 0; c < G.cols; c++) {
        const b = G.grid[r]?.[c];
        if (!b || !b.alive) continue;
        if (Math.hypot(G.animBubble.x - bx(engine, c, r), G.animBubble.y - by(engine, r)) < engine.BUBBLE_R * 1.85) {
          const pos = snapToGrid(engine, G.animBubble.x, G.animBubble.y);
          const c2 = G.animBubble.color;
          G.animBubble = null;
          hit = true;
          if (pos) placeBubble(engine, pos[0], pos[1], c2, handlers);
          else G.shooting = false;
          break outer;
        }
      }
    }
    if (!hit) engine.rafId = requestAnimationFrame(step);
  };
  engine.rafId = requestAnimationFrame(step);
}

/* ============================================================================
 * FACTORY — initial GameCore
 * ========================================================================== */

function createInitialCore(diff: Difficulty): GameCore {
  return {
    running: false,
    diff,
    level: 1,
    score: 0,
    moves: 20,
    maxMoves: 20,
    combo: 0,
    grid: [],
    rows: 0,
    cols: 9,
    shooter: null,
    nextColor: null,
    particles: [],
    confetti: [],
    stars: [],
    bgHue: 260,
    bgT: 0,
    animBubble: null,
    aimAngle: -Math.PI / 2,
    soundOn: true,
    shooting: false,
  };
}

/* ============================================================================
 * REACT COMPONENT
 * ========================================================================== */

export interface BubbleShootGameProps {
  /** Optional CSS class applied to the outer wrapper. */
  className?: string;
  /** Called whenever the score changes — hook up to analytics if desired. */
  onScoreChange?: (score: number) => void;
  /** Set to false to hide the ad placeholders entirely (e.g. for a paid/no-ads build). */
  adsEnabled?: boolean;
}

const BubbleShootGame: React.FC<BubbleShootGameProps> = ({ className, onScoreChange, adsEnabled = true }) => {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const aimOverlayRef = useRef<HTMLDivElement | null>(null);

  const engineRef = useRef<Engine>({
    W: 0,
    H: 0,
    BUBBLE_R: 24,
    GRID_COLS: 9,
    bgCtx: null,
    ctx: null,
    confCtx: null,
    audioCtx: null,
    rafId: null,
    G: createInitialCore('easy'),
  });

  // ---- React-facing UI state (does NOT drive the canvas loop directly) ----
  const [screen, setScreen] = useState<Screen>('menu');
  const [diffChoice, setDiffChoice] = useState<Difficulty>('easy');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(20);
  const [combo, setCombo] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [nextColor, setNextColor] = useState('#ffffff');
  const [soundOn, setSoundOn] = useState(true);
  const [toast, setToast] = useState<{ msg: string; color: string; visible: boolean }>({ msg: '', color: '#fff', visible: false });
  const [finalScore, setFinalScore] = useState(0);
  const [reachedLevel, setReachedLevel] = useState(1);

  // ---- Ad / monetization state ----
  const [adActive, setAdActive] = useState(false);
  const [adIntent, setAdIntent] = useState<AdIntent>(null);
  const [adSecondsLeft, setAdSecondsLeft] = useState(AD_MIN_SECONDS);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* -------------------------- Engine event handlers ------------------------ */
  const handlersRef = useRef<EngineHandlers>({
    onHud: () => {},
    onNextColor: () => {},
    onToast: () => {},
    onLevelCleared: () => {},
    onGameOver: () => {},
  });

  handlersRef.current.onHud = (lvl, sc, mv, cb, pct) => {
    setLevel(lvl);
    setScore(sc);
    setMoves(mv);
    setCombo(cb);
    setProgressPct(pct);
    onScoreChange?.(sc);
  };
  handlersRef.current.onNextColor = (c) => setNextColor(c);
  handlersRef.current.onToast = (msg, color) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, color, visible: true });
    toastTimerRef.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 1600);
  };
  handlersRef.current.onLevelCleared = (lvl, sc) => {
    const engine = engineRef.current;
    engine.G.level = lvl + 1;
    engine.G.bgHue = levelHue(engine.G.level);
    setLevel(engine.G.level);
    setScore(sc);
    setScreen('levelup');
    spawnConfetti(engine.G, engine.W, engine.H);
  };
  handlersRef.current.onGameOver = (sc, lvl) => {
    setFinalScore(sc);
    setReachedLevel(lvl);
    setScreen('gameover');
  };

  /* --------------------------- Canvas / loop setup -------------------------- */
  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const mainCanvas = mainCanvasRef.current;
    const confCanvas = confCanvasRef.current;
    const container = containerRef.current;
    if (!bgCanvas || !mainCanvas || !confCanvas || !container) return;

    const engine = engineRef.current;
    engine.bgCtx = bgCanvas.getContext('2d');
    engine.ctx = mainCanvas.getContext('2d');
    engine.confCtx = confCanvas.getContext('2d');

    const doResize = () => {
      const rect = container.getBoundingClientRect();
      resize(engine, bgCanvas, mainCanvas, confCanvas, Math.round(rect.width), Math.round(rect.height));
      initStars(engine);
    };
    doResize();

    const ro = new ResizeObserver(doResize);
    ro.observe(container);

    let raf = 0;
    const loop = () => {
      drawBg(engine);
      if (engine.G.running) drawAll(engine);
      drawConfetti(engine);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      if (engine.rafId) cancelAnimationFrame(engine.rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------- Aiming --------------------------------- */
  const getAngleFromPoint = useCallback((cx: number, cy: number) => {
    const engine = engineRef.current;
    return clampAngle(Math.atan2(cy - shooterY(engine), cx - engine.W / 2));
  }, []);

  useEffect(() => {
    const el = aimOverlayRef.current;
    if (!el) return;
    const engine = engineRef.current;

    const onMouseMove = (e: MouseEvent) => {
      if (!engine.G.running) return;
      const rect = el.getBoundingClientRect();
      engine.G.aimAngle = getAngleFromPoint(e.clientX - rect.left, e.clientY - rect.top);
    };
    const onClick = (e: MouseEvent) => {
      if (!engine.G.running || engine.G.shooting) return;
      const rect = el.getBoundingClientRect();
      shoot(engine, getAngleFromPoint(e.clientX - rect.left, e.clientY - rect.top), handlersRef.current);
    };
    let touching = false;
    const onTouchStart = (e: TouchEvent) => {
      if (!engine.G.running) return;
      e.preventDefault();
      touching = true;
      const t = e.touches[0];
      const rect = el.getBoundingClientRect();
      engine.G.aimAngle = getAngleFromPoint(t.clientX - rect.left, t.clientY - rect.top);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touching || !engine.G.running) return;
      e.preventDefault();
      const t = e.touches[0];
      const rect = el.getBoundingClientRect();
      engine.G.aimAngle = getAngleFromPoint(t.clientX - rect.left, t.clientY - rect.top);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!touching || !engine.G.running || engine.G.shooting) return;
      e.preventDefault();
      touching = false;
      const t = e.changedTouches[0];
      const rect = el.getBoundingClientRect();
      shoot(engine, getAngleFromPoint(t.clientX - rect.left, t.clientY - rect.top), handlersRef.current);
    };

    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('click', onClick);
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('click', onClick);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [getAngleFromPoint]);

  /* ------------------------------- Game actions ------------------------------ */
  const beginPlay = useCallback((fromMenu: boolean) => {
    const engine = engineRef.current;
    if (fromMenu) {
      engine.G.diff = diffChoice;
      engine.G.level = 1;
      engine.G.score = 0;
      engine.G.bgHue = levelHue(1);
    }
    engine.G.running = true;
    engine.G.particles = [];
    engine.G.confetti = [];
    if (engine.confCtx) engine.confCtx.clearRect(0, 0, engine.W, engine.H);
    initGrid(engine, handlersRef.current);
    setScreen('playing');
  }, [diffChoice]);

  const startFresh = useCallback(() => beginPlay(true), [beginPlay]);
  const continueNextLevel = useCallback(() => beginPlay(false), [beginPlay]);

  const toggleSound = useCallback(() => {
    const engine = engineRef.current;
    engine.G.soundOn = !engine.G.soundOn;
    setSoundOn(engine.G.soundOn);
  }, []);

  /* --------------------------- Ad (interstitial) flow ------------------------ */
  const requestAd = useCallback((intent: AdIntent) => {
    if (!adsEnabled) {
      // No ads configured — just do the action immediately.
      runAdIntent(intent);
      return;
    }
    setAdIntent(intent);
    setAdSecondsLeft(AD_MIN_SECONDS);
    setAdActive(true);
  }, [adsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAdIntent = useCallback((intent: AdIntent) => {
    if (intent === 'toNextLevel') continueNextLevel();
    else if (intent === 'toRestart') startFresh();
    else if (intent === 'toMenu') setScreen('menu');
  }, [continueNextLevel, startFresh]);

  useEffect(() => {
    if (!adActive) return;
    if (adSecondsLeft <= 0) return;
    const t = setTimeout(() => setAdSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [adActive, adSecondsLeft]);

  const closeAd = useCallback(() => {
    setAdActive(false);
    const intent = adIntent;
    setAdIntent(null);
    runAdIntent(intent);
  }, [adIntent, runAdIntent]);

  /* ---------------------------------------------------------------------- */

  return (
    <div className={className}>
      <style>{bubbleBlastCss}</style>

      {/* SEO: real, crawlable heading + description. Visually styled small,
          but present in the DOM (not display:none) so it stays accessible
          and indexable — pair with the JSON-LD/meta guidance exported below. */}
      <h1 className="bb-seo-h1">Bubble Blast! — Game bắn bóng giải trí miễn phí trên trình duyệt</h1>
      <p className="bb-seo-desc">
        Bubble Blast! là game bắn bóng (bubble shooter) giải trí, chơi ngay trên trình duyệt, không cần cài đặt.
        Ngắm, bắn và nổ các chùm bóng cùng màu qua hàng chục cấp độ với độ khó tăng dần. Phù hợp mọi lứa tuổi,
        chơi mọi lúc rảnh rỗi để thư giãn trên máy tính hoặc điện thoại.
      </p>

      <div className="bb-page">
        <div className="bb-frame" ref={containerRef} role="application" aria-label="Bubble Blast bubble shooter game">
          <canvas ref={bgCanvasRef} className="bb-canvas bb-canvas-bg" aria-hidden="true" />
          <canvas ref={mainCanvasRef} className="bb-canvas bb-canvas-main" aria-hidden="true" />
          <canvas ref={confCanvasRef} className="bb-canvas bb-canvas-conf" aria-hidden="true" />

          {/* ---------------------------- HUD ---------------------------- */}
          {screen === 'playing' && (
            <>
              <div className="bb-hud">
                <div className="bb-hud-side">
                  <div className="bb-pill"><span className="bb-lbl">Cấp</span><span className="bb-val">{level}</span></div>
                  <div className="bb-pill"><span className="bb-lbl">⭐</span><span className="bb-val">{score}</span></div>
                </div>
                <div className="bb-hud-side">
                  <div className="bb-pill"><span className="bb-lbl">🎯</span><span className="bb-val">{moves}</span></div>
                  <div className="bb-pill"><span className="bb-lbl">🔥</span><span className="bb-val">{combo}</span></div>
                  <button type="button" className="bb-sound-btn" onClick={toggleSound} aria-label={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}>
                    {soundOn ? '🔊' : '🔇'}
                  </button>
                </div>
              </div>
              <div className="bb-prog-wrap"><div className="bb-prog-bar" style={{ width: `${progressPct}%` }} /></div>

              <div ref={aimOverlayRef} className="bb-aim-overlay" />

              <div className="bb-shooter-area">
                <div className="bb-next-wrap">
                  <div className="bb-next-lbl">tiếp theo</div>
                  <div className="bb-next-bubble" style={{ background: nextColor }} />
                </div>
              </div>
            </>
          )}

          <div className={`bb-toast ${toast.visible ? 'bb-toast-visible' : ''}`} style={{ color: toast.color }}>{toast.msg}</div>

          {/* --------------------------- MENU --------------------------- */}
          {screen === 'menu' && (
            <div className="bb-screen">
              <div className="bb-screen-emoji">🫧</div>
              <div className="bb-screen-title">Bubble Blast!</div>
              <p className="bb-screen-sub">Ngắm, bắn &amp; nổ bóng cùng màu!<br />Ghép combo để ăn điểm khủng 🌟</p>
              <div className="bb-howto">
                <p>
                  <strong>🖱️ / 👆 Ngắm</strong> rồi bấm hoặc chạm để bắn.<br />
                  Ghép <strong>2+ bóng cùng màu</strong> để làm nổ chúng!<br />
                  Bóng bị cô lập sẽ <strong>rơi và cộng điểm thưởng</strong>.<br />
                  Dọn sạch bảng để lên <strong>cấp độ tiếp theo</strong>!
                </p>
              </div>
              <div className="bb-diff-row" role="radiogroup" aria-label="Chọn độ khó">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={diffChoice === d}
                    className={`bb-diff-btn bb-diff-${d} ${diffChoice === d ? 'bb-selected' : ''}`}
                    onClick={() => setDiffChoice(d)}
                  >
                    {d === 'easy' ? '😊 Dễ' : d === 'medium' ? '🔥 Vừa' : '💀 Khó'}
                  </button>
                ))}
              </div>
              <button type="button" className="bb-big-btn bb-green" onClick={startFresh}>▶ Chơi ngay!</button>

              {adsEnabled && <AdBannerPlaceholder label="Quảng cáo — menu chính" />}
            </div>
          )}

          {/* -------------------------- LEVEL UP -------------------------- */}
          {screen === 'levelup' && (
            <div className="bb-screen">
              <div className="bb-screen-emoji">🎉</div>
              <div className="bb-screen-title">Lên cấp!</div>
              <div className="bb-lvl-num">{level}</div>
              <p className="bb-screen-sub">{LEVELUP_MESSAGES[Math.min(level - 2, LEVELUP_MESSAGES.length - 1)]}</p>
              <button type="button" className="bb-big-btn" onClick={() => requestAd('toNextLevel')}>Cấp tiếp theo →</button>
            </div>
          )}

          {/* -------------------------- GAME OVER -------------------------- */}
          {screen === 'gameover' && (
            <div className="bb-screen">
              <div className="bb-screen-emoji" style={{ animation: 'none' }}>😢</div>
              <div className="bb-screen-title">Kết thúc!</div>
              <div className="bb-score-label">Điểm cuối cùng</div>
              <div className="bb-score-big">{finalScore}</div>
              <div className="bb-score-label">Đạt cấp độ {reachedLevel}</div>
              <button type="button" className="bb-big-btn bb-green" style={{ marginTop: 16 }} onClick={() => requestAd('toRestart')}>🔄 Chơi lại</button>
              <button type="button" className="bb-big-btn bb-outline" onClick={() => requestAd('toMenu')}>🏠 Màn hình chính</button>

              {adsEnabled && <AdBannerPlaceholder label="Quảng cáo — kết thúc ván" />}
            </div>
          )}

          {/* ---------------------- INTERSTITIAL VIDEO AD ---------------------- */}
          {adActive && <AdInterstitial secondsLeft={adSecondsLeft} onClose={closeAd} />}
        </div>
      </div>
    </div>
  );
};

export default BubbleShootGame;

/* ============================================================================
 * AD PLACEHOLDER COMPONENTS
 * ----------------------------------------------------------------------------
 * These are visual stand-ins only — no ad network calls are made. Swap the
 * marked sections for your real ad SDK (Google Ad Manager / AdSense for
 * Games, IMA SDK, AdMob for web, etc.) without touching game logic.
 * ========================================================================== */

const AdInterstitial: React.FC<{ secondsLeft: number; onClose: () => void }> = ({ secondsLeft, onClose }) => {
  const canSkip = secondsLeft <= 0;
  const elapsed = AD_MIN_SECONDS - Math.max(0, secondsLeft);
  const pct = Math.min(100, (elapsed / AD_MIN_SECONDS) * 100);

  return (
    <div className="bb-ad-overlay" role="dialog" aria-modal="true" aria-label="Quảng cáo video">
      <div className="bb-ad-video">
        {/*
          AD INTEGRATION (video interstitial):
          Replace this placeholder <div> with your ad SDK's mount point, e.g.:
            <div id="ad-slot-interstitial" ref={adMountRef} />
          then call your SDK's `loadAd()/playAd()` in a useEffect, and invoke
          `onClose()` from the SDK's "ad completed / ad skipped" callback
          instead of (or in addition to) the button below.
        */}
        <div className="bb-ad-badge">Quảng cáo</div>
        <div className="bb-ad-icon">📺</div>
        <div className="bb-ad-caption">Nội dung quảng cáo sẽ hiển thị ở đây</div>
        <div className="bb-ad-progress"><div className="bb-ad-progress-bar" style={{ width: `${pct}%` }} /></div>
      </div>
      <button type="button" className={`bb-ad-skip ${canSkip ? 'bb-ad-skip-ready' : ''}`} onClick={onClose} disabled={!canSkip}>
        {canSkip ? 'Bỏ qua ▶' : `Bỏ qua sau ${secondsLeft}s`}
      </button>
    </div>
  );
};

const AdBannerPlaceholder: React.FC<{ label: string }> = ({ label }) => (
  <div className="bb-ad-banner" aria-label={label}>
    {/*
      AD INTEGRATION (banner):
      Replace the text below with your ad unit, e.g. an AdSense <ins> tag
      or your network's web component. Keep the fixed-height wrapper so
      layout doesn't jump once a real ad loads.
    */}
    Vị trí quảng cáo (320×50)
  </div>
);

/* ============================================================================
 * STYLES
 * ========================================================================== */

const bubbleBlastCss = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap');

.bb-seo-h1{font-size:11px;line-height:1.3;color:rgba(255,255,255,0.35);font-weight:700;max-width:480px;margin:0 auto;padding:6px 12px 0;text-align:center;font-family:'Nunito',system-ui,sans-serif}
.bb-seo-desc{font-size:10px;line-height:1.4;color:rgba(255,255,255,0.22);max-width:480px;margin:0 auto;padding:2px 16px 8px;text-align:center;font-family:'Nunito',system-ui,sans-serif}

.bb-page{width:100%;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at top,#241242,#0a0414 70%);padding:12px;box-sizing:border-box}

.bb-frame{position:relative;width:100%;max-width:480px;height:min(860px,100dvh);max-height:860px;border-radius:28px;overflow:hidden;background:#1a0a2e;box-shadow:0 20px 60px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.06);font-family:'Nunito',system-ui,sans-serif;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none}
@media (max-width:520px){.bb-frame{border-radius:0;max-height:100dvh}.bb-page{padding:0}}

.bb-canvas{position:absolute;inset:0;width:100%;height:100%}
.bb-canvas-bg{z-index:0}
.bb-canvas-main{z-index:1}
.bb-canvas-conf{z-index:11;pointer-events:none}

.bb-hud{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(0,0,0,0.4);backdrop-filter:blur(10px)}
.bb-hud-side{display:flex;gap:8px;align-items:center}
.bb-pill{background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.25);border-radius:22px;padding:5px 12px;color:#fff;display:flex;align-items:center;gap:5px;min-width:54px;justify-content:center}
.bb-lbl{font-size:10px;font-weight:700;opacity:0.7;text-transform:uppercase;letter-spacing:0.5px}
.bb-val{font-family:'Fredoka One',sans-serif;font-size:17px;color:#fff;line-height:1}
.bb-sound-btn{background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.25);color:#fff;font-size:16px;cursor:pointer;padding:5px 10px;border-radius:18px;line-height:1}

.bb-prog-wrap{position:absolute;top:52px;left:0;right:0;z-index:5;height:6px;background:rgba(0,0,0,0.3)}
.bb-prog-bar{height:100%;background:linear-gradient(90deg,#f9a8d4,#c084fc,#818cf8);transition:width .4s cubic-bezier(.4,0,.2,1);border-radius:0 3px 3px 0}

.bb-aim-overlay{position:absolute;inset:0;z-index:3;cursor:crosshair}

.bb-shooter-area{position:absolute;bottom:0;left:0;right:0;z-index:4;pointer-events:none;display:flex;flex-direction:column;align-items:center;padding-bottom:10px}
.bb-next-wrap{display:flex;flex-direction:column;align-items:center;margin-bottom:4px}
.bb-next-lbl{font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
.bb-next-bubble{width:30px;height:30px;border-radius:50%;border:2.5px solid rgba(255,255,255,0.6);box-shadow:0 0 12px rgba(255,255,255,0.3)}

.bb-toast{position:absolute;top:70px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fff;padding:7px 22px;border-radius:24px;font-size:14px;font-weight:800;pointer-events:none;opacity:0;transition:opacity .3s;z-index:20;white-space:nowrap;font-family:'Fredoka One',sans-serif;letter-spacing:0.5px}
.bb-toast-visible{opacity:1}

.bb-screen{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(8,4,20,0.93);backdrop-filter:blur(8px);padding:20px;text-align:center;overflow-y:auto}

.bb-screen-title{font-family:'Fredoka One',sans-serif;font-size:clamp(32px,9vw,52px);background:linear-gradient(135deg,#fde68a,#f9a8d4,#a5f3fc,#86efac);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.1;margin-bottom:6px}
.bb-screen-emoji{font-size:clamp(44px,12vw,70px);margin-bottom:8px;animation:bb-bounce 1s ease infinite alternate}
@keyframes bb-bounce{to{transform:translateY(-10px)}}
.bb-screen-sub{color:rgba(255,255,255,0.65);font-size:clamp(13px,3.5vw,16px);font-weight:600;margin-bottom:18px;line-height:1.5;max-width:320px}

.bb-diff-row{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;justify-content:center}
.bb-diff-btn{padding:11px 22px;border-radius:28px;border:2.5px solid transparent;font-size:14px;font-weight:800;cursor:pointer;transition:transform .15s,box-shadow .15s;color:#fff;font-family:'Nunito',sans-serif;min-width:100px}
.bb-diff-easy{background:linear-gradient(135deg,#34d399,#059669);border-color:#6ee7b7}
.bb-diff-medium{background:linear-gradient(135deg,#fb923c,#dc2626);border-color:#fdba74}
.bb-diff-hard{background:linear-gradient(135deg,#c026d3,#7c3aed);border-color:#e879f9}
.bb-diff-btn:active{transform:scale(0.94)}
.bb-diff-btn.bb-selected{box-shadow:0 0 0 3px rgba(255,255,255,0.4),0 4px 20px rgba(0,0,0,0.4)}

.bb-big-btn{padding:14px 36px;border-radius:32px;font-size:clamp(15px,4vw,18px);font-weight:800;cursor:pointer;border:none;color:#fff;background:linear-gradient(135deg,#7c3aed,#2563eb);transition:transform .15s,box-shadow .15s;margin:6px;box-shadow:0 6px 24px rgba(124,58,237,0.4);font-family:'Nunito',sans-serif;letter-spacing:0.3px}
.bb-big-btn:active{transform:scale(0.94);box-shadow:0 2px 10px rgba(124,58,237,0.4)}
.bb-big-btn.bb-green{background:linear-gradient(135deg,#16a34a,#059669);box-shadow:0 6px 24px rgba(22,163,74,0.4)}
.bb-big-btn.bb-outline{background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.3);color:rgba(255,255,255,0.8);box-shadow:none}

.bb-score-big{font-family:'Fredoka One',sans-serif;font-size:clamp(54px,14vw,80px);background:linear-gradient(135deg,#fde68a,#f9a8d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;margin:8px 0}
.bb-score-label{color:rgba(255,255,255,0.5);font-size:clamp(12px,3vw,14px);font-weight:700;text-transform:uppercase;letter-spacing:1px}

.bb-howto{background:rgba(255,255,255,0.07);border:2px solid rgba(255,255,255,0.12);border-radius:16px;padding:14px 18px;margin-bottom:18px;max-width:300px;text-align:left}
.bb-howto p{color:rgba(255,255,255,0.65);font-size:12.5px;line-height:1.75;margin:0}
.bb-howto strong{color:#fde68a}

.bb-lvl-num{font-family:'Fredoka One',sans-serif;font-size:clamp(70px,18vw,110px);background:linear-gradient(135deg,#fde68a,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;margin:4px 0 12px}

/* -------------------- Ads -------------------- */
.bb-ad-banner{margin-top:14px;width:100%;max-width:300px;min-height:50px;border:1.5px dashed rgba(255,255,255,0.25);border-radius:10px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.35);font-size:11px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase}

.bb-ad-overlay{position:absolute;inset:0;z-index:30;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.bb-ad-video{width:88%;max-width:340px;aspect-ratio:16/9;background:linear-gradient(135deg,#1e1b3a,#0c0a1a);border-radius:14px;border:1px solid rgba(255,255,255,0.12);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;position:relative;overflow:hidden}
.bb-ad-badge{position:absolute;top:8px;left:8px;background:rgba(255,255,255,0.15);color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;padding:3px 8px;border-radius:6px}
.bb-ad-icon{font-size:40px;opacity:0.8}
.bb-ad-caption{color:rgba(255,255,255,0.45);font-size:12px;font-weight:600;text-align:center;padding:0 20px}
.bb-ad-progress{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,0.12)}
.bb-ad-progress-bar{height:100%;background:linear-gradient(90deg,#818cf8,#c084fc);transition:width 1s linear}
.bb-ad-skip{padding:10px 20px;border-radius:24px;border:2px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);font-weight:800;font-size:13px;cursor:not-allowed;font-family:'Nunito',sans-serif;transition:all .2s}
.bb-ad-skip.bb-ad-skip-ready{cursor:pointer;color:#fff;background:linear-gradient(135deg,#7c3aed,#2563eb);border-color:transparent}
`;

/* ============================================================================
 * SEO METADATA HELPERS
 * ----------------------------------------------------------------------------
 * This component itself is not a full HTML page, so <title>/<meta>/JSON-LD
 * tags belong in your page/layout (Next.js `generateMetadata`, react-helmet,
 * or a plain <head> if you control the HTML shell). Use the values below as
 * a starting point.
 * ========================================================================== */

export const bubbleBlastSeo = {
  title: 'Bubble Blast! – Chơi game bắn bóng miễn phí trên trình duyệt',
  description:
    'Bubble Blast! là game bắn bóng giải trí, gây nghiện, nhiều cấp độ tăng dần độ khó. Chơi miễn phí trên máy tính và điện thoại, không cần cài đặt.',
  keywords: ['bubble shooter', 'game bắn bóng', 'game giải trí', 'game rảnh rỗi', 'game thư giãn', 'chơi game online miễn phí'],
};

export const bubbleBlastJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'Bubble Blast!',
  description: bubbleBlastSeo.description,
  genre: ['Puzzle', 'Casual', 'Bubble Shooter'],
  applicationCategory: 'Game',
  operatingSystem: 'Any (Web Browser)',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};