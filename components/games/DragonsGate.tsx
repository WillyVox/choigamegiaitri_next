'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'dragons-gate:best';

const GRAVITY = 1500;
const FLAP_VELOCITY = -420;
const GATE_GAP = 190;
const GATE_WIDTH = 68;
const GATE_SPACING = 260;
const SCROLL_SPEED = 170;

interface Dragon { x: number; y: number; vy: number; r: number; rot: number; flapAnim: number; }
interface Gate { x: number; centerY: number; passed: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; r: number; }
interface Cloud { x: number; y: number; r: number; speed: number; }

export default function DragonsGate() {
  const t = useTranslations('dragonsGate');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const [started, setStarted] = useState(false);
  const [showOver, setShowOver] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  // Load best score once on mount (client-only, so guarded inside useEffect).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setBest(parseInt(saved, 10) || 0);
    } catch {
      /* localStorage unavailable — best score just won't persist this session */
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, DPR = 1;
    function resize() {
      DPR = window.devicePixelRatio || 1;
      W = wrap!.clientWidth;
      H = wrap!.clientHeight;
      canvas!.width = W * DPR;
      canvas!.height = H * DPR;
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    window.addEventListener('resize', resize);
    resize();

    let dragon: Dragon = { x: 0, y: 0, vy: 0, r: 16, rot: 0, flapAnim: 0 };
    let gates: Gate[] = [];
    let particles: Particle[] = [];
    let clouds: Cloud[] = [];
    let runScore = 0;
    let running = false;
    let hasStarted = false;
    let lastTime = 0;
    let localBest = best;

    function initClouds() {
      clouds = [];
      for (let i = 0; i < 6; i++) {
        clouds.push({ x: Math.random() * 500, y: 30 + Math.random() * 180, r: 20 + Math.random() * 30, speed: 12 + Math.random() * 18 });
      }
    }

    function spawnGate(x: number) {
      const margin = 60;
      const centerY = margin + Math.random() * (H - margin * 2 - GATE_GAP) + GATE_GAP / 2;
      gates.push({ x, centerY, passed: false });
    }

    function resetRun() {
      dragon = { x: W * 0.28, y: H * 0.45, vy: 0, r: 16, rot: 0, flapAnim: 0 };
      gates = [];
      runScore = 0;
      running = true;
      particles = [];
      setScore(0);
      spawnGate(W + 100);
      spawnGate(W + 100 + GATE_SPACING);
      spawnGate(W + 100 + GATE_SPACING * 2);
    }

    function flap() {
      if (!running) return;
      dragon.vy = FLAP_VELOCITY;
      dragon.flapAnim = 1;
      for (let i = 0; i < 4; i++) {
        particles.push({ x: dragon.x - 10, y: dragon.y + 8, vx: -60 - Math.random() * 60, vy: (Math.random() - 0.5) * 80, life: 0.4, r: 2 + Math.random() * 2 });
      }
    }

    function endRun() {
      running = false;
      if (runScore > localBest) {
        localBest = runScore;
        setBest(localBest);
        try { window.localStorage.setItem(STORAGE_KEY, String(localBest)); } catch { /* ignore */ }
      }
      setFinalScore(runScore);
      setTimeout(() => setShowOver(true), 350);
    }

    function update(dt: number) {
      if (!running) return;
      dragon.vy += GRAVITY * dt;
      dragon.y += dragon.vy * dt;
      dragon.rot = Math.max(-0.5, Math.min(1.1, dragon.vy / 600));
      dragon.flapAnim = Math.max(0, dragon.flapAnim - dt * 4);

      if (dragon.y - dragon.r < 0) { dragon.y = dragon.r; dragon.vy = 0; }
      if (dragon.y + dragon.r > H) { endRun(); }

      for (const g of gates) {
        g.x -= SCROLL_SPEED * dt;
        if (!g.passed && g.x + GATE_WIDTH / 2 < dragon.x) {
          g.passed = true;
          runScore++;
          setScore(runScore);
        }
        const withinX = dragon.x + dragon.r > g.x - GATE_WIDTH / 2 && dragon.x - dragon.r < g.x + GATE_WIDTH / 2;
        if (withinX) {
          const topEdge = g.centerY - GATE_GAP / 2;
          const botEdge = g.centerY + GATE_GAP / 2;
          if (dragon.y - dragon.r < topEdge || dragon.y + dragon.r > botEdge) endRun();
        }
      }
      gates = gates.filter((g) => g.x > -GATE_WIDTH);
      const rightMost = gates.length ? Math.max(...gates.map((g) => g.x)) : W;
      if (rightMost < W + GATE_SPACING * 2) spawnGate(rightMost + GATE_SPACING);

      for (const c of clouds) {
        c.x -= c.speed * dt;
        if (c.x < -60) c.x = W + 60;
      }

      for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
      particles = particles.filter((p) => p.life > 0);
    }

    function drawCastleTower(x: number, topY: number, botY: number, isTop: boolean) {
      const w = GATE_WIDTH;
      ctx!.fillStyle = '#3a2a52';
      ctx!.strokeStyle = '#22162f';
      ctx!.lineWidth = 2;
      if (isTop) {
        ctx!.fillRect(x - w / 2, 0, w, topY);
        ctx!.strokeRect(x - w / 2, 0, w, topY);
        ctx!.fillStyle = '#4a3568';
        for (let bx = -w / 2; bx < w / 2; bx += 14) ctx!.fillRect(x + bx, topY - 12, 8, 12);
        ctx!.fillStyle = '#5a4278';
        ctx!.fillRect(x - w / 2 - 4, topY - 4, w + 8, 10);
      } else {
        ctx!.fillRect(x - w / 2, botY, w, H - botY);
        ctx!.strokeRect(x - w / 2, botY, w, H - botY);
        ctx!.fillStyle = '#4a3568';
        for (let bx = -w / 2; bx < w / 2; bx += 14) ctx!.fillRect(x + bx, botY, 8, 12);
        ctx!.fillStyle = '#5a4278';
        ctx!.fillRect(x - w / 2 - 4, botY - 6, w + 8, 10);
      }
    }

    function drawDragon() {
      ctx!.save();
      ctx!.translate(dragon.x, dragon.y);
      ctx!.rotate(dragon.rot * 0.5);
      const wingLift = Math.sin(dragon.flapAnim * Math.PI) * 14;
      ctx!.fillStyle = '#e8622f';
      ctx!.beginPath();
      ctx!.ellipse(-6, -2 - wingLift * 0.4, 14, 8, -0.4, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = '#ff7a3d';
      ctx!.beginPath();
      ctx!.ellipse(0, 0, 17, 13, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = '#ffcf8a';
      ctx!.beginPath();
      ctx!.ellipse(2, 4, 10, 7, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = '#ff7a3d';
      ctx!.beginPath();
      ctx!.ellipse(15, -1, 8, 6, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = '#2a1508';
      ctx!.beginPath();
      ctx!.arc(17, -4, 2, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.strokeStyle = '#ff7a3d';
      ctx!.lineWidth = 6;
      ctx!.lineCap = 'round';
      ctx!.beginPath();
      ctx!.moveTo(-15, 2);
      ctx!.quadraticCurveTo(-26, 6, -22, 14);
      ctx!.stroke();
      ctx!.restore();
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      ctx!.fillStyle = 'rgba(255,255,255,0.25)';
      for (const c of clouds) {
        ctx!.beginPath();
        ctx!.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx!.arc(c.x + c.r * 0.7, c.y + 4, c.r * 0.7, 0, Math.PI * 2);
        ctx!.arc(c.x - c.r * 0.7, c.y + 6, c.r * 0.6, 0, Math.PI * 2);
        ctx!.fill();
      }
      for (const g of gates) {
        drawCastleTower(g.x, g.centerY - GATE_GAP / 2, g.centerY + GATE_GAP / 2, true);
        drawCastleTower(g.x, g.centerY - GATE_GAP / 2, g.centerY + GATE_GAP / 2, false);
      }
      for (const p of particles) {
        ctx!.fillStyle = `rgba(255,200,120,${Math.max(0, p.life / 0.4)})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      drawDragon();
      ctx!.fillStyle = 'rgba(20,10,30,0.35)';
      ctx!.fillRect(0, H - 4, W, 4);
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

    // Exposed so JSX buttons (outside this closure) can drive the loop.
    (wrap as any).__startGame = () => {
      hasStarted = true;
      setStarted(true);
      resetRun();
    };
    (wrap as any).__retryGame = () => {
      setShowOver(false);
      resetRun();
    };

    initClouds();
    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      wrap.removeEventListener('pointerdown', handleInput);
      window.removeEventListener('keydown', handleInput);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="dragons-gate">
      <div className="wrap" ref={wrapRef}>
        <canvas ref={canvasRef} />
        <div className="hud">{score}</div>
        <div className="best-hud">{t('best')}: {best}</div>

        {!started && (
          <div className="start-screen">
            <h1 className="title">
              🐉 {t('title')}
              <br />
              <span className="subtitle-inline">{t('subtitle')}</span>
            </h1>
            <div className="subtitle">{t('instructions')}</div>
            <button
              className="play-btn"
              type="button"
              onClick={() => (wrapRef.current as any)?.__startGame?.()}
            >
              {t('playButton')}
            </button>
            <div className="hint">{t('tapHint')}</div>
          </div>
        )}

        {showOver && (
          <div className="over-screen">
            <div className="score-line">{t('gameOverScore')}</div>
            <div className="score-big">{finalScore}</div>
            <div className="best-line">{t('best')}: {best}</div>
            <button
              className="play-btn"
              type="button"
              onClick={() => (wrapRef.current as any)?.__retryGame?.()}
            >
              {t('retryButton')}
            </button>
          </div>
        )}
      </div>
      <div className="footer-note">{t('footerNote')}</div>

      <style jsx>{`
        .dragons-gate {
          display: flex;
          flex-direction: column;
          align-items: center;
          font-family: Georgia, 'Times New Roman', serif;
        }
        .wrap {
          position: relative;
          width: 100%;
          max-width: 420px;
          aspect-ratio: 9 / 16;
          max-height: 70vh;
          box-shadow: 0 0 60px rgba(120, 60, 200, 0.35);
          border-radius: 8px;
          overflow: hidden;
          border: 3px solid #4a3560;
        }
        canvas {
          display: block;
          width: 100%;
          height: 100%;
          background: linear-gradient(#2b1a4a, #6b3d7a 55%, #b8567a 100%);
        }
        .hud {
          position: absolute;
          top: 14px;
          left: 0;
          right: 0;
          text-align: center;
          color: #fff8e8;
          font-size: 42px;
          font-weight: bold;
          text-shadow: 0 3px 6px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 200, 80, 0.3);
          pointer-events: none;
        }
        .best-hud {
          position: absolute;
          top: 62px;
          left: 0;
          right: 0;
          text-align: center;
          color: #e0c8ff;
          font-size: 14px;
          letter-spacing: 2px;
          text-transform: uppercase;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
          pointer-events: none;
        }
        .start-screen,
        .over-screen {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(13, 7, 20, 0.82);
          color: #fff8e8;
          text-align: center;
          padding: 24px;
        }
        .title {
          font-size: 28px;
          font-weight: bold;
          color: #ffd479;
          text-shadow: 0 0 20px rgba(255, 180, 60, 0.6), 0 3px 4px rgba(0, 0, 0, 0.5);
          margin-bottom: 8px;
          line-height: 1.2;
        }
        .subtitle-inline {
          font-size: 16px;
          font-weight: normal;
          color: #e0c8ff;
        }
        .subtitle {
          font-size: 14px;
          color: #d8c4ea;
          margin-bottom: 28px;
          max-width: 260px;
          line-height: 1.5;
        }
        .score-line {
          font-size: 15px;
          color: #e0c8ff;
          margin-bottom: 4px;
        }
        .score-big {
          font-size: 46px;
          font-weight: bold;
          color: #ffd479;
          text-shadow: 0 0 20px rgba(255, 180, 60, 0.6);
          margin-bottom: 4px;
        }
        .best-line {
          font-size: 13px;
          color: #a99bc4;
          margin-bottom: 24px;
        }
        .play-btn {
          background: linear-gradient(#ffd479, #d99b3f);
          border: none;
          color: #3a2410;
          font-family: inherit;
          font-weight: bold;
          font-size: 18px;
          padding: 14px 42px;
          border-radius: 30px;
          box-shadow: 0 4px 0 #a86b1f, 0 8px 16px rgba(0, 0, 0, 0.4);
          cursor: pointer;
          letter-spacing: 1px;
        }
        .play-btn:active {
          transform: translateY(3px);
          box-shadow: 0 1px 0 #a86b1f, 0 4px 8px rgba(0, 0, 0, 0.4);
        }
        .hint {
          margin-top: 18px;
          font-size: 12px;
          color: #8a7aa0;
        }
        .footer-note {
          margin-top: 10px;
          font-size: 11px;
          color: #8a7aa0;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
