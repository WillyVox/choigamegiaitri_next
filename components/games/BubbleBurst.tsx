'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'bubble_pop_best_score';
const COLORS = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#3742fa', '#e84393'];

interface BubbleProps {
  x: number;
  y: number;
  r: number;
  color: string;
  speed: number;
  wobble: number;
}

interface ParticleProps {
  x: number;
  y: number;
  r: number;
  color: string;
  vx: number;
  vy: number;
  alpha: number;
}

interface TextProps {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
}

export default function BubbleBurstGame() {

  const t = useTranslations('bubbleBurst');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(0);
  const [gameState, setGameState] = useState<'IDLE' | 'RUNNING' | 'GAMEOVER'>('IDLE');

  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(0);
  const gameStateRef = useRef<'IDLE' | 'RUNNING' | 'GAMEOVER'>('IDLE');

  const bubblesRef = useRef<BubbleProps[]>([]);
  const particlesRef = useRef<ParticleProps[]>([]);
  const textsRef = useRef<TextProps[]>([]);
  const lastSpawnTimeRef = useRef<number>(0);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setBestScore(parseInt(saved, 10) || 0);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastFrameTime = performance.now();

    const resizeCanvas = () => {
      if (!canvas || !wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const spawnBubble = () => {
      const r = 22 + Math.random() * 16;
      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;

      bubblesRef.current.push({
        r,
        x: r + Math.random() * (width - r * 2),
        y: height + r,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        speed: 0.6 + Math.random() * 0.6 + Math.min(scoreRef.current * 0.005, 1.2),
        wobble: Math.random() * Math.PI * 2,
      });
    };

    const popBubble = (index: number, bubble: BubbleProps) => {
      comboRef.current += 1;
      const addedScore = 10 + Math.min(comboRef.current, 10) * 2;

      setScore((prev) => prev + addedScore);

      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4;
        particlesRef.current.push({
          x: bubble.x,
          y: bubble.y,
          r: 2 + Math.random() * 3,
          color: bubble.color,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
        });
      }

      const txt = comboRef.current > 2 ? `+${addedScore} (${comboRef.current}x)` : `+${addedScore}`;
      textsRef.current.push({
        x: bubble.x,
        y: bubble.y,
        text: txt,
        color: comboRef.current > 2 ? '#fbbf24' : '#ffffff',
        alpha: 1,
      });

      bubblesRef.current.splice(index, 1);
    };

    const triggerGameOver = () => {
      setGameState('GAMEOVER');
      setBestScore((prevBest) => {
        const currentScore = scoreRef.current;
        if (currentScore > prevBest) {
          try {
            localStorage.setItem(STORAGE_KEY, currentScore.toString());
          } catch {
            // Ignore
          }
          return currentScore;
        }
        return prevBest;
      });
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (gameStateRef.current !== 'RUNNING') return;

      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      let hit = false;
      const bubbles = bubblesRef.current;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        const dist = Math.hypot(clickX - b.x, clickY - b.y);

        if (dist < b.r + 12) {
          popBubble(i, b);
          hit = true;
          break;
        }
      }

      if (!hit) {
        comboRef.current = 0;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      handlePointerDown(e);
    };

    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });

    const gameLoop = (time: number) => {
      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;

      const deltaTime = Math.min((time - lastFrameTime) / 1000, 0.1);
      lastFrameTime = time;

      ctx.clearRect(0, 0, width, height);

      if (gameStateRef.current === 'RUNNING') {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(0, 50);
        ctx.lineTo(width, 50);
        ctx.stroke();
        ctx.setLineDash([]);

        const spawnDelay = Math.max(800, 1600 - Math.floor(scoreRef.current * 2));
        if (time - lastSpawnTimeRef.current >= spawnDelay) {
          spawnBubble();
          lastSpawnTimeRef.current = time;
        }

        const bubbles = bubblesRef.current;
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i];
          b.y -= b.speed * deltaTime * 60;
          b.wobble += 0.03;
          b.x += Math.sin(b.wobble) * 0.5;

          ctx.save();
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);

          const grad = ctx.createRadialGradient(
            b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1,
            b.x, b.y, b.r
          );
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.2, b.color);
          grad.addColorStop(1, '#000000');

          ctx.fillStyle = grad;
          ctx.shadowColor = b.color;
          ctx.shadowBlur = 8;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fill();
          ctx.restore();

          if (b.y - b.r <= 50) {
            triggerGameOver();
            break;
          }
        }

        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx * deltaTime * 60;
          p.y += p.vy * deltaTime * 60;
          p.vy += 0.08;
          p.alpha -= 0.025;

          if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
          ctx.restore();
        }

        const texts = textsRef.current;
        for (let i = texts.length - 1; i >= 0; i--) {
          const t = texts[i];
          t.y -= 1.2 * deltaTime * 60;
          t.alpha -= 0.02;

          if (t.alpha <= 0) {
            texts.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.globalAlpha = Math.max(0, t.alpha);
          ctx.font = 'bold 20px system-ui';
          ctx.fillStyle = t.color;
          ctx.textAlign = 'center';
          ctx.fillText(t.text, t.x, t.y);
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousedown', handlePointerDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  const handleStartGame = () => {
    bubblesRef.current = [];
    particlesRef.current = [];
    textsRef.current = [];
    comboRef.current = 0;
    lastSpawnTimeRef.current = performance.now();

    setScore(0);
    setGameState('RUNNING');
  };

  return (
    <div className="bubble-game-container">
      
      {/* GAME CONTAINER */}
      <div ref={wrapperRef} className="game-wrapper">
        {/* HUD */}
        <div className="hud">
          <div className="score">{score}</div>
          <div className="best-score">
            {t('best', { score: bestScore })}
          </div>
        </div>

        {/* START OVERLAY */}
        {gameState === 'IDLE' && (
          <div className="overlay">
            <h1 className="title">{t('title')}</h1>
            <p
              className="subtitle"
              dangerouslySetInnerHTML={{ __html: t('subtitle') }}
            />
            <button onClick={handleStartGame} className="btn-play">
              {t('playButton')}
            </button>
          </div>
        )}

        {/* GAME OVER OVERLAY */}
        {gameState === 'GAMEOVER' && (
          <div className="overlay">
            <h2 className="title" style={{ color: '#f43f5e' }}>
              {t('gameOverTitle')}
            </h2>
            <p className="subtitle">
              {t('gameOverScore', { score })}
            </p>

            {/* ADS PLACEHOLDER 2 */}
            <div className="ad-rect">
              <span>{t('adGameOver')}</span>
            </div>

            <button onClick={handleStartGame} className="btn-play">
              {t('retryButton')}
            </button>
          </div>
        )}

        <canvas ref={canvasRef} className="game-canvas" />
      </div>

      <style jsx>{`
        .bubble-game-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          background-color: #0f172a;
          color: #f8fafc;
          font-family: system-ui, -apple-system, sans-serif;
          user-select: none;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        .game-wrapper {
          position: relative;
          width: 100%;
          max-width: 420px;
          height: calc(100vh - 100px);
          max-height: 750px;
          background: linear-gradient(180deg, #0f172a 0%, #311042 100%);
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 20px rgba(168, 85, 247, 0.2);
          overflow: hidden;
          // border: 2px solid #5b21b6;
        }

        .hud {
          position: absolute;
          top: 16px;
          left: 0;
          right: 0;
          text-align: center;
          pointer-events: none;
          z-index: 10;
        }

        .score {
          font-size: 42px;
          font-weight: 900;
          color: #fbbf24;
          text-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
        }

        .best-score {
          font-size: 12px;
          font-weight: 600;
          color: #d8b4fe;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-top: 4px;
        }

        .overlay {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(8px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
          z-index: 20;
        }

        .title {
          font-size: 32px;
          font-weight: 800;
          color: #f43f5e;
          margin-bottom: 8px;
          text-shadow: 0 0 20px rgba(244, 63, 94, 0.4);
        }

        .subtitle {
          font-size: 14px;
          color: #94a3b8;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .btn-play {
          padding: 14px 40px;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          background: linear-gradient(135deg, #38ef7d, #11998e);
          border: none;
          border-radius: 50px;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(56, 239, 125, 0.4);
          transition: transform 0.15s ease, filter 0.15s ease;
        }

        .btn-play:hover {
          filter: brightness(1.1);
          transform: scale(1.05);
        }

        .btn-play:active {
          transform: scale(0.95);
        }

        .ad-rect {
          width: 100%;
          height: 250px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px dashed #475569;
          margin: 12px 0 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          font-size: 12px;
          border-radius: 8px;
        }

        .game-canvas {
          width: 100%;
          height: 100%;
          display: block;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}