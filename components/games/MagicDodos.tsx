"use client";

import { useTranslations } from "next-intl";
/**
 * Magic Dodos — React/Next.js game component
 * ---------------------------------------------------------
 * Same rules as the standalone HTML build (engine logic is kept
 * 1:1 identical and was unit-tested before porting). Rendering is
 * plain <canvas> (no Phaser/Pixi dependency) drawn inside a React
 * component, wired up with hooks so it drops into any Next.js
 * app router page as a client component:
 *
 *   const MagicDodos = dynamic(() => import('./MagicDodos'), { ssr: false });
 *
 * Drop `locales/en.json` and `locales/vi.json` next to this file
 * (or anywhere you like — just adjust the imports below).
 * ---------------------------------------------------------
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* =========================================================
   1) ENGINE — identical rules to engine.js / magic-dodos.html
   ========================================================= */
const BOARD_SIZE = 8;

type ColorDef = { id: string; fill: string; dark: string; light: string };
type Cell = [number, number];
type Piece = { id: string; cells: Cell[]; color: ColorDef; used: boolean };
type BoardCell = ColorDef | null;
type Board = BoardCell[][];

const COLORS: ColorDef[] = [
  { id: "coral", fill: "#FF6B6B", dark: "#D9464C", light: "#FFB4B0" },
  { id: "teal", fill: "#3FC7C1", dark: "#279893", light: "#A6ECE8" },
  { id: "gold", fill: "#FFCB4C", dark: "#E0A419", light: "#FFE9A8" },
  { id: "violet", fill: "#B18AF0", dark: "#7E5AC2", light: "#E3D2FB" },
  { id: "mint", fill: "#6FDA8C", dark: "#39A85C", light: "#C4F5D2" },
  { id: "sky", fill: "#5AA9FF", dark: "#2E76D6", light: "#BEDCFF" },
  { id: "rose", fill: "#FF8FC0", dark: "#DB5A92", light: "#FFD2E7" },
  { id: "amber", fill: "#FFA13D", dark: "#DB7B16", light: "#FFD4A0" },
];

const SHAPES: { cells: Cell[]; tier: 1 | 2 | 3 }[] = [
  { cells: [[0, 0]], tier: 1 },
  { cells: [[0, 0], [0, 1]], tier: 1 },
  { cells: [[0, 0], [1, 0]], tier: 1 },
  { cells: [[0, 0], [0, 1], [0, 2]], tier: 1 },
  { cells: [[0, 0], [1, 0], [2, 0]], tier: 1 },
  { cells: [[0, 0], [0, 1], [1, 0]], tier: 1 },
  { cells: [[0, 0], [0, 1], [1, 1]], tier: 1 },
  { cells: [[0, 1], [1, 0], [1, 1]], tier: 1 },
  { cells: [[0, 0], [1, 0], [1, 1]], tier: 1 },
  { cells: [[0, 0], [0, 1], [0, 2], [0, 3]], tier: 2 },
  { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], tier: 2 },
  { cells: [[0, 0], [0, 1], [1, 0], [1, 1]], tier: 2 },
  { cells: [[0, 0], [0, 1], [0, 2], [1, 0]], tier: 2 },
  { cells: [[0, 0], [0, 1], [0, 2], [1, 2]], tier: 2 },
  { cells: [[1, 0], [1, 1], [1, 2], [0, 2]], tier: 2 },
  { cells: [[0, 0], [1, 0], [1, 1], [1, 2]], tier: 2 },
  { cells: [[0, 0], [0, 1], [1, 1], [1, 2]], tier: 2 },
  { cells: [[0, 1], [0, 2], [1, 0], [1, 1]], tier: 2 },
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], tier: 2 },
  { cells: [[0, 1], [1, 0], [1, 1], [2, 0]], tier: 2 },
  { cells: [[0, 0], [0, 1], [0, 2], [1, 1]], tier: 2 },
  { cells: [[0, 1], [1, 0], [1, 1], [1, 2]], tier: 2 },
  { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], tier: 3 },
  { cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], tier: 3 },
  { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2]], tier: 3 },
  { cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]], tier: 3 },
  { cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]], tier: 3 },
  { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], tier: 3 },
  { cells: [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]], tier: 3 },
];

function normalize(cells: Cell[]): Cell[] {
  const minR = Math.min(...cells.map((c) => c[0]));
  const minC = Math.min(...cells.map((c) => c[1]));
  return cells.map(([r, c]) => [r - minR, c - minC]);
}
function shapeBounds(cells: Cell[]) {
  const rows = cells.map((c) => c[0]);
  const cols = cells.map((c) => c[1]);
  return { h: Math.max(...rows) + 1, w: Math.max(...cols) + 1 };
}
function weightsForLevel(level: number): number[] {
  if (level <= 2) return [1, 1, 1, 1, 2];
  if (level <= 4) return [1, 1, 2, 2, 2, 3];
  if (level <= 7) return [1, 2, 2, 3, 3];
  return [1, 2, 3, 3, 3];
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function makePiece(level: number): Piece {
  const tier = pick(weightsForLevel(level));
  const candidates = SHAPES.filter((s) => s.tier === tier);
  const shape = pick(candidates);
  const color = pick(COLORS);
  return {
    id: Math.random().toString(36).slice(2, 9),
    cells: normalize(shape.cells),
    color,
    used: false,
  };
}
function makeTray(level: number): Piece[] {
  return [makePiece(level), makePiece(level), makePiece(level)];
}
function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}
function canPlace(board: Board, piece: Piece, row: number, col: number): boolean {
  for (const [dr, dc] of piece.cells) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (board[r][c]) return false;
  }
  return true;
}
function pieceFitsSomewhere(board: Board, piece: Piece): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (canPlace(board, piece, r, c)) return true;
    }
  }
  return false;
}
function anyPieceFits(board: Board, tray: Piece[]): boolean {
  return tray.some((p) => !p.used && pieceFitsSomewhere(board, p));
}
function placePieceOnBoard(board: Board, piece: Piece, row: number, col: number): Board {
  const next = board.map((r) => r.slice());
  for (const [dr, dc] of piece.cells) next[row + dr][col + dc] = piece.color;
  return next;
}
function findFullLines(board: Board) {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) if (board[r].every(Boolean)) rows.push(r);
  for (let c = 0; c < BOARD_SIZE; c++) if (board.every((row) => row[c])) cols.push(c);
  return { rows, cols };
}
function clearLines(board: Board, rows: number[], cols: number[]): Board {
  const next = board.map((r) => r.slice());
  for (const r of rows) for (let c = 0; c < BOARD_SIZE; c++) next[r][c] = null;
  for (const c of cols) for (let r = 0; r < BOARD_SIZE; r++) next[r][c] = null;
  return next;
}
function scoreForPlacement(cellCount: number): number {
  return cellCount * 8;
}
function scoreForClear(linesCleared: number, comboStreak: number): number {
  const base = [0, 60, 160, 300, 500][Math.min(linesCleared, 4)];
  const mult = 1 + Math.min(comboStreak, 8) * 0.25;
  return Math.round(base * mult);
}
function levelForScore(score: number): number {
  return Math.floor(score / 350) + 1;
}


/* =========================================================
   3) Small canvas helpers (shared drawing look w/ HTML build)
   ========================================================= */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawEgg(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: ColorDef, alpha = 1) {
  const pad = size * 0.07;
  const w = size - pad * 2;
  const h = size - pad * 2;
  const r = size * 0.26;
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, color.light);
  grad.addColorStop(0.5, color.fill);
  grad.addColorStop(1, color.dark);
  roundRectPath(ctx, x + pad, y + pad, w, h, r);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.55;
  ctx.beginPath();
  ctx.ellipse(x + pad + w * 0.32, y + pad + h * 0.28, w * 0.22, h * 0.13, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = color.dark;
  for (const [sx, sy] of [[0.62, 0.62], [0.72, 0.4], [0.42, 0.72]]) {
    ctx.beginPath();
    ctx.arc(x + pad + w * sx, y + pad + h * sy, size * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawEmptyCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const pad = size * 0.07;
  roundRectPath(ctx, x + pad, y + pad, size - pad * 2, size - pad * 2, size * 0.24);
  ctx.fillStyle = "rgba(255,255,255,0.045)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.stroke();
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string };
type FloatText = { x: number; y: number; text: string; life: number; color: string };
type ClearingCell = { r: number; c: number; life: number };
type DragState = {
  pieceIndex: number;
  piece: Piece;
  w: number;
  h: number;
  targetRow: number;
  targetCol: number;
  valid: boolean;
  clientX: number;
  clientY: number;
};

/* =========================================================
   4) Sound (WebAudio, synthesized — no audio assets needed)
   ========================================================= */
function useSoundEngine(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return null;
      ctxRef.current = new Ctx();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);
  const tone = useCallback(
    (freq: number, dur: number, type: OscillatorType = "sine", vol = 0.2, delay = 0) => {
      if (!enabled) return;
      const ctx = ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    [enabled, ensure]
  );
  const SCALE = [392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.0];
  return {
    ensure,
    playPop: () => tone(520, 0.08, "triangle", 0.15),
    playError: () => tone(140, 0.18, "sawtooth", 0.12),
    playPlace: () => tone(300, 0.05, "sine", 0.08),
    playCombo: (n: number) => {
      const steps = Math.min(n, SCALE.length);
      for (let i = 0; i < steps; i++) tone(SCALE[i], 0.16, "sine", 0.18, i * 0.07);
    },
    playLevelUp: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.2, "triangle", 0.2, i * 0.09)),
    playUiTick: () => tone(440, 0.08, "sine", 0.15),
  };
}

/* =========================================================
   5) Main component
   ========================================================= */
export default function MagicDodos() {
  const [lang, setLang] = useState<"en" | "vi">("vi");
  const [soundOn, setSoundOn] = useState(true);
  const [screen, setScreen] = useState<"welcome" | "playing" | "gameover">("welcome");
  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [tray, setTray] = useState<Piece[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [level, setLevel] = useState(1);
  const [comboStreak, setComboStreak] = useState(0);
  const [comboFlash, setComboFlash] = useState(0);
  const [charms, setCharms] = useState({ shuffle: 1, bomb: 1, undo: 1 });
  const [bombArmed, setBombArmed] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [adKind, setAdKind] = useState<null | "shuffle" | "bomb" | "undo" | "continue" | "interstitial">(null);
  const [adRemaining, setAdRemaining] = useState(3);
  const [levelUpToast, setLevelUpToast] = useState<number | null>(null);

  const historyRef = useRef<{ board: Board; score: number; level: number; comboStreak: number; tray: Piece[] } | null>(null);
  const lastInterstitialAt = useRef(0);
  const boardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cellPxRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const floatTextsRef = useRef<FloatText[]>([]);
  const clearingRef = useRef<ClearingCell[]>([]);
  const shakeRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const bombHoverRef = useRef<{ r0: number; r1: number; c0: number; c1: number } | null>(null);
  const boardRef = useRef(board);
  boardRef.current = board;
  const trayRef = useRef(tray);
  trayRef.current = tray;

  const t = useTranslations('magicDodos');

  const sound = useSoundEngine(soundOn);

  // ---- persistence ----
  useEffect(() => {
    const savedBest = parseInt(localStorage.getItem("magicDodos_best") || "0", 10) || 0;
    const savedLang = localStorage.getItem("magicDodos_lang") as "en" | "vi" | null;
    const savedSound = localStorage.getItem("magicDodos_sound");
    setBest(savedBest);
    if (savedLang) setLang(savedLang);
    if (savedSound !== null) setSoundOn(savedSound !== "0");
  }, []);
  useEffect(() => localStorage.setItem("magicDodos_lang", lang), [lang]);
  useEffect(() => localStorage.setItem("magicDodos_sound", soundOn ? "1" : "0"), [soundOn]);

  // ---- canvas sizing ----
  useEffect(() => {
    function resize() {
      const canvas = boardCanvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const side = Math.max(120, Math.min(wrap.clientWidth, wrap.clientHeight));
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = side + "px";
      canvas.style.height = side + "px";
      canvas.width = Math.round(side * dpr);
      canvas.height = Math.round(side * dpr);
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      cellPxRef.current = side / BOARD_SIZE;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ---- render loop ----
  useEffect(() => {
    let raf = 0;
    let last = 0;
    function frame(ts: number) {
      const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
      last = ts;
      shakeRef.current *= 0.86;
      if (shakeRef.current < 0.05) shakeRef.current = 0;
      clearingRef.current = clearingRef.current.filter((c) => (c.life -= dt * 4) > 0);
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22;
        p.life -= dt * 1.6;
        return p.life > 0;
      });
      floatTextsRef.current = floatTextsRef.current.filter((f) => {
        f.y -= 24 * dt;
        f.life -= dt * 0.8;
        return f.life > 0;
      });
      renderBoard();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderBoard() {
    const canvas = boardCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cellPx = cellPxRef.current;
    const w = cellPx * BOARD_SIZE;
    const h = cellPx * BOARD_SIZE;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);

    roundRectPath(ctx, 0, 0, w, h, cellPx * 0.5);
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, "#241740");
    bgGrad.addColorStop(1, "#1B1030");
    ctx.fillStyle = bgGrad;
    ctx.fill();

    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) drawEmptyCell(ctx, c * cellPx, r * cellPx, cellPx);

    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4 * cellPx, 4);
    ctx.lineTo(4 * cellPx, h - 4);
    ctx.moveTo(4, 4 * cellPx);
    ctx.lineTo(w - 4, 4 * cellPx);
    ctx.stroke();

    const b = boardRef.current;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const color = b[r][c];
        if (color) drawEgg(ctx, c * cellPx, r * cellPx, cellPx, color, 1);
      }
    }

    for (const cc of clearingRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, cc.life);
      roundRectPath(ctx, cc.c * cellPx + cellPx * 0.1, cc.r * cellPx + cellPx * 0.1, cellPx * 0.8, cellPx * 0.8, cellPx * 0.22);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.restore();
    }

    const d = dragRef.current;
    if (d) {
      for (const [dr, dc] of d.piece.cells) {
        const r = d.targetRow + dr;
        const c = d.targetCol + dc;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;
        ctx.save();
        ctx.globalAlpha = 0.55;
        roundRectPath(ctx, c * cellPx + cellPx * 0.06, r * cellPx + cellPx * 0.06, cellPx * 0.88, cellPx * 0.88, cellPx * 0.22);
        ctx.fillStyle = d.valid ? "rgba(111,218,140,0.55)" : "rgba(255,107,107,0.5)";
        ctx.fill();
        ctx.restore();
      }
    }

    if (bombHoverRef.current) {
      const { r0, c0, r1, c1 } = bombHoverRef.current;
      ctx.save();
      ctx.globalAlpha = 0.4;
      roundRectPath(ctx, c0 * cellPx, r0 * cellPx, (c1 - c0 + 1) * cellPx, (r1 - r0 + 1) * cellPx, cellPx * 0.3);
      ctx.fillStyle = "rgba(255,107,107,0.5)";
      ctx.fill();
      ctx.restore();
    }

    for (const p of particlesRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const f of floatTextsRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = `700 ${cellPx * 0.42}px 'Fredoka', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
    ctx.restore();
  }

  function spawnParticles(x: number, y: number, color: ColorDef | undefined, count = 10) {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.9) * 6,
        life: 1,
        size: 2 + Math.random() * 3,
        color: color ? color.fill : "#FFC857",
      });
    }
  }
  function addShake(v: number) {
    shakeRef.current = Math.min(14, shakeRef.current + v);
  }

  // ---- game actions ----
  const startNewGame = useCallback(() => {
    setBoard(emptyBoard());
    setScore(0);
    setLevel(1);
    setComboStreak(0);
    setCharms({ shuffle: 1, bomb: 1, undo: 1 });
    historyRef.current = null;
    setTray(makeTray(1));
    setScreen("playing");
    particlesRef.current = [];
    floatTextsRef.current = [];
    clearingRef.current = [];
    sound.ensure();
  }, [sound]);

  const commitPlacement = useCallback(
    (piece: Piece, row: number, col: number) => {
      historyRef.current = {
        board: boardRef.current.map((r) => r.slice()),
        score,
        level,
        comboStreak,
        tray: trayRef.current.map((p) => ({ ...p, cells: p.cells.map((c) => [...c] as Cell) })),
      };

      let nextBoard = placePieceOnBoard(boardRef.current, piece, row, col);
      const cellPx = cellPxRef.current;
      const { w: pw, h: ph } = shapeBounds(piece.cells);
      spawnParticles((col + pw / 2) * cellPx, (row + ph / 2) * cellPx, piece.color, 6);
      sound.playPlace();

      let nextScore = score + scoreForPlacement(piece.cells.length);
      const { rows, cols } = findFullLines(nextBoard);
      const linesCleared = rows.length + cols.length;
      let nextCombo = comboStreak;

      if (linesCleared > 0) {
        for (const r of rows) for (let c = 0; c < BOARD_SIZE; c++) clearingRef.current.push({ r, c, life: 1 });
        for (const c of cols) for (let r = 0; r < BOARD_SIZE; r++) clearingRef.current.push({ r, c, life: 1 });
        for (const r of rows)
          for (let c = 0; c < BOARD_SIZE; c++) spawnParticles(c * cellPx + cellPx / 2, r * cellPx + cellPx / 2, nextBoard[r][c] ?? undefined, 5);
        for (const c of cols)
          for (let r = 0; r < BOARD_SIZE; r++) spawnParticles(c * cellPx + cellPx / 2, r * cellPx + cellPx / 2, nextBoard[r][c] ?? undefined, 5);
        nextBoard = clearLines(nextBoard, rows, cols);
        const gained = scoreForClear(linesCleared, comboStreak);
        nextScore += gained;
        nextCombo = comboStreak + 1;
        addShake(4 + linesCleared * 2);
        sound.playCombo(nextCombo + 1);
        floatTextsRef.current.push({
          x: (BOARD_SIZE * cellPx) / 2,
          y: BOARD_SIZE * cellPx * 0.4,
          text: "+" + gained,
          life: 1.3,
          color: "#FFC857",
        });
        setComboFlash(nextCombo + 1);
        window.setTimeout(() => setComboFlash(0), 1400);
      } else {
        nextCombo = 0;
      }

      const updatedTray = trayRef.current.map((p) => (p.id === piece.id ? { ...p, used: true } : p));
      const finalTray = updatedTray.every((p) => p.used) ? makeTray(levelForScore(nextScore)) : updatedTray;

      setBoard(nextBoard);
      setScore(nextScore);
      setComboStreak(nextCombo);
      setTray(finalTray);
      boardRef.current = nextBoard;
      trayRef.current = finalTray;

      setBest((prevBest) => {
        if (nextScore > prevBest) {
          localStorage.setItem("magicDodos_best", String(nextScore));
          return nextScore;
        }
        return prevBest;
      });

      const newLevel = levelForScore(nextScore);
      if (newLevel > level) {
        setLevel(newLevel);
        sound.playLevelUp();
        setLevelUpToast(newLevel);
        window.setTimeout(() => setLevelUpToast(null), 1400);
        const now = Date.now();
        if (newLevel > 1 && (newLevel - 1) % 2 === 0 && now - lastInterstitialAt.current > 70000) {
          lastInterstitialAt.current = now;
          window.setTimeout(() => openAdModal("interstitial"), 900);
        }
      }

      if (!anyPieceFits(nextBoard, finalTray)) {
        window.setTimeout(() => setScreen("gameover"), 260);
      }
    },
    [score, level, comboStreak, sound]
  );

  function doShuffle() {
    if (charms.shuffle <= 0) return openAdModal("shuffle");
    const next = makeTray(level);
    setCharms((c) => ({ ...c, shuffle: c.shuffle - 1 }));
    setTray(next);
    trayRef.current = next;
    if (!anyPieceFits(boardRef.current, next)) window.setTimeout(() => setScreen("gameover"), 200);
  }
  function armBomb() {
    if (charms.bomb <= 0) return openAdModal("bomb");
    setBombArmed((v) => !v);
  }
  function applyBombAt(row: number, col: number) {
    historyRef.current = {
      board: boardRef.current.map((r) => r.slice()),
      score,
      level,
      comboStreak,
      tray: trayRef.current.map((p) => ({ ...p, cells: p.cells.map((c) => [...c] as Cell) })),
    };
    const cellPx = cellPxRef.current;
    const next = boardRef.current.map((r) => r.slice());
    const r0 = Math.max(0, row - 1),
      r1 = Math.min(BOARD_SIZE - 1, row + 1);
    const c0 = Math.max(0, col - 1),
      c1 = Math.min(BOARD_SIZE - 1, col + 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (next[r][c]) spawnParticles(c * cellPx + cellPx / 2, r * cellPx + cellPx / 2, next[r][c] ?? undefined, 4);
        next[r][c] = null;
      }
    }
    setBoard(next);
    boardRef.current = next;
    setCharms((c) => ({ ...c, bomb: c.bomb - 1 }));
    setBombArmed(false);
    addShake(8);
    sound.playCombo(3);
    if (!anyPieceFits(next, trayRef.current)) window.setTimeout(() => setScreen("gameover"), 200);
  }
  function doUndo() {
    if (charms.undo <= 0) return openAdModal("undo");
    const h = historyRef.current;
    if (!h) return;
    setBoard(h.board);
    setScore(h.score);
    setLevel(h.level);
    setComboStreak(h.comboStreak);
    setTray(h.tray);
    boardRef.current = h.board;
    trayRef.current = h.tray;
    setCharms((c) => ({ ...c, undo: c.undo - 1 }));
    historyRef.current = null;
  }

  // ---- simulated ad modal ----
  const adTimerRef = useRef<number | null>(null);
  function openAdModal(kind: typeof adKind) {
    setAdKind(kind);
    setAdRemaining(3);
    if (adTimerRef.current) window.clearInterval(adTimerRef.current);
    adTimerRef.current = window.setInterval(() => {
      setAdRemaining((r) => Math.max(0, r - 1));
    }, 1000);
  }
  function closeAdModal(reward: boolean) {
    if (adTimerRef.current) window.clearInterval(adTimerRef.current);
    const kind = adKind;
    setAdKind(null);
    if (reward && kind) {
      if (kind === "continue") {
        let cleared = 0;
        const next = boardRef.current.map((r) => r.slice());
        for (let r = BOARD_SIZE - 1; r >= 0 && cleared < 10; r--) {
          for (let c = 0; c < BOARD_SIZE && cleared < 10; c++) {
            if (next[r][c]) {
              next[r][c] = null;
              cleared++;
            }
          }
        }
        setBoard(next);
        boardRef.current = next;
        setScreen("playing");
        if (!anyPieceFits(next, trayRef.current)) {
          const t2 = makeTray(level);
          setTray(t2);
          trayRef.current = t2;
        }
      } else if (kind !== "interstitial") {
        setCharms((c) => ({ ...c, [kind]: (c as any)[kind] + 1 }));
      }
    }
  }

  // ---- drag and drop ----
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [ghostStyle, setGhostStyle] = useState<React.CSSProperties>({ transform: "translate(-1000px,-1000px)" });
  const [ghostPiece, setGhostPiece] = useState<Piece | null>(null);
  const LIFT_CELLS = 1.3;

  function onTrayPointerDown(e: React.PointerEvent, idx: number) {
    if (screen !== "playing") return;
    const piece = tray[idx];
    if (!piece || piece.used) return;
    e.preventDefault();
    sound.ensure();
    const { w, h } = shapeBounds(piece.cells);
    dragRef.current = { pieceIndex: idx, piece, w, h, targetRow: -99, targetCol: -99, valid: false, clientX: e.clientX, clientY: e.clientY };
    setGhostPiece(piece);
    updateDrag(e.clientX, e.clientY);
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd, { once: true });
  }
  function updateDrag(clientX: number, clientY: number) {
    const d = dragRef.current;
    const canvas = boardCanvasRef.current;
    if (!d || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cellPx = cellPxRef.current;
    const liftPx = cellPx * LIFT_CELLS;
    const bboxW = d.w * cellPx,
      bboxH = d.h * cellPx;
    const centerX = clientX - rect.left;
    const centerY = clientY - rect.top - liftPx;
    let targetCol = Math.round((centerX - bboxW / 2) / cellPx);
    let targetRow = Math.round((centerY - bboxH / 2) / cellPx);
    targetCol = Math.max(0, Math.min(BOARD_SIZE - d.w, targetCol));
    targetRow = Math.max(0, Math.min(BOARD_SIZE - d.h, targetRow));
    d.targetCol = targetCol;
    d.targetRow = targetRow;
    d.valid = canPlace(boardRef.current, d.piece, targetRow, targetCol);
    setGhostStyle({ transform: `translate(${clientX - bboxW / 2}px, ${clientY - liftPx - bboxH / 2}px)` });
  }
  function onDragMove(e: PointerEvent) {
    updateDrag(e.clientX, e.clientY);
  }
  function onDragEnd() {
    window.removeEventListener("pointermove", onDragMove);
    const d = dragRef.current;
    setGhostStyle({ transform: "translate(-1000px,-1000px)" });
    setGhostPiece(null);
    dragRef.current = null;
    if (!d) return;
    if (d.valid) {
      commitPlacement(d.piece, d.targetRow, d.targetCol);
    } else {
      sound.playError();
    }
  }
  function onBoardPointerDown(e: React.PointerEvent) {
    if (!bombArmed) return;
    const canvas = boardCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cellPx = cellPxRef.current;
    const col = Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor((e.clientX - rect.left) / cellPx)));
    const row = Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor((e.clientY - rect.top) / cellPx)));
    applyBombAt(row, col);
  }
  function onBoardPointerMove(e: React.PointerEvent) {
    if (!bombArmed) return;
    const canvas = boardCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cellPx = cellPxRef.current;
    const col = Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor((e.clientX - rect.left) / cellPx)));
    const row = Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor((e.clientY - rect.top) / cellPx)));
    bombHoverRef.current = { r0: Math.max(0, row - 1), r1: Math.min(BOARD_SIZE - 1, row + 1), c0: Math.max(0, col - 1), c1: Math.min(BOARD_SIZE - 1, col + 1) };
  }

  const trayRefs = useMemo(() => [React.createRef<HTMLCanvasElement>(), React.createRef<HTMLCanvasElement>(), React.createRef<HTMLCanvasElement>()], []);
  useEffect(() => {
    tray.forEach((piece, idx) => {
      const canvas = trayRefs[idx].current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth || 104;
      const ch = canvas.clientHeight || 88;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      if (!piece || piece.used) return;
      const { h, w } = shapeBounds(piece.cells);
      const pad = 10;
      const size = Math.min((cw - pad * 2) / w, (ch - pad * 2) / h);
      const offX = (cw - size * w) / 2,
        offY = (ch - size * h) / 2;
      for (const [dr, dc] of piece.cells) drawEgg(ctx, offX + dc * size, offY + dr * size, size, piece.color, 1);
    });
  }, [tray, trayRefs]);

  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ghostCanvasRef.current;
    if (!canvas || !ghostPiece) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { h, w } = shapeBounds(ghostPiece.cells);
    const size = cellPxRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * size * dpr;
    canvas.height = h * size * dpr;
    canvas.style.width = w * size + "px";
    canvas.style.height = h * size + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w * size, h * size);
    for (const [dr, dc] of ghostPiece.cells) drawEgg(ctx, dc * size, dr * size, size, ghostPiece.color, 0.96);
  }, [ghostPiece]);

  return (
    <div style={styles.body}>
      <div style={{ ...styles.blob, width: 420, height: 420, background: "#7E5AC2", top: -120, left: -120 }} />
      <div style={{ ...styles.blob, width: 380, height: 380, background: "#2E76D6", bottom: -140, right: -100 }} />
      <div style={{ ...styles.blob, width: 260, height: 260, background: "#DB5A92", bottom: "10%", left: "6%" }} />

      <div ref={stageRef} style={styles.stage}>
        <div style={styles.hud}>
          <button style={styles.iconBtn} onClick={() => setShowMenu(true)} aria-label="Menu">
            ☰
          </button>
          <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
            <div style={styles.title}>{t("title")}</div>
            <div style={styles.subtitle}>{t("subtitle")}</div>
          </div>
          <div style={styles.statPill}>
            <b style={styles.statB}>{score}</b>
            <span style={styles.statSpan}>{String(t("score")).toUpperCase()}</span>
          </div>
          <div style={styles.statPill}>
            <b style={styles.statB}>{best}</b>
            <span style={styles.statSpan}>{String(t("best")).toUpperCase()}</span>
          </div>
        </div>

        <div style={styles.subhud}>
          <div style={styles.levelChip}>
            {t("level")} <b>{level}</b>
          </div>
          <div style={{ ...styles.comboChip, opacity: comboFlash >= 2 ? 1 : 0, transform: comboFlash >= 2 ? "translateY(0) scale(1)" : "translateY(-4px) scale(.9)" }}>
            Combo x{comboFlash}
          </div>
        </div>

        <div ref={wrapRef} style={styles.boardWrap}>
          <canvas
            ref={boardCanvasRef}
            style={{ width: "100%", height: "100%", touchAction: "none", display: "block" }}
            onPointerDown={onBoardPointerDown}
            onPointerMove={onBoardPointerMove}
          />
          {levelUpToast !== null && (
            <div style={styles.levelToast}>
              <small style={{ display: "block", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 10.5, opacity: 0.8 }}>{t("levelUp")}</small>
              {levelUpToast}
            </div>
          )}
        </div>

        <div style={styles.tray}>
          {[0, 1, 2].map((idx) => (
            <div key={idx} style={{ ...styles.traySlot, opacity: !tray[idx] || tray[idx].used ? 0.25 : 1 }} onPointerDown={(e) => onTrayPointerDown(e, idx)}>
              <canvas ref={trayRefs[idx]} style={{ width: "100%", height: "100%", display: "block" }} />
            </div>
          ))}
        </div>

        <div style={styles.charms}>
          <button style={styles.charmBtn} onClick={doShuffle}>
            <span style={{ fontSize: 20 }}>🔀</span>
            <span style={styles.charmLabel}>{t("shuffle")}</span>
            <span style={{ ...styles.count, ...(charms.shuffle <= 0 ? styles.countZero : {}) }}>{charms.shuffle}</span>
          </button>
          <button style={{ ...styles.charmBtn, ...(bombArmed ? styles.charmArmed : {}) }} onClick={armBomb}>
            <span style={{ fontSize: 20 }}>💥</span>
            <span style={styles.charmLabel}>{t("bomb")}</span>
            <span style={{ ...styles.count, ...(charms.bomb <= 0 ? styles.countZero : {}) }}>{charms.bomb}</span>
          </button>
          <button style={{ ...styles.charmBtn, opacity: historyRef.current ? 1 : 0.55 }} onClick={doUndo}>
            <span style={{ fontSize: 20 }}>↩️</span>
            <span style={styles.charmLabel}>{t("undo")}</span>
            <span style={{ ...styles.count, ...(charms.undo <= 0 ? styles.countZero : {}) }}>{charms.undo}</span>
          </button>
        </div>

        <div style={styles.adslot}>
          <span style={styles.dot} />
          <span>{t("adPlaceholder")}</span>
          <span style={styles.dot} />
        </div>

        {/* ===== Overlays ===== */}
        {screen === "welcome" && (
          <div style={styles.overlay}>
            <div style={styles.card}>
              <div style={styles.emojiHero}>🥚✨</div>
              <h2 style={styles.h2}>{t("welcomeTitle")}</h2>
              <p style={styles.p}>{t("welcomeBody")}</p>
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={startNewGame}>
                ▶ {t("play")}
              </button>
              <button style={styles.btnGhost} onClick={() => setShowHowTo(true)}>
                {t("howToPlay")}
              </button>
            </div>
          </div>
        )}

        {showHowTo && (
          <div style={styles.overlay}>
            <div style={styles.card}>
              <div style={styles.emojiHero}>🪄</div>
              <h2 style={styles.h2}>{t("howToPlay")}</h2>
              <p style={styles.p}>{t("howToPlayText")}</p>
              <p style={styles.p}>{t("howToPlayText2")}</p>
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowHowTo(false)}>
                {t("close")}
              </button>
            </div>
          </div>
        )}

        {showMenu && (
          <div style={styles.overlay}>
            <div style={styles.card}>
              <div style={styles.emojiHero}>🦤</div>
              <h2 style={styles.h2}>{t("menu")}</h2>
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowMenu(false)}>
                {t("resume")}
              </button>
              <button
                style={styles.btnGhost}
                onClick={() => {
                  setSoundOn((s) => !s);
                  sound.playUiTick();
                }}
              >
                {soundOn ? "🔊" : "🔇"} {t("sound")}
              </button>
              <button
                style={{ ...styles.btnGhost, marginTop: 9 }}
                onClick={() => {
                  setShowMenu(false);
                  setScreen("welcome");
                }}
              >
                {t("quitToMenu")}
              </button>
            </div>
          </div>
        )}

        {screen === "gameover" && (
          <div style={styles.overlay}>
            <div style={styles.card}>
              <div style={styles.emojiHero}>🐣💤</div>
              <h2 style={styles.h2}>{t("gameOver")}</h2>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", margin: "6px 0 16px" }}>
                <div style={{ ...styles.statPill, minWidth: 90 }}>
                  <b style={styles.statB}>{score}</b>
                  <span style={styles.statSpan}>{String(t("finalScore")).toUpperCase()}</span>
                </div>
                <div style={{ ...styles.statPill, minWidth: 90 }}>
                  <b style={styles.statB}>{best}</b>
                  <span style={styles.statSpan}>{String(t("best")).toUpperCase()}</span>
                </div>
              </div>
              {score >= best && score > 0 && <p style={{ color: "#FFC857", fontWeight: 800 }}>{t("newBest")}</p>}
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => openAdModal("continue")}>
                🎬 {t("watchAdContinue")}
              </button>
              <button style={styles.btnGhost} onClick={startNewGame}>
                {t("restart")}
              </button>
            </div>
          </div>
        )}

        {adKind && (
          <div style={styles.overlay}>
            <div style={styles.card}>
              <div style={styles.adBox}>
                {adRemaining > 0 && <div style={styles.spinner} />}
                <div style={{ fontFamily: "Fredoka, sans-serif", fontSize: 16 }}>{t("title")}</div>
                <div>{adRemaining > 0 ? t("loadingAd") : t("title")}</div>
              </div>
              <button style={styles.btnGhost} disabled={adRemaining > 0} onClick={() => closeAdModal(true)}>
                {t("adSkip")}
                {adRemaining > 0 ? ` (${adRemaining})` : ""}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "fixed", zIndex: 20, left: 0, top: 0, pointerEvents: "none", ...ghostStyle, filter: "drop-shadow(0 14px 18px rgba(0,0,0,.42))" }}>
        <canvas ref={ghostCanvasRef} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  );
}

/* =========================================================
   6) Inline style tokens (kept in JS so the component is
      drop-in portable without a separate CSS file/Tailwind)
   ========================================================= */
const styles: Record<string, React.CSSProperties> = {
  body: {
    fontFamily: "'Nunito', system-ui, -apple-system, sans-serif",
    color: "#F4EEFF",
    background:
      "radial-gradient(60% 50% at 15% 8%, rgba(255,200,87,0.10), transparent 60%), radial-gradient(70% 60% at 90% 90%, rgba(90,169,255,0.12), transparent 60%), linear-gradient(160deg, #1B1030, #2C1B54 60%, #190C2E 100%)",
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    userSelect: "none",
  },
  blob: { position: "fixed", borderRadius: "50%", filter: "blur(60px)", opacity: 0.35, pointerEvents: "none", zIndex: 0 },
  stage: {
    position: "relative",
    zIndex: 1,
    width: "min(440px, 100vw)",
    height: "min(920px, 100dvh)",
    background: "linear-gradient(180deg, #2A1D4E, #241740 90%)",
    borderRadius: 26,
    boxShadow: "0 18px 40px rgba(10,4,30,0.45)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  hud: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 8px", flex: "0 0 auto" },
  iconBtn: { width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.06)", color: "#F4EEFF", fontSize: 18, cursor: "pointer" },
  title: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 19, color: "#FFC857", lineHeight: 1.05 },
  subtitle: { fontSize: 10.5, color: "#B7AAD9", marginTop: 1 },
  statPill: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 56, padding: "4px 8px", borderRadius: 12, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.10)" },
  statB: { fontFamily: "'Fredoka', sans-serif", fontSize: 15, lineHeight: 1.1 },
  statSpan: { fontSize: 8.5, letterSpacing: 0.6, color: "#B7AAD9" },
  subhud: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 6px", flex: "0 0 auto" },
  levelChip: { fontFamily: "'Fredoka', sans-serif", fontSize: 12.5, background: "linear-gradient(180deg,#8A66D6,#6A47B8)", padding: "4px 12px", borderRadius: 999 },
  comboChip: { fontFamily: "'Fredoka', sans-serif", fontSize: 12, color: "#2A1D4E", background: "#FFC857", padding: "4px 10px", borderRadius: 999, transition: "opacity .18s ease, transform .18s ease" },
  boardWrap: { flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 16px", minHeight: 0, position: "relative" },
  levelToast: {
    position: "absolute",
    top: "14%",
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(180deg,#FFD877,#FFC857)",
    color: "#3A2205",
    padding: "10px 20px",
    borderRadius: 16,
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    boxShadow: "0 10px 24px rgba(0,0,0,.35)",
    textAlign: "center",
  },
  tray: { flex: "0 0 auto", display: "flex", justifyContent: "center", gap: 10, padding: "6px 14px 4px" },
  traySlot: { width: 104, height: 88, borderRadius: 16, background: "rgba(0,0,0,0.16)", border: "1px solid rgba(255,255,255,0.10)", touchAction: "none" },
  charms: { flex: "0 0 auto", display: "flex", justifyContent: "center", gap: 10, padding: "6px 14px 8px" },
  charmBtn: { position: "relative", width: 78, padding: "8px 4px 7px", borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "#F4EEFF", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" },
  charmArmed: { outline: "2px solid #FFC857", background: "rgba(255,200,87,0.14)" },
  charmLabel: { fontSize: 10, fontWeight: 800 },
  count: { position: "absolute", top: -6, right: -6, minWidth: 19, height: 19, padding: "0 4px", borderRadius: 999, background: "#FFC857", color: "#2A1D4E", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" },
  countZero: { background: "rgba(255,255,255,0.18)", color: "#B7AAD9" },
  adslot: { flex: "0 0 auto", margin: "0 auto 10px", width: 320, maxWidth: "calc(100% - 24px)", height: 50, borderRadius: 10, border: "1px dashed rgba(255,255,255,0.28)", display: "flex", alignItems: "center", justifyContent: "center", color: "#B7AAD9", fontSize: 11, letterSpacing: 0.4, gap: 6, background: "rgba(255,255,255,0.03)" },
  dot: { width: 6, height: 6, borderRadius: "50%", background: "#B7AAD9" },
  overlay: { position: "absolute", inset: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,4,26,0.62)", backdropFilter: "blur(3px)", padding: 22 },
  card: { width: "100%", maxWidth: 340, background: "linear-gradient(180deg, #362852, #251A44)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 26, padding: "22px 20px 18px", textAlign: "center", boxShadow: "0 18px 40px rgba(10,4,30,0.45)" },
  emojiHero: { fontSize: 44, lineHeight: 1, marginBottom: 6 },
  h2: { fontFamily: "'Fredoka', sans-serif", margin: "2px 0 6px", fontSize: 22, color: "#FFC857" },
  p: { margin: "0 0 14px", fontSize: 13.5, color: "#B7AAD9", lineHeight: 1.5 },
  btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", fontFamily: "'Fredoka', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 9, background: "rgba(255,255,255,0.08)", color: "#F4EEFF" },
  btnPrimary: { background: "linear-gradient(180deg,#FFD877,#FFC857)", color: "#3A2205", boxShadow: "0 8px 18px rgba(255,200,87,.28)", border: "none" },
  btnGhost: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px 16px", borderRadius: 14, cursor: "pointer", fontFamily: "'Fredoka', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 9, background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "#F4EEFF" },
  adBox: { width: "100%", aspectRatio: "4/3", borderRadius: 14, background: "repeating-linear-gradient(135deg, #3a2c5c, #3a2c5c 10px, #33255380 10px, #33255380 20px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14, border: "1px solid rgba(255,255,255,0.10)", color: "#B7AAD9", fontSize: 12 },
  spinner: { width: 26, height: 26, borderRadius: "50%", border: "3px solid rgba(255,255,255,.25)", borderTopColor: "#FFC857" },
};