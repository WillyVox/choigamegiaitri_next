'use client';

import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';

// --- SEO CONFIGURATION ---
const SEO_CONFIG = {
  title: 'Bubble Blast - Game Bắn Bóng Bọt Biển Giải Trí Miễn Phí',
  description: 'Chơi game Bắn Bóng (Bubble Shooter) thư giãn hoàn toàn miễn phí trên trình duyệt web và điện thoại. Đồ họa bắt mắt, lối chơi gây nghiện!',
  keywords: 'bubble blast, ban bong, game giai tri, game html5, game van phong, bubble shooter free',
  canonicalUrl: 'https://choigamegiaitri.com/bubble-blast',
};

// --- GAME CONSTANTS ---
const CANVAS_W = 360;
const CANVAS_H = 580;
const COLS = 8;
const WALL_LEFT = 12;
const WALL_RIGHT = CANVAS_W - 12;
const DIAMETER = (WALL_RIGHT - WALL_LEFT) / COLS;
const RADIUS = DIAMETER / 2 - 1;
const ROW_H = DIAMETER * 0.866; // Standard Hexagonal spacing
const TOP_Y = 40;
const CANNON_Y = CANVAS_H - 50;
const DANGER_Y = CANNON_Y - 80;
const PROJECTILE_SPEED = 12;

const COLORS = [
  { hex: '#FF3366', glow: '#FF80A0', name: 'Coral Red' },
  { hex: '#00E676', glow: '#B9F6CA', name: 'Emerald Green' },
  { hex: '#FFD600', glow: '#FFFF8D', name: 'Cyber Yellow' },
  { hex: '#7C4DFF', glow: '#B388FF', name: 'Electric Purple' },
  { hex: '#00B0FF', glow: '#80D8FF', name: 'Aqua Blue' },
];

export default function BubbleBlastPro() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State UI & Score
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [currentColorIdx, setCurrentColorIdx] = useState(0);
  const [nextColorIdx, setNextColorIdx] = useState(1);

  // References for Mutable Game Loop State
  const gameState = useRef({
    grid: [] as ({ color: number } | null)[][],
    projectile: null as { x: number; y: number; vx: number; vy: number; color: number } | null,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
    floatingTexts: [] as { x: number; y: number; text: string; life: number; color: string }[],
    aimAngle: -Math.PI / 2,
    screenShake: 0,
    canShoot: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem('bb_high_score');
    if (saved) setHighScore(parseInt(saved, 10));
    initGame();
  }, []);

  const initGame = () => {
    const grid: ({ color: number } | null)[][] = [];
    for (let r = 0; r < 5; r++) {
      const row: ({ color: number } | null)[] = [];
      const colsInThisRow = r % 2 === 1 ? COLS - 1 : COLS;
      for (let c = 0; c < colsInThisRow; c++) {
        row.push({ color: Math.floor(Math.random() * COLORS.length) });
      }
      grid.push(row);
    }

    gameState.current.grid = grid;
    gameState.current.canShoot = true;
    gameState.current.projectile = null;
    setScore(0);
    setCombo(0);
    setIsGameOver(false);
    setCurrentColorIdx(Math.floor(Math.random() * COLORS.length));
    setNextColorIdx(Math.floor(Math.random() * COLORS.length));
  };

  const swapBubbles = () => {
    if (!gameState.current.canShoot) return;
    const temp = currentColorIdx;
    setCurrentColorIdx(nextColorIdx);
    setNextColorIdx(temp);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Shake Effect
      ctx.save();
      if (gameState.current.screenShake > 0) {
        const sx = (Math.random() - 0.5) * gameState.current.screenShake;
        const sy = (Math.random() - 0.5) * gameState.current.screenShake;
        ctx.translate(sx, sy);
        gameState.current.screenShake *= 0.9;
      }

      // Draw Grid
      const grid = gameState.current.grid;
      for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        const isOdd = r % 2 === 1;
        const xOffset = isOdd ? RADIUS : 0;
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (cell) {
            const cx = WALL_LEFT + RADIUS + c * DIAMETER + xOffset;
            const cy = TOP_Y + r * ROW_H;
            drawBubble(ctx, cx, cy, cell.color);
          }
        }
      }

      // Draw Aim Line (Raycasting bounce)
      if (gameState.current.canShoot && !isGameOver) {
        drawAimLine(ctx);
      }

      // Draw Projectile
      if (gameState.current.projectile) {
        const p = gameState.current.projectile;
        p.x += p.vx;
        p.y += p.vy;

        // Wall collisions
        if (p.x - RADIUS <= WALL_LEFT || p.x + RADIUS >= WALL_RIGHT) {
          p.vx *= -1;
        }

        drawBubble(ctx, p.x, p.y, p.color);
        checkCollision();
      }

      // Draw Shooter
      drawBubble(ctx, CANVAS_W / 2, CANNON_Y, currentColorIdx);

      // Draw Particles & Floating Text
      updateParticles(ctx);

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [currentColorIdx, isGameOver]);

  const drawBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, colorIdx: number) => {
    const conf = COLORS[colorIdx] || COLORS[0];
    const grad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, RADIUS);
    grad.addColorStop(0, conf.glow);
    grad.addColorStop(1, conf.hex);

    ctx.beginPath();
    ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  const drawAimLine = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;

    let currX = CANVAS_W / 2;
    let currY = CANNON_Y;
    let dirX = Math.cos(gameState.current.aimAngle);
    let dirY = Math.sin(gameState.current.aimAngle);

    ctx.beginPath();
    ctx.moveTo(currX, currY);

    for (let i = 0; i < 2; i++) {
      let nextX = currX + dirX * 300;
      let nextY = currY + dirY * 300;

      if (nextX < WALL_LEFT) {
        const t = (WALL_LEFT - currX) / dirX;
        nextX = WALL_LEFT;
        nextY = currY + dirY * t;
        ctx.lineTo(nextX, nextY);
        dirX *= -1;
      } else if (nextX > WALL_RIGHT) {
        const t = (WALL_RIGHT - currX) / dirX;
        nextX = WALL_RIGHT;
        nextY = currY + dirY * t;
        ctx.lineTo(nextX, nextY);
        dirX *= -1;
      } else {
        ctx.lineTo(nextX, nextY);
        break;
      }
      currX = nextX;
      currY = nextY;
    }
    ctx.stroke();
    ctx.restore();
  };

  const checkCollision = () => {
    const p = gameState.current.projectile;
    if (!p) return;

    if (p.y - RADIUS <= TOP_Y) {
      snapToGrid();
      return;
    }

    const grid = gameState.current.grid;
    for (let r = 0; r < grid.length; r++) {
      const isOdd = r % 2 === 1;
      const xOffset = isOdd ? RADIUS : 0;
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c]) {
          const cx = WALL_LEFT + RADIUS + c * DIAMETER + xOffset;
          const cy = TOP_Y + r * ROW_H;
          if (Math.hypot(p.x - cx, p.y - cy) < DIAMETER - 2) {
            snapToGrid();
            return;
          }
        }
      }
    }
  };

  const snapToGrid = () => {
    const p = gameState.current.projectile;
    if (!p) return;

    let targetR = Math.round((p.y - TOP_Y) / ROW_H);
    targetR = Math.max(0, targetR);
    const isOdd = targetR % 2 === 1;
    const xOffset = isOdd ? RADIUS : 0;
    let targetC = Math.round((p.x - WALL_LEFT - RADIUS - xOffset) / DIAMETER);
    targetC = Math.max(0, Math.min(targetC, isOdd ? COLS - 2 : COLS - 1));

    while (gameState.current.grid.length <= targetR) {
      const rIdx = gameState.current.grid.length;
      gameState.current.grid.push(new Array(rIdx % 2 === 1 ? COLS - 1 : COLS).fill(null));
    }

    gameState.current.grid[targetR][targetC] = { color: p.color };
    gameState.current.projectile = null;

    // Check Matches
    const matches = findMatches(targetR, targetC, p.color);
    if (matches.length >= 3) {
      popBubbles(matches);
    } else {
      setCombo(0);
      gameState.current.canShoot = true;
    }

    // Switch color
    setCurrentColorIdx(nextColorIdx);
    setNextColorIdx(Math.floor(Math.random() * COLORS.length));
  };

  const findMatches = (r: number, c: number, color: number) => {
    const matched: [number, number][] = [];
    const visited = new Set<string>();
    const queue: [number, number][] = [[r, c]];

    while (queue.length > 0) {
      const [currR, currC] = queue.pop()!;
      const key = `${currR},${currC}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (
        gameState.current.grid[currR] &&
        gameState.current.grid[currR][currC] &&
        gameState.current.grid[currR][currC]?.color === color
      ) {
        matched.push([currR, currC]);
        const neighbors = getNeighbors(currR, currC);
        queue.push(...neighbors);
      }
    }
    return matched;
  };

  const getNeighbors = (r: number, c: number): [number, number][] => {
    const isOdd = r % 2 === 1;
    const offsets = isOdd
      ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
      : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];

    return offsets
      .map(([dr, dc]) => [r + dr, c + dc] as [number, number])
      .filter(([nr, nc]) => nr >= 0 && gameState.current.grid[nr] && nc >= 0 && nc < gameState.current.grid[nr].length);
  };

  const popBubbles = (bubbles: [number, number][]) => {
    gameState.current.screenShake = 8;
    const points = bubbles.length * 20 * (combo + 1);
    
    setScore((prev) => {
      const next = prev + points;
      if (next > highScore) {
        setHighScore(next);
        localStorage.setItem('bb_high_score', next.toString());
      }
      return next;
    });

    setCombo((prev) => prev + 1);

    bubbles.forEach(([r, c]) => {
      gameState.current.grid[r][c] = null;
    });

    gameState.current.canShoot = true;
  };

  const updateParticles = (ctx: CanvasRenderingContext2D) => {
    // Basic particle render loop placeholder for extended performance
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const angle = Math.atan2(y - CANNON_Y, x - CANVAS_W / 2);
    if (angle < -0.2 && angle > -Math.PI + 0.2) {
      gameState.current.aimAngle = angle;
    }
  };

  const handlePointerUp = () => {
    if (!gameState.current.canShoot || isGameOver) return;
    gameState.current.canShoot = false;
    
    gameState.current.projectile = {
      x: CANVAS_W / 2,
      y: CANNON_Y,
      vx: Math.cos(gameState.current.aimAngle) * PROJECTILE_SPEED,
      vy: Math.sin(gameState.current.aimAngle) * PROJECTILE_SPEED,
      color: currentColorIdx,
    };
  };

  return (
    <div className="game-container">
      <Head>
        <title>{SEO_CONFIG.title}</title>
        <meta name="description" content={SEO_CONFIG.description} />
        <meta name="keywords" content={SEO_CONFIG.keywords} />
        <link rel="canonical" href={SEO_CONFIG.canonicalUrl} />
      </Head>

      {/* TOP ADVERTISEMENT BANNER */}
      <div className="ad-banner top-ad">
        <span className="ad-label">Quảng cáo</span>
        {/* Slot chứa Google AdSense Responsive */}
      </div>

      {/* GAME HEADER HUD */}
      <header className="hud-header">
        <div className="score-board">
          <div className="stat">
            <span className="label">ĐIỂM</span>
            <span className="value">{score}</span>
          </div>
          <div className="stat">
            <span className="label">CAO NHẤT</span>
            <span className="value">{highScore}</span>
          </div>
        </div>

        <div className="controls-right">
          <button className="swap-btn" onClick={swapBubbles} aria-label="Đổi bóng">
            Đổi Bóng
            <div
              className="bubble-preview"
              style={{ backgroundColor: COLORS[nextColorIdx]?.hex }}
            />
          </button>
        </div>
      </header>

      {/* CANVAS STAGE */}
      <main className="stage-wrapper">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </main>

      {/* BOTTOM ADVERTISEMENT BANNER */}
      <div className="ad-banner bottom-ad">
        <span className="ad-label">Quảng cáo</span>
      </div>

      <style jsx>{`
        .game-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          min-height: 100vh;
          background: #0d0f1d;
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
          user-select: none;
          touch-action: manipulation;
        }

        .hud-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          max-width: 360px;
          padding: 8px 12px;
        }

        .score-board {
          display: flex;
          gap: 16px;
        }

        .stat {
          display: flex;
          flex-direction: column;
        }

        .stat .label {
          font-size: 0.65rem;
          color: #8f93b5;
          font-weight: bold;
        }

        .stat .value {
          font-size: 1.2rem;
          color: #ffcc00;
          font-weight: 800;
        }

        .swap-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #1e223d;
          border: 1px solid #3d446e;
          color: #fff;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .bubble-preview {
          width: 14px;
          height: 14px;
          border-radius: 50%;
        }

        .stage-wrapper {
          position: relative;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border-radius: 12px;
          overflow: hidden;
        }

        canvas {
          display: block;
          background: #14182e;
          touch-action: none;
        }

        .ad-banner {
          width: 100%;
          max-width: 360px;
          height: 60px;
          background: #181c33;
          border: 1px dashed #3a4168;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin: 4px 0;
        }

        .ad-label {
          position: absolute;
          top: 2px;
          right: 4px;
          font-size: 0.55rem;
          color: #5d6594;
        }
      `}</style>
    </div>
  );
}