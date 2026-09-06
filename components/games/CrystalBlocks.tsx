'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';

type Cell2 = [number, number];
interface Piece { type: number; rot: number; x: number; y: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }
interface Floater { x: number; y: number; text: string; life: number; color: string; }

const PIECE_COLORS = [
  { hex: '#4fd1c5', glow: '#c7f5f0' }, // I - aquamarine
  { hex: '#ffd166', glow: '#fff0c2' }, // O - citrine
  { hex: '#a78bfa', glow: '#e5daff' }, // T - amethyst
  { hex: '#34d399', glow: '#c8f7e3' }, // S - emerald
  { hex: '#f87171', glow: '#ffd6d6' }, // Z - ruby
  { hex: '#60a5fa', glow: '#cfe4ff' }, // J - sapphire
  { hex: '#fb923c', glow: '#ffdcb8' }, // L - citrine-orange
];

// Each entry is [type][rotation] -> four [x, y] cell offsets within a 4x4 box.
const SHAPES: Cell2[][][] = [
  [ // I
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  [ // O
    [[1, 1], [2, 1], [1, 2], [2, 2]],
    [[1, 1], [2, 1], [1, 2], [2, 2]],
    [[1, 1], [2, 1], [1, 2], [2, 2]],
    [[1, 1], [2, 1], [1, 2], [2, 2]],
  ],
  [ // T
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  [ // S
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  [ // Z
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  [ // J
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  [ // L
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
];

const KICKS: Cell2[] = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];

const STORAGE_KEY = 'crystal-blocks:best-score';
const COLS = 10, ROWS = 20;
const CELL = 22;
const BOARD_LEFT = 10, BOARD_TOP = 10;
const CANVAS_W = COLS * CELL + BOARD_LEFT * 2;
const CANVAS_H = ROWS * CELL + BOARD_TOP * 2;
const LOCK_DELAY = 500;
const LINES_PER_LEVEL = 10;

function dropIntervalFor(level: number) {
  return Math.max(90, 1000 - (level - 1) * 75);
}

function makeBag(): number[] {
  const bag = [0, 1, 2, 3, 4, 5, 6];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function getCells(piece: Piece): Cell2[] {
  return SHAPES[piece.type][piece.rot].map(([dx, dy]) => [piece.x + dx, piece.y + dy] as Cell2);
}

function MiniPiece({ type }: { type: number | null }) {
  if (type === null) return <div className="mini-piece mini-piece--empty" />;
  const cells = new Set(SHAPES[type][0].map(([x, y]) => `${x},${y}`));
  const color = PIECE_COLORS[type].hex;
  return (
    <div className="mini-piece">
      {Array.from({ length: 16 }, (_, i) => {
        const x = i % 4, y = Math.floor(i / 4);
        const filled = cells.has(`${x},${y}`);
        return <span key={i} className="mini-piece__cell" style={{ background: filled ? color : 'transparent' }} />;
      })}
    </div>
  );
}

export default function CrystalBlocks() {
  const t = useTranslations('crystalBlocks');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [level, setLevel] = useState(1);
  const [nextType, setNextType] = useState(0);
  const [holdType, setHoldType] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [shareLabel, setShareLabel] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setBest(parseInt(saved, 10) || 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * DPR;
    canvas.height = CANVAS_H * DPR;
    ctx.scale(DPR, DPR);

    let board: (number | null)[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    let bag: number[] = [];
    let piece: Piece;
    let heldType: number | null = null;
    let canHold = true;
    let runScore = 0;
    let localBest = best;
    let runLevel = 1;
    let linesCleared = 0;
    let dropTimer = 0;
    let lockTimer = 0;
    let locking = false;
    let softDropping = false;
    let over = false;
    let lastTime = 0;
    let particles: Particle[] = [];
    let floaters: Floater[] = [];
    let clearFlashRows: number[] = [];
    let clearFlashTimer = 0;

    function nextFromBag(): number {
      if (bag.length === 0) bag = makeBag();
      return bag.shift()!;
    }

    function nextFromBagPeek(): number {
      if (bag.length === 0) bag = makeBag();
      return bag[0];
    }

    function spawnPiece() {
      const type = nextFromBag();
      piece = { type, rot: 0, x: 3, y: type === 0 ? -1 : -2 };
      canHold = true;
      locking = false;
      lockTimer = 0;
      setNextType(nextFromBagPeek());
      if (collides(piece, 0, 0)) triggerGameOver();
    }

    function collides(p: Piece, dx: number, dy: number, rot?: number) {
      const test: Piece = { ...p, rot: rot ?? p.rot, x: p.x + dx, y: p.y + dy };
      for (const [bx, by] of getCells(test)) {
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx] !== null) return true;
      }
      return false;
    }

    function addScore(n: number) {
      runScore += n;
      setScore(runScore);
    }

    function spawnParticles(x: number, y: number, color: string) {
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({ x, y, vx: Math.cos(angle) * (1 + Math.random() * 2.5), vy: Math.sin(angle) * (1 + Math.random() * 2.5) - 1, life: 1, color });
      }
    }

    function spawnFloater(text: string, color: string) {
      floaters.push({ x: CANVAS_W / 2, y: CANVAS_H / 2 - 30, text, life: 1, color });
    }

    function clearLines() {
      const fullRows: number[] = [];
      for (let r = 0; r < ROWS; r++) if (board[r].every((c) => c !== null)) fullRows.push(r);
      if (fullRows.length === 0) return;

      for (const r of fullRows) {
        for (let c = 0; c < COLS; c++) {
          const color = board[r][c];
          if (color !== null) spawnParticles(BOARD_LEFT + c * CELL + CELL / 2, BOARD_TOP + r * CELL + CELL / 2, PIECE_COLORS[color].hex);
        }
      }
      clearFlashRows = fullRows;
      clearFlashTimer = 140;

      const remaining = board.filter((_, r) => !fullRows.includes(r));
      const empty = Array.from({ length: fullRows.length }, () => new Array(COLS).fill(null));
      board = [...empty, ...remaining];

      const n = fullRows.length;
      const base = [0, 100, 300, 500, 800][n] ?? 800;
      const gained = base * runLevel;
      addScore(gained);
      const labels = ['', t('single'), t('double'), t('triple'), t('quad')];
      spawnFloater(`${labels[n] ?? labels[4]} +${gained}`, n >= 4 ? '#ffd166' : '#c7f5f0');

      linesCleared += n;
      const newLevel = Math.floor(linesCleared / LINES_PER_LEVEL) + 1;
      if (newLevel !== runLevel) {
        runLevel = newLevel;
        setLevel(runLevel);
      }
    }

    function lockPiece() {
      const cells = getCells(piece);
      if (cells.some(([, by]) => by < 0)) { triggerGameOver(); return; }
      for (const [bx, by] of cells) board[by][bx] = piece.type;
      for (const [bx, by] of cells) spawnParticles(BOARD_LEFT + bx * CELL + CELL / 2, BOARD_TOP + by * CELL + CELL / 2, PIECE_COLORS[piece.type].hex);
      clearLines();
      spawnPiece();
    }

    function move(dx: number) {
      if (over || collides(piece, dx, 0)) return;
      piece.x += dx;
      if (locking) lockTimer = 0;
    }

    function rotatePiece(dir: 1 | -1) {
      if (over) return;
      const newRot = (piece.rot + dir + 4) % 4;
      for (const [kx, ky] of KICKS) {
        if (!collides(piece, kx, ky, newRot)) {
          piece.x += kx;
          piece.y += ky;
          piece.rot = newRot;
          if (locking) lockTimer = 0;
          return;
        }
      }
    }

    function softDrop() {
      if (over) return;
      if (!collides(piece, 0, 1)) {
        piece.y += 1;
        addScore(1);
        dropTimer = 0;
      }
    }

    function hardDrop() {
      if (over) return;
      let dist = 0;
      while (!collides(piece, 0, 1)) { piece.y += 1; dist++; }
      addScore(dist * 2);
      lockPiece();
    }

    function holdPiece() {
      if (over || !canHold) return;
      canHold = false;
      const cur = piece.type;
      if (heldType === null) {
        heldType = cur;
        spawnPiece();
      } else {
        const swap = heldType;
        heldType = cur;
        piece = { type: swap, rot: 0, x: 3, y: swap === 0 ? -1 : -2 };
        locking = false;
        lockTimer = 0;
        if (collides(piece, 0, 0)) { triggerGameOver(); return; }
      }
      setHoldType(heldType);
    }

    function ghostY() {
      let gy = piece.y;
      while (!collides(piece, 0, gy - piece.y + 1)) gy++;
      return gy;
    }

    function triggerGameOver() {
      if (over) return;
      over = true;
      setFinalScore(runScore);
      let newBest = false;
      if (runScore > localBest) {
        localBest = runScore;
        setBest(localBest);
        newBest = true;
        try { window.localStorage.setItem(STORAGE_KEY, String(localBest)); } catch { /* ignore */ }
      }
      setIsNewBest(newBest);
      setGameOver(true);
    }

    bag = makeBag();
    board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    spawnPiece();

    const onKeyDown = (e: KeyboardEvent) => {
      if (over) return;
      if (e.code === 'ArrowLeft') { e.preventDefault(); move(-1); }
      if (e.code === 'ArrowRight') { e.preventDefault(); move(1); }
      if (e.code === 'ArrowDown') { e.preventDefault(); softDrop(); }
      if (e.code === 'ArrowUp') { e.preventDefault(); rotatePiece(1); }
      if (e.code === 'KeyZ') { e.preventDefault(); rotatePiece(-1); }
      if (e.code === 'Space') { e.preventDefault(); hardDrop(); }
      if (e.code === 'KeyC' || e.code === 'ShiftLeft') { e.preventDefault(); holdPiece(); }
    };
    window.addEventListener('keydown', onKeyDown);

    function drawCell(px: number, py: number, colorIdx: number, alpha = 1) {
      const c = PIECE_COLORS[colorIdx];
      ctx!.save();
      ctx!.globalAlpha = alpha;
      const g = ctx!.createLinearGradient(px, py, px + CELL, py + CELL);
      g.addColorStop(0, c.glow);
      g.addColorStop(1, c.hex);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.roundRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3, 5);
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx!.lineWidth = 1;
      ctx!.stroke();
      ctx!.restore();
    }

    function drawGhost(px: number, py: number) {
      ctx!.save();
      ctx!.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx!.setLineDash([3, 3]);
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.roundRect(px + 2, py + 2, CELL - 4, CELL - 4, 5);
      ctx!.stroke();
      ctx!.restore();
    }

    function render() {
      const bg = ctx!.createLinearGradient(0, 0, 0, CANVAS_H);
      bg.addColorStop(0, '#20264a');
      bg.addColorStop(1, '#12142c');
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx!.save();
      ctx!.fillStyle = 'rgba(255,255,255,0.04)';
      ctx!.beginPath();
      ctx!.roundRect(BOARD_LEFT - 4, BOARD_TOP - 4, COLS * CELL + 8, ROWS * CELL + 8, 10);
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx!.lineWidth = 1.5;
      ctx!.stroke();
      ctx!.restore();

      ctx!.save();
      ctx!.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx!.lineWidth = 1;
      for (let c = 1; c < COLS; c++) {
        ctx!.beginPath();
        ctx!.moveTo(BOARD_LEFT + c * CELL, BOARD_TOP);
        ctx!.lineTo(BOARD_LEFT + c * CELL, BOARD_TOP + ROWS * CELL);
        ctx!.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        ctx!.beginPath();
        ctx!.moveTo(BOARD_LEFT, BOARD_TOP + r * CELL);
        ctx!.lineTo(BOARD_LEFT + COLS * CELL, BOARD_TOP + r * CELL);
        ctx!.stroke();
      }
      ctx!.restore();

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const color = board[r][c];
          if (color !== null) {
            const flashing = clearFlashTimer > 0 && clearFlashRows.includes(r);
            drawCell(BOARD_LEFT + c * CELL, BOARD_TOP + r * CELL, color, flashing ? 0.4 : 1);
          }
        }
      }

      if (!over) {
        const gy = ghostY();
        for (const [dx, dy] of SHAPES[piece.type][piece.rot]) {
          const bx = piece.x + dx, by = gy + dy;
          if (by >= 0) drawGhost(BOARD_LEFT + bx * CELL, BOARD_TOP + by * CELL);
        }
        for (const [bx, by] of getCells(piece)) {
          if (by >= 0) drawCell(BOARD_LEFT + bx * CELL, BOARD_TOP + by * CELL, piece.type);
        }
      }

      for (const p of particles) {
        ctx!.save();
        ctx!.globalAlpha = Math.max(p.life, 0);
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }
      for (const f of floaters) {
        ctx!.save();
        ctx!.globalAlpha = Math.max(f.life, 0);
        ctx!.fillStyle = f.color;
        ctx!.font = "700 16px sans-serif";
        ctx!.textAlign = 'center';
        ctx!.fillText(f.text, f.x, f.y);
        ctx!.restore();
      }
    }

    function loop(time: number) {
      const dt = lastTime ? time - lastTime : 16;
      lastTime = time;

      if (!over) {
        dropTimer += dt;
        const interval = softDropping ? Math.min(60, dropIntervalFor(runLevel)) : dropIntervalFor(runLevel);
        if (dropTimer >= interval) {
          dropTimer = 0;
          if (!collides(piece, 0, 1)) {
            piece.y += 1;
            locking = false;
            lockTimer = 0;
          } else {
            locking = true;
          }
        }
        if (locking) {
          lockTimer += dt;
          if (collides(piece, 0, 1) === false) { locking = false; lockTimer = 0; }
          else if (lockTimer >= LOCK_DELAY) lockPiece();
        }

        if (clearFlashTimer > 0) clearFlashTimer -= dt;
        particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.035; });
        particles = particles.filter((p) => p.life > 0);
        floaters.forEach((f) => { f.y -= 0.5; f.life -= 0.018; });
        floaters = floaters.filter((f) => f.life > 0);
      }

      render();
      rafRef.current = requestAnimationFrame(loop);
    }

    (canvas as any).__actions = {
      left: () => move(-1),
      right: () => move(1),
      rotate: () => rotatePiece(1),
      softStart: () => { softDropping = true; },
      softEnd: () => { softDropping = false; },
      hardDrop: () => hardDrop(),
      hold: () => holdPiece(),
    };

    (canvas as any).__restart = () => {
      board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
      bag = makeBag();
      heldType = null;
      setHoldType(null);
      runScore = 0; setScore(0);
      runLevel = 1; setLevel(1);
      linesCleared = 0;
      dropTimer = 0; lockTimer = 0; locking = false; softDropping = false;
      particles = []; floaters = [];
      over = false;
      spawnPiece();
      setGameOver(false);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function callAction(name: string) {
    const actions = (canvasRef.current as any)?.__actions;
    actions?.[name]?.();
  }

  function pressAndHold(name: string) {
    return {
      onPointerDown: (e: PointerEvent) => {
        e.preventDefault();
        callAction(name);
        const id = window.setInterval(() => callAction(name), 90);
        (e.currentTarget as any).__holdId = id;
      },
      onPointerUp: (e: PointerEvent) => {
        clearInterval((e.currentTarget as any).__holdId);
      },
      onPointerLeave: (e: PointerEvent) => {
        clearInterval((e.currentTarget as any).__holdId);
      },
    };
  }

  async function shareScore() {
    const message = `I scored ${finalScore} in Crystal Blocks \u2728 my best is ${best}. Can you clear more lines?`;
    try {
      await navigator.clipboard.writeText(message);
      setShareLabel(t('shareCopied'));
    } catch {
      setShareLabel(message);
    }
    setTimeout(() => setShareLabel(''), 2200);
  }

  return (
    <div className="crystal-blocks">
      <div className="hud">
        <div className="stat"><span className="stat__value">{score}</span><span className="stat__label">{t('score')}</span></div>
        <div className="stat"><span className="stat__value">{best}</span><span className="stat__label">{t('best')}</span></div>
        <div className="stat"><span className="stat__value">{level}</span><span className="stat__label">{t('level')}</span></div>
      </div>

      <div className="play-area">
        <div className="stage">
          <canvas ref={canvasRef} tabIndex={0} aria-label="Crystal Blocks game board" />
        </div>
      </div>

      <div className="touch-controls">
        <button className="ctrl-btn" type="button" {...pressAndHold('left')} aria-label="left">◀</button>
        <button className="ctrl-btn" type="button" onClick={() => callAction('hold')} aria-label="hold">⇄</button>
        <button className="ctrl-btn" type="button" onClick={() => callAction('rotate')} aria-label="rotate">⟳</button>
        <button className="ctrl-btn" type="button" {...pressAndHold('right')} aria-label="right">▶</button>
        <button
          className="ctrl-btn ctrl-btn--wide"
          type="button"
          onPointerDown={() => callAction('softStart')}
          onPointerUp={() => callAction('softEnd')}
          onPointerLeave={() => callAction('softEnd')}
          aria-label="soft drop"
        >▼</button>
        <button className="ctrl-btn ctrl-btn--wide" type="button" onClick={() => callAction('hardDrop')} aria-label="hard drop">⤓</button>
      </div>

      <p className="hint">{t('hint')}</p>

      {gameOver && (
        <div className="game-over">
          <div className="game-over__panel">
            <p className="game-over__eyebrow">{t('gameOverEyebrow')}</p>
            <h3>{finalScore}</h3>
            {isNewBest && <p className="best-note">{t('newBest')}</p>}
            <div className="ad-slot ad-slot--gameover">{t('adGameOver')}</div>
            <button
              className="continue-btn"
              type="button"
              onClick={() => (canvasRef.current as any)?.__restart?.()}
            >
              {t('playAgain')}
            </button>
            <button className="share-btn" type="button" onClick={shareScore}>
              {shareLabel || t('shareScore')}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .crystal-blocks {
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          font-family: var(--font-nunito), sans-serif;
        }
        .stat__value, .side-panel__label, .game-over__panel h3, .continue-btn, .game-over__eyebrow {
          font-family: var(--font-baloo), sans-serif;
        }
        
        .hud {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .stat {
          background: rgba(255, 255, 255, 0.06);
          border: 2px solid #454b7d;
          border-radius: 14px;
          padding: 5px 12px;
          text-align: center;
        }
        .stat__value { display: block; font-weight: 700; color: #ffd166; }
        .stat__label { display: block; font-size: 0.65rem; color: #9aa3c9; }
        .play-area {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 8px;
        }
        .side-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding-top: 4px;
        }
        .side-panel__label { font-size: 0.65rem; color: #9aa3c9; }
        .mini-piece {
          width: 52px;
          height: 52px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: repeat(4, 1fr);
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid #454b7d;
          border-radius: 10px;
          padding: 3px;
          gap: 1px;
        }
        .mini-piece--empty { background: rgba(255, 255, 255, 0.03); }
        .mini-piece__cell { border-radius: 2px; }
        .stage {
          display: flex;
          justify-content: center;
          background: #12142c;
          border-radius: 16px;
          padding: 4px;
        }
        canvas { width: 100%; max-width: 240px; height: auto; border-radius: 12px; touch-action: none; display: block; }
        .touch-controls {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          max-width: 320px;
          margin: 14px auto 0;
        }
        .ctrl-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 2px solid #454b7d;
          color: #8d86ab;
          border-radius: 12px;
          padding: 12px 0;
          font-size: 1.1rem;
          cursor: pointer;
          user-select: none;
          touch-action: manipulation;
        }
        .ctrl-btn--wide { grid-column: span 2; }
        .hint { text-align: center; color: #9aa3c9; font-size: 0.85rem; margin-top: 10px; }
        .game-over {
          position: fixed; inset: 0;
          background: rgba(18, 20, 44, 0.75);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          z-index: 50;
        }
        .game-over__panel {
          background: #1c2048;
          border-radius: 22px;
          padding: 26px;
          max-width: 320px;
          width: 100%;
          text-align: center;
          border: 3px solid #454b7d;
        }
        .game-over__eyebrow { margin: 0 0 6px; font-size: 0.85rem; color: #9aa3c9; }
        .game-over__panel h3 { margin: 0 0 4px; font-size: 1.6rem; color: #ffd166; }
        .best-note { color: #34d399; font-weight: 700; margin: 2px 0 10px; }
        .continue-btn {
          margin-top: 4px;
          background: #a78bfa;
          border: 3px solid #171233;
          color: #171233;
          padding: 12px 24px;
          border-radius: 999px;
          font-weight: 700;
          width: 100%;
          cursor: pointer;
        }
        .share-btn {
          margin-top: 10px;
          background: transparent;
          border: 2px solid #454b7d;
          color: #d9d5ff;
          padding: 9px 18px;
          border-radius: 999px;
          width: 100%;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
