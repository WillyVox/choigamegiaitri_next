'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Tier { emoji: string; color: string; r: number; score: number; }
interface Ball { x: number; y: number; vx: number; vy: number; r: number; tier: number; bornAt: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }
interface Floater { x: number; y: number; text: string; life: number; }

const TIERS: Tier[] = [
  { emoji: '🍒', color: '#d64550', r: 14, score: 1 },
  { emoji: '🍓', color: '#ef5f77', r: 19, score: 3 },
  { emoji: '🍇', color: '#8e5fb0', r: 24, score: 6 },
  { emoji: '🍊', color: '#f2994a', r: 30, score: 10 },
  { emoji: '🍎', color: '#e8483a', r: 36, score: 15 },
  { emoji: '🍐', color: '#a9c94a', r: 43, score: 21 },
  { emoji: '🍑', color: '#f6ae6b', r: 50, score: 28 },
  { emoji: '🍍', color: '#f4d35e', r: 58, score: 36 },
  { emoji: '🍉', color: '#3f9142', r: 67, score: 45 }
];
const SPAWN_WEIGHTS = [0.35, 0.28, 0.18, 0.12, 0.07];

const STORAGE_KEY = 'merge-meadow:best-score';
const CANVAS_W = 320, CANVAS_H = 480;
const WALL_LEFT = 18, WALL_RIGHT = CANVAS_W - 18;
const FLOOR_Y = CANVAS_H - 16;
const CONTAINER_TOP = 70;
const SPAWN_Y = CONTAINER_TOP + 14;
const DANGER_Y = CONTAINER_TOP + 56;
const GRAVITY = 0.55;

function randomTier() {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < SPAWN_WEIGHTS.length; i++) {
    acc += SPAWN_WEIGHTS[i];
    if (r <= acc) return i;
  }
  return 0;
}

export default function MergeMeadow() {
  const t = useTranslations('mergeMeadow');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [nextTierUi, setNextTierUi] = useState(0);
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

    let balls: Ball[] = [];
    let particles: Particle[] = [];
    let floaters: Floater[] = [];
    let runScore = 0;
    let localBest = best;
    let aimX = CANVAS_W / 2;
    let currentTier = randomTier();
    let nextTier = randomTier();
    let canDrop = true;
    let dangerTimer = 0;
    let over = false;

    setNextTierUi(nextTier);

    function addScore(n: number) {
      runScore += n;
      setScore(runScore);
    }

    function spawnParticles(x: number, y: number, color: string) {
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 * i) / 10;
        particles.push({ x, y, vx: Math.cos(angle) * (1 + Math.random() * 2), vy: Math.sin(angle) * (1 + Math.random() * 2), life: 1, color });
      }
    }

    function spawnFloater(x: number, y: number, text: string) {
      floaters.push({ x, y, text, life: 1 });
    }

    function resolvePair(a: Ball, b: Ball) {
      const dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      const minDist = a.r + b.r;
      if (dist === 0) dist = 0.01;
      if (dist < minDist) {
        const nx = dx / dist, ny = dy / dist;
        const overlap = minDist - dist;
        const ma = a.r * a.r, mb = b.r * b.r, total = ma + mb;
        a.x -= nx * overlap * (mb / total);
        a.y -= ny * overlap * (mb / total);
        b.x += nx * overlap * (ma / total);
        b.y += ny * overlap * (ma / total);
        a.vx *= 0.98; a.vy *= 0.98; b.vx *= 0.98; b.vy *= 0.98;
        return true;
      }
      return false;
    }

    function mergeBalls(i: number, j: number) {
      const a = balls[i], b = balls[j];
      const tier = a.tier;
      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
      const hi = Math.max(i, j), lo = Math.min(i, j);
      balls.splice(hi, 1);
      balls.splice(lo, 1);
      spawnParticles(midX, midY, TIERS[tier].color);
      if (tier < TIERS.length - 1) {
        addScore(TIERS[tier].score);
        balls.push({ x: midX, y: midY, vx: 0, vy: -1.5, r: TIERS[tier + 1].r, tier: tier + 1, bornAt: performance.now() });
      } else {
        addScore(80);
        spawnFloater(midX, midY, `+80 ${t('colossalFusion')}`);
      }
    }

    function updateAim(x: number) {
      const r = TIERS[currentTier].r;
      aimX = Math.max(WALL_LEFT + r, Math.min(WALL_RIGHT - r, x));
    }

    function tryDrop() {
      if (!canDrop || over) return;
      balls.push({ x: aimX, y: SPAWN_Y, vx: 0, vy: 0, r: TIERS[currentTier].r, tier: currentTier, bornAt: performance.now() });
      canDrop = false;
      setTimeout(() => { canDrop = true; }, 380);
      currentTier = nextTier;
      nextTier = randomTier();
      setNextTierUi(nextTier);
    }

    function getLogicalX(clientX: number) {
      const rect = canvas!.getBoundingClientRect();
      const scale = CANVAS_W / rect.width;
      return (clientX - rect.left) * scale;
    }

    const onMouseMove = (e: MouseEvent) => updateAim(getLogicalX(e.clientX));
    const onClick = () => tryDrop();
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); if (e.touches[0]) updateAim(getLogicalX(e.touches[0].clientX)); };
    const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); tryDrop(); };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); tryDrop(); }
      if (e.code === 'ArrowLeft') updateAim(aimX - 12);
      if (e.code === 'ArrowRight') updateAim(aimX + 12);
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    async function triggerGameOver() {
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

    function updateDangerTimer() {
      let anyDanger = false;
      for (const b of balls) {
        const speed = Math.hypot(b.vx, b.vy);
        if (speed < 0.6 && b.y - b.r < DANGER_Y) { anyDanger = true; break; }
      }
      dangerTimer = anyDanger ? dangerTimer + 16 : 0;
      if (dangerTimer > 1200 && !over) triggerGameOver();
    }

    function drawJar() {
      ctx!.save();
      ctx!.strokeStyle = '#9c6b43';
      ctx!.lineWidth = 6;
      ctx!.beginPath();
      ctx!.moveTo(WALL_LEFT, CONTAINER_TOP - 10);
      ctx!.lineTo(WALL_LEFT, FLOOR_Y);
      ctx!.quadraticCurveTo(WALL_LEFT, FLOOR_Y + 10, WALL_LEFT + 14, FLOOR_Y + 10);
      ctx!.lineTo(WALL_RIGHT - 14, FLOOR_Y + 10);
      ctx!.quadraticCurveTo(WALL_RIGHT, FLOOR_Y + 10, WALL_RIGHT, FLOOR_Y);
      ctx!.lineTo(WALL_RIGHT, CONTAINER_TOP - 10);
      ctx!.stroke();
      ctx!.restore();

      ctx!.save();
      ctx!.strokeStyle = 'rgba(232,93,93,0.55)';
      ctx!.setLineDash([6, 6]);
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(WALL_LEFT + 6, DANGER_Y);
      ctx!.lineTo(WALL_RIGHT - 6, DANGER_Y);
      ctx!.stroke();
      ctx!.restore();
    }

    function drawFruit(x: number, y: number, tier: Tier, alpha = 1, scale = 1) {
      ctx!.save();
      ctx!.globalAlpha = alpha;
      const r = tier.r * scale;
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fillStyle = tier.color;
      ctx!.fill();
      ctx!.lineWidth = 2;
      ctx!.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx!.stroke();
      ctx!.font = `${r * 1.15}px sans-serif`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(tier.emoji, x, y + r * 0.05);
      ctx!.restore();
    }

    function drawAimer() {
      if (over) return;
      ctx!.save();
      ctx!.strokeStyle = 'rgba(43,32,19,0.25)';
      ctx!.setLineDash([4, 6]);
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(aimX, SPAWN_Y - 40);
      ctx!.lineTo(aimX, CONTAINER_TOP - 6);
      ctx!.stroke();
      ctx!.restore();
      drawFruit(aimX, SPAWN_Y - 40, TIERS[currentTier], canDrop ? 1 : 0.45);
    }

    function render() {
      ctx!.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawJar();
      for (const b of balls) {
        const age = performance.now() - b.bornAt;
        const scale = age < 150 ? 0.6 + 0.4 * (age / 150) : 1;
        drawFruit(b.x, b.y, TIERS[b.tier], 1, scale);
      }
      for (const p of particles) {
        ctx!.save();
        ctx!.globalAlpha = Math.max(p.life, 0);
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }
      for (const f of floaters) {
        ctx!.save();
        ctx!.globalAlpha = Math.max(f.life, 0);
        ctx!.fillStyle = '#2b2013';
        ctx!.font = "700 14px sans-serif";
        ctx!.textAlign = 'center';
        ctx!.fillText(f.text, f.x, f.y);
        ctx!.restore();
      }
      drawAimer();
    }

    function loop() {
      if (!over) {
        for (const b of balls) {
          b.vy += GRAVITY;
          b.x += b.vx;
          b.y += b.vy;
          if (b.x - b.r < WALL_LEFT) { b.x = WALL_LEFT + b.r; b.vx *= -0.3; }
          if (b.x + b.r > WALL_RIGHT) { b.x = WALL_RIGHT - b.r; b.vx *= -0.3; }
          if (b.y + b.r > FLOOR_Y) { b.y = FLOOR_Y - b.r; b.vy *= -0.2; b.vx *= 0.9; }
        }

        let mergedPair: [number, number] | null = null;
        for (let iter = 0; iter < 3 && !mergedPair; iter++) {
          for (let i = 0; i < balls.length && !mergedPair; i++) {
            for (let j = i + 1; j < balls.length; j++) {
              const a = balls[i], bBall = balls[j];
              const overlapping = resolvePair(a, bBall);
              if (overlapping && iter === 0 && a.tier === bBall.tier) { mergedPair = [i, j]; break; }
            }
          }
        }
        if (mergedPair) mergeBalls(mergedPair[0], mergedPair[1]);

        particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.04; });
        particles = particles.filter((p) => p.life > 0);
        floaters.forEach((f) => { f.y -= 0.6; f.life -= 0.015; });
        floaters = floaters.filter((f) => f.life > 0);

        updateDangerTimer();
      }
      render();
      if (!over) rafRef.current = requestAnimationFrame(loop);
    }

    (canvas as any).__restart = () => {
      balls = []; particles = []; floaters = [];
      runScore = 0; setScore(0);
      dangerTimer = 0; over = false;
      currentTier = randomTier(); nextTier = randomTier();
      setNextTierUi(nextTier);
      setGameOver(false);
      rafRef.current = requestAnimationFrame(loop);
    };

    render();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function shareScore() {
    const message = `I scored ${finalScore} in Merge Meadow 🍉 my best is ${best}. Can you grow a bigger fruit?`;
    try {
      await navigator.clipboard.writeText(message);
      setShareLabel(t('shareCopied'));
    } catch {
      setShareLabel(message);
    }
    setTimeout(() => setShareLabel(''), 2200);
  }

  return (
    <div className="merge-meadow">
      <div className="hud">
        <div className="stat"><span className="stat__value">{score}</span><span className="stat__label">{t('score')}</span></div>
        <div className="stat"><span className="stat__value">{best}</span><span className="stat__label">{t('best')}</span></div>
        <div className="next-badge">
          <span className="next-badge__label">{t('next')}</span>
          <span className="next-badge__emoji">{TIERS[nextTierUi].emoji}</span>
        </div>
      </div>

      <div className="stage">
        <canvas ref={canvasRef} tabIndex={0} aria-label="Merge Meadow game board" />
      </div>

      <p className="hint">{t('hint')}</p>

      {gameOver && (
        <div className="game-over">
          <div className="game-over__panel">
            <p className="game-over__eyebrow">{t('gameOverEyebrow')}</p>
            <h3>{finalScore}</h3>
            {isNewBest && <p className="best-note">{t('newBest')}</p>}
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
        .merge-meadow {
          width: 100%;
          max-width: 360px;
          margin: 0 auto;
          font-family: var(--font-nunito), sans-serif;
        }
        .stat__value, .next-badge__emoji, .game-over__panel h3, .continue-btn, .game-over__eyebrow {
          font-family: var(--font-baloo), sans-serif;
        }
        .hud {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .stat, .next-badge {
          background: rgba(0, 0, 0, 0.05);
          border: 2px solid #9c6b43;
          border-radius: 14px;
          padding: 5px 12px;
          text-align: center;
        }
        .stat__value { display: block; font-weight: 700; color: #74492b; }
        .stat__label { display: block; font-size: 0.65rem; color: #6b5a45; }
        .next-badge { display: flex; align-items: center; gap: 6px; }
        .next-badge__label { font-size: 0.65rem; color: #6b5a45; }
        .next-badge__emoji { font-size: 1.2rem; }
        .stage { display: flex; justify-content: center; }
        canvas { width: 100%; max-width: 320px; height: auto; border-radius: 18px; touch-action: none; }
        .hint { text-align: center; color: #6b5a45; font-size: 0.85rem; margin-top: 10px; }
        .game-over {
          position: fixed; inset: 0;
          background: rgba(43, 32, 19, 0.55);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          z-index: 50;
        }
        .game-over__panel {
          background: #fffaf1;
          border-radius: 22px;
          padding: 26px;
          max-width: 320px;
          width: 100%;
          text-align: center;
          border: 3px solid #9c6b43;
        }
        .game-over__eyebrow { margin: 0 0 6px; font-size: 0.85rem; color: #6b5a45; }
        .game-over__panel h3 { margin: 0 0 4px; font-size: 1.6rem; color: #74492b; }
        .best-note { color: #2f6f33; font-weight: 700; margin: 2px 0 10px; }
        .continue-btn {
          margin-top: 14px;
          background: #ffc93c;
          border: 3px solid #2b2013;
          color: #2b2013;
          padding: 12px 24px;
          border-radius: 999px;
          font-weight: 700;
          width: 100%;
          cursor: pointer;
        }
        .share-btn {
          margin-top: 10px;
          background: transparent;
          border: 2px solid #9c6b43;
          color: #74492b;
          padding: 9px 18px;
          border-radius: 999px;
          width: 100%;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
