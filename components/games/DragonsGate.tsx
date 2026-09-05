'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const VW = 480;
const VH = 800;
const STORAGE_KEY = 'dragons-gate:best';

const GRAVITY = 1500;
const FLAP_VELOCITY = -420;
const GATE_GAP = 190;
const GATE_WIDTH = 68;
const GATE_SPACING = 260;
const SCROLL_SPEED = 170;

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
  passed: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  r: number;
}

interface Cloud {
  x: number;
  y: number;
  r: number;
  speed: number;
}

export default function DragonsGate() {
  const t = useTranslations('dragonsGate');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const [started, setStarted] = useState<boolean>(false);
  const [showOver, setShowOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [best, setBest] = useState<number>(0);
  const [finalScore, setFinalScore] = useState<number>(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setBest(parseInt(saved, 10) || 0);
    } catch {
      // localStorage unavailable
    }
  }, []);

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
    let runScore = 0;
    let running = false;
    let hasStarted = false;
    let lastTime = 0;
    let localBest = best;

    function initClouds() {
      clouds = [];
      for (let i = 0; i < 6; i++) {
        clouds.push({
          x: Math.random() * VW,
          y: 30 + Math.random() * 180,
          r: 20 + Math.random() * 30,
          speed: 12 + Math.random() * 18,
        });
      }
    }

    function spawnGate(x: number) {
      const margin = 60;
      const centerY = margin + Math.random() * (VH - margin * 2 - GATE_GAP) + GATE_GAP / 2;
      gates.push({ x, centerY, passed: false });
    }

    function resetRun() {
      dragon = { x: VW * 0.28, y: VH * 0.45, vy: 0, r: 16, rot: 0, flapAnim: 0 };
      gates = [];
      runScore = 0;
      running = true;
      particles = [];
      setScore(0);
      spawnGate(VW + 100);
      spawnGate(VW + 100 + GATE_SPACING);
      spawnGate(VW + 100 + GATE_SPACING * 2);
    }

    function flap() {
      if (!running) return;
      dragon.vy = FLAP_VELOCITY;
      dragon.flapAnim = 1;
      for (let i = 0; i < 4; i++) {
        particles.push({
          x: dragon.x - 10,
          y: dragon.y + 8,
          vx: -60 - Math.random() * 60,
          vy: (Math.random() - 0.5) * 80,
          life: 0.4,
          r: 2 + Math.random() * 2,
        });
      }
    }

    function endRun() {
      running = false;
      if (runScore > localBest) {
        localBest = runScore;
        setBest(localBest);
        try {
          window.localStorage.setItem(STORAGE_KEY, String(localBest));
        } catch {
          /* ignore */
        }
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

      if (dragon.y - dragon.r < 0) {
        dragon.y = dragon.r;
        dragon.vy = 0;
      }
      if (dragon.y + dragon.r > VH) {
        endRun();
      }

      for (const g of gates) {
        g.x -= SCROLL_SPEED * dt;
        if (!g.passed && g.x + GATE_WIDTH / 2 < dragon.x) {
          g.passed = true;
          runScore++;
          setScore(runScore);
        }
        const withinX =
          dragon.x + dragon.r > g.x - GATE_WIDTH / 2 &&
          dragon.x - dragon.r < g.x + GATE_WIDTH / 2;
        if (withinX) {
          const topEdge = g.centerY - GATE_GAP / 2;
          const botEdge = g.centerY + GATE_GAP / 2;
          if (dragon.y - dragon.r < topEdge || dragon.y + dragon.r > botEdge) endRun();
        }
      }
      gates = gates.filter((g) => g.x > -GATE_WIDTH);
      const rightMost = gates.length ? Math.max(...gates.map((g) => g.x)) : VW;
      if (rightMost < VW + GATE_SPACING * 2) spawnGate(rightMost + GATE_SPACING);

      for (const c of clouds) {
        c.x -= c.speed * dt;
        if (c.x < -60) c.x = VW + 60;
      }

      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
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
        ctx!.fillRect(x - w / 2, botY, w, VH - botY);
        ctx!.strokeRect(x - w / 2, botY, w, VH - botY);
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
      ctx!.clearRect(0, 0, VW, VH);

      const grad = ctx!.createLinearGradient(0, 0, 0, VH);
      grad.addColorStop(0, '#2b1a4a');
      grad.addColorStop(0.55, '#6b3d7a');
      grad.addColorStop(1, '#b8567a');
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, VW, VH);

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
      ctx!.fillRect(0, VH - 4, VW, 4);
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
  }, []);

  return (
    <div id="app">
      <link
        href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap"
        rel="stylesheet"
      />

      {/* ADS PLACEHOLDER 1 */}
      <div className="ad-slot ad-top" data-ad-slot="top-banner" aria-hidden="true">
        Vị trí quảng cáo 728×90 / responsive
      </div>

      <div className="game-shell">
        {/* ADS SIDE LEFT */}
        <div className="ad-slot ad-side" data-ad-slot="side-left" aria-hidden="true">
          Quảng cáo 160×600
        </div>

        {/* STAGE WRAPPER */}
        <div className="stage-wrap" ref={stageWrapRef}>
          <canvas ref={canvasRef} id="game" />

          {/* HUD */}
          <div className="hud">
            <div className="hud-top">
              <div className="hud-block">
                <div className="score-value">{score}</div>
                <div className="best-hud">
                  {t('best')}: {best}
                </div>
              </div>
            </div>
          </div>

          {/* START SCREEN */}
          {!started && (
            <div className="screen">
              <div className="logo">
                🐉 DRAGON<span>GATE</span>
              </div>
              <div className="tagline">{t('subtitle')}</div>
              <div className="hiscore-pill">
                {t('best')}: {best}
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => (stageWrapRef.current as any)?.__startGame?.()}
              >
                {t('playButton')}
              </button>
              <div className="hint">{t('instructions')}</div>
            </div>
          )}

          {/* GAME OVER SCREEN */}
          {showOver && (
            <div className="screen">
              <div className="final-label">{t('gameOverScore')}</div>
              <div className="final-score">{finalScore}</div>
              <div className="hiscore-pill">
                {t('best')}: {best}
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => (stageWrapRef.current as any)?.__retryGame?.()}
              >
                {t('retryButton')}
              </button>
            </div>
          )}
        </div>

        {/* ADS SIDE RIGHT */}
        <div className="ad-slot ad-side" data-ad-slot="side-right" aria-hidden="true">
          Quảng cáo 160×600
        </div>
      </div>

      {/* ADS PLACEHOLDER BOTTOM */}
      <div className="ad-slot ad-bottom" data-ad-slot="bottom-banner" aria-hidden="true">
        Vị trí quảng cáo 320×50 / responsive
      </div>

      <div className="about">
        <p className="footer-note">{t('footerNote')}</p>
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
          padding: 6px 12px;
          backdrop-filter: blur(4px);
        }

        .score-value {
          font-size: 26px;
          font-weight: 700;
          line-height: 1;
          color: var(--cloud);
        }

        .best-hud {
          font-size: 11px;
          color: var(--cyan);
          margin-top: 2px;
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

        .about {
          max-width: 640px;
          width: 100%;
          padding: 16px 20px 30px;
          color: rgba(238, 243, 249, 0.55);
          font-size: 13px;
          line-height: 1.7;
          text-align: center;
        }

        .footer-note {
          margin-top: 10px;
          font-size: 12px;
          color: rgba(238, 243, 249, 0.6);
        }
      `}</style>
    </div>
  );
}