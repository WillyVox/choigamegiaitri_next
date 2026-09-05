'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'dragons-gate:bubble-best';

const COLORS = [
  '#ff7a5c',
  '#ffd166',
  '#74d3ae',
  '#71b7ff',
  '#c58cff',
  '#ff8fc7',
];

interface Bubble {
  x: number;
  y: number;
  r: number;
  color: string;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  popped: boolean;
  wobble: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  color: string;
}

interface Spark {
  x: number;
  y: number;
  text: string;
  life: number;
}

export default function BubbleBurst() {
  const t = useTranslations('bubbleBurst');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const [started, setStarted] = useState(false);
  const [showOver, setShowOver] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setBest(Number.parseInt(saved, 10) || 0);
    } catch {
      // Storage might be disabled.
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;

    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let DPR = 1;

    let bubbles: Bubble[] = [];
    let particles: Particle[] = [];
    let sparks: Spark[] = [];

    let running = false;
    let gameStarted = false;
    let runScore = 0;
    let combo = 0;
    let lastTime = 0;
    let localBest = best;
    let spawnTimer = 0;
    let elapsed = 0;

    function resize() {
      DPR = window.devicePixelRatio || 1;
      W = wrap.clientWidth;
      H = wrap.clientHeight;

      canvas.width = W * DPR;
      canvas.height = H * DPR;

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function randomColor() {
      return COLORS[Math.floor(Math.random() * COLORS.length)];
    }

    function spawnBubble(initial = false) {
      const r = 18 + Math.random() * 18;

      bubbles.push({
        x: r + Math.random() * Math.max(1, W - r * 2),
        y: initial
          ? 90 + Math.random() * Math.max(1, H - 170)
          : H + r + Math.random() * 40,
        r,
        color: randomColor(),
        vx: (Math.random() - 0.5) * 20,
        vy: -(24 + Math.random() * 38),
        life: 10,
        maxLife: 10,
        popped: false,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    function createInitialBubbles() {
      bubbles = [];

      const count = Math.max(12, Math.floor(W / 34));

      for (let i = 0; i < count; i++) {
        spawnBubble(true);
      }
    }

    function resetRun() {
      runScore = 0;
      combo = 0;
      elapsed = 0;
      spawnTimer = 0;

      particles = [];
      sparks = [];

      createInitialBubbles();

      running = true;
      setScore(0);
    }

    function addParticles(bubble: Bubble) {
      for (let i = 0; i < 14; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 70 + Math.random() * 180;

        particles.push({
          x: bubble.x,
          y: bubble.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 2 + Math.random() * 3,
          life: 0.45 + Math.random() * 0.35,
          color: bubble.color,
        });
      }
    }

    function popBubble(bubble: Bubble) {
      if (bubble.popped) return;

      bubble.popped = true;
      combo++;

      const points = 10 + Math.min(combo, 10) * 2;
      runScore += points;

      setScore(runScore);
      addParticles(bubble);

      sparks.push({
        x: bubble.x,
        y: bubble.y,
        text: `+${points}`,
        life: 0.8,
      });
    }

    function pointerPosition(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();

      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function handlePointer(event: PointerEvent) {
      if (!running) return;

      event.preventDefault();

      const point = pointerPosition(event);
      let hit = false;

      // Check topmost bubbles first.
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];

        if (bubble.popped) continue;

        const dx = point.x - bubble.x;
        const dy = point.y - bubble.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= bubble.r) {
          popBubble(bubble);
          hit = true;
          break;
        }
      }

      if (!hit) {
        combo = 0;
      }
    }

    function endRun() {
      if (!running) return;

      running = false;

      if (runScore > localBest) {
        localBest = runScore;
        setBest(localBest);

        try {
          window.localStorage.setItem(STORAGE_KEY, String(localBest));
        } catch {
          // Ignore storage errors.
        }
      }

      setFinalScore(runScore);

      window.setTimeout(() => {
        setShowOver(true);
      }, 350);
    }

    function update(dt: number) {
      if (!running) return;

      elapsed += dt;
      spawnTimer += dt;

      const spawnRate = Math.max(0.28, 0.75 - elapsed * 0.008);

      if (spawnTimer >= spawnRate) {
        spawnTimer = 0;
        spawnBubble();
      }

      for (const bubble of bubbles) {
        if (bubble.popped) continue;

        bubble.x += bubble.vx * dt;
        bubble.y += bubble.vy * dt;
        bubble.wobble += dt * 2;

        bubble.x += Math.sin(bubble.wobble) * 4 * dt;
        bubble.life -= dt;

        if (bubble.x - bubble.r < 0) {
          bubble.x = bubble.r;
          bubble.vx *= -1;
        }

        if (bubble.x + bubble.r > W) {
          bubble.x = W - bubble.r;
          bubble.vx *= -1;
        }

        if (bubble.life <= 0) {
          endRun();
        }
      }

      bubbles = bubbles.filter(
        (bubble) => !bubble.popped && bubble.y + bubble.r > -40,
      );

      for (const particle of particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 240 * dt;
        particle.life -= dt;
      }

      particles = particles.filter((particle) => particle.life > 0);

      for (const spark of sparks) {
        spark.y -= 35 * dt;
        spark.life -= dt;
      }

      sparks = sparks.filter((spark) => spark.life > 0);
    }

    function drawBackground() {
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, '#2b1a4a');
      gradient.addColorStop(0.55, '#6b3d7a');
      gradient.addColorStop(1, '#b8567a');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(255,255,255,0.08)';

      for (let i = 0; i < 18; i++) {
        const x = (i * 97 + elapsed * 8) % (W + 100) - 50;
        const y = 80 + ((i * 71) % Math.max(100, H - 150));

        ctx.beginPath();
        ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawBubble(bubble: Bubble) {
      const alpha = Math.max(0.15, Math.min(1, bubble.life / 1.2));

      ctx.save();
      ctx.globalAlpha = alpha;

      const gradient = ctx.createRadialGradient(
        bubble.x - bubble.r * 0.35,
        bubble.y - bubble.r * 0.4,
        2,
        bubble.x,
        bubble.y,
        bubble.r,
      );

      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.16, bubble.color);
      gradient.addColorStop(1, 'rgba(35, 14, 55, 0.9)');

      ctx.fillStyle = gradient;
      ctx.shadowColor = bubble.color;
      ctx.shadowBlur = 18;

      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(
        bubble.x - bubble.r * 0.34,
        bubble.y - bubble.r * 0.38,
        bubble.r * 0.16,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      drawBackground();

      for (const bubble of bubbles) {
        drawBubble(bubble);
      }

      for (const particle of particles) {
        ctx.globalAlpha = Math.max(0, particle.life / 0.7);
        ctx.fillStyle = particle.color;

        ctx.beginPath();
        ctx.arc(
          particle.x,
          particle.y,
          particle.r,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      for (const spark of sparks) {
        ctx.globalAlpha = Math.max(0, spark.life);
        ctx.fillStyle = '#fff4ba';
        ctx.font = 'bold 16px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(spark.text, spark.x, spark.y);
      }

      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(20,10,30,0.4)';
      ctx.fillRect(0, H - 4, W, 4);
    }

    function loop(time: number) {
      if (!lastTime) lastTime = time;

      const dt = Math.min(0.033, (time - lastTime) / 1000);
      lastTime = time;

      update(dt);
      draw();

      rafRef.current = requestAnimationFrame(loop);
    }

    (wrap as any).__startGame = () => {
      gameStarted = true;
      setStarted(true);
      setShowOver(false);
      resetRun();
    };

    (wrap as any).__retryGame = () => {
      setShowOver(false);
      resetRun();
    };

    canvas.addEventListener('pointerdown', handlePointer);
    window.addEventListener('resize', resize);

    resize();
    createInitialBubbles();
    draw();

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('resize', resize);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [best]);

  return (
    <div className="bubble-burst">
      <div className="wrap" ref={wrapRef}>
        <canvas ref={canvasRef} />

        <div className="hud">{score}</div>

        <div className="best-hud">
          {t('best')}: {best}
        </div>

        {!started && (
          <div className="start-screen">
            <h1 className="title">
              🫧 {t('title')}
              <br />
              <span className="subtitle-inline">
                {t('subtitle')}
              </span>
            </h1>

            <div className="subtitle">
              {t('instructions')}
            </div>

            <button
              className="play-btn"
              type="button"
              onClick={() =>
                (wrapRef.current as any)?.__startGame?.()
              }
            >
              {t('playButton')}
            </button>

            <div className="hint">
              {t('tapHint')}
            </div>
          </div>
        )}

        {showOver && (
          <div className="over-screen">
            <div className="score-line">
              {t('gameOverScore')}
            </div>

            <div className="score-big">
              {finalScore}
            </div>

            <div className="best-line">
              {t('best')}: {best}
            </div>

            <button
              className="play-btn"
              type="button"
              onClick={() =>
                (wrapRef.current as any)?.__retryGame?.()
              }
            >
              {t('retryButton')}
            </button>
          </div>
        )}
      </div>

      <div className="footer-note">
        {t('footerNote')}
      </div>

      <style jsx>{`
        .bubble-burst {
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
          overflow: hidden;
          border: 3px solid #4a3560;
          border-radius: 8px;
          background: #2b1a4a;
          box-shadow: 0 0 60px rgba(120, 60, 200, 0.35);
          touch-action: none;
        }

        canvas {
          display: block;
          width: 100%;
          height: 100%;
          cursor: pointer;
          touch-action: none;
        }

        .hud {
          position: absolute;
          top: 14px;
          left: 0;
          right: 0;
          color: #fff8e8;
          font-size: 42px;
          font-weight: bold;
          text-align: center;
          text-shadow:
            0 3px 6px rgba(0, 0, 0, 0.6),
            0 0 20px rgba(255, 200, 80, 0.3);
          pointer-events: none;
        }

        .best-hud {
          position: absolute;
          top: 62px;
          left: 0;
          right: 0;
          color: #e0c8ff;
          font-size: 14px;
          letter-spacing: 2px;
          text-align: center;
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
          padding: 24px;
          color: #fff8e8;
          text-align: center;
          background: rgba(13, 7, 20, 0.82);
        }

        .title {
          margin-bottom: 8px;
          color: #ffd479;
          font-size: 28px;
          line-height: 1.2;
          text-shadow:
            0 0 20px rgba(255, 180, 60, 0.6),
            0 3px 4px rgba(0, 0, 0, 0.5);
        }

        .subtitle-inline {
          color: #e0c8ff;
          font-size: 16px;
          font-weight: normal;
        }

        .subtitle {
          max-width: 270px;
          margin-bottom: 28px;
          color: #d8c4ea;
          font-size: 14px;
          line-height: 1.5;
        }

        .score-line {
          margin-bottom: 4px;
          color: #e0c8ff;
          font-size: 15px;
        }

        .score-big {
          margin-bottom: 4px;
          color: #ffd479;
          font-size: 46px;
          font-weight: bold;
          text-shadow: 0 0 20px rgba(255, 180, 60, 0.6);
        }

        .best-line {
          margin-bottom: 24px;
          color: #a99bc4;
          font-size: 13px;
        }

        .play-btn {
          padding: 14px 42px;
          border: none;
          border-radius: 30px;
          color: #3a2410;
          background: linear-gradient(#ffd479, #d99b3f);
          box-shadow:
            0 4px 0 #a86b1f,
            0 8px 16px rgba(0, 0, 0, 0.4);
          cursor: pointer;
          font-family: inherit;
          font-size: 18px;
          font-weight: bold;
          letter-spacing: 1px;
        }

        .play-btn:hover {
          filter: brightness(1.08);
        }

        .play-btn:active {
          transform: translateY(3px);
          box-shadow:
            0 1px 0 #a86b1f,
            0 4px 8px rgba(0, 0, 0, 0.4);
        }

        .hint {
          margin-top: 18px;
          color: #8a7aa0;
          font-size: 12px;
        }

        .footer-note {
          margin-top: 10px;
          color: #8a7aa0;
          font-size: 11px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
