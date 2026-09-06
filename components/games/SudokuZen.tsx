'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';

const SIZE = 9;
const BOX = 3;
const STORAGE_KEY = 'sudoku-zen:best-score';
const HINTS_PER_LEVEL = 3;
const MISTAKES_LIMIT = 3;
const AD_SKIP_SECONDS = 10;

interface CellState {
  value: number; // 0 = empty
  given: boolean;
  notes: number[];
  wrong: boolean;
}

function emptyBoard(): CellState[] {
  return Array.from({ length: SIZE * SIZE }, () => ({ value: 0, given: false, notes: [], wrong: false }));
}

function idx(r: number, c: number) {
  return r * SIZE + c;
}

function peers(r: number, c: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < SIZE; i++) { out.push([r, i]); out.push([i, c]); }
  const br = Math.floor(r / BOX) * BOX, bc = Math.floor(c / BOX) * BOX;
  for (let dr = 0; dr < BOX; dr++) for (let dc = 0; dc < BOX; dc++) out.push([br + dr, bc + dc]);
  return out;
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Fills an empty 9x9 grid completely using randomized backtracking.
function generateSolvedGrid(): number[] {
  const grid = new Array(81).fill(0);
  function valid(pos: number, val: number) {
    const r = Math.floor(pos / SIZE), c = pos % SIZE;
    for (const [pr, pc] of peers(r, c)) {
      if (grid[idx(pr, pc)] === val) return false;
    }
    return true;
  }
  function fill(pos: number): boolean {
    if (pos === 81) return true;
    for (const val of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (valid(pos, val)) {
        grid[pos] = val;
        if (fill(pos + 1)) return true;
        grid[pos] = 0;
      }
    }
    return false;
  }
  fill(0);
  return grid;
}

// Counts solutions up to `limit` (used to confirm a puzzle stays uniquely
// solvable while we dig holes out of it). Capped so a pathological board
// can never hang the browser.
function countSolutions(grid: number[], limit: number): number {
  const g = [...grid];
  let count = 0;
  let steps = 0;
  const STEP_CAP = 60000;

  function valid(pos: number, val: number) {
    const r = Math.floor(pos / SIZE), c = pos % SIZE;
    for (const [pr, pc] of peers(r, c)) {
      if (g[idx(pr, pc)] === val) return false;
    }
    return true;
  }
  function nextEmpty(from: number) {
    for (let i = from; i < 81; i++) if (g[i] === 0) return i;
    return -1;
  }
  function solve(from: number): boolean {
    steps++;
    if (steps > STEP_CAP) return true; // bail out, treat as "good enough"
    const pos = nextEmpty(from);
    if (pos === -1) { count++; return count >= limit; }
    for (let val = 1; val <= 9; val++) {
      if (valid(pos, val)) {
        g[pos] = val;
        if (solve(pos + 1)) return true;
        g[pos] = 0;
      }
    }
    return false;
  }
  solve(0);
  return count;
}

function cluesForLevel(level: number) {
  return Math.max(28, 46 - (level - 1) * 2);
}

function difficultyLabel(level: number, t: (key: string) => string) {
  if (level <= 2) return t('diffEasy');
  if (level <= 5) return t('diffMedium');
  if (level <= 8) return t('diffHard');
  return t('diffExpert');
}

// Digs holes out of a fully solved grid until only `targetClues` cells
// remain, checking after every removal that the puzzle still has exactly
// one solution.
function generatePuzzle(level: number): { puzzle: number[]; solution: number[] } {
  const solution = generateSolvedGrid();
  const puzzle = [...solution];
  const target = cluesForLevel(level);
  const order = shuffled(Array.from({ length: 81 }, (_, i) => i));
  let clues = 81;
  for (const pos of order) {
    if (clues <= target) break;
    const backup = puzzle[pos];
    puzzle[pos] = 0;
    const solvable = countSolutions(puzzle, 2);
    if (solvable === 1) {
      clues--;
    } else {
      puzzle[pos] = backup;
    }
  }
  return { puzzle, solution };
}

function boardFromPuzzle(puzzle: number[]): CellState[] {
  return puzzle.map((v) => ({ value: v, given: v !== 0, notes: [], wrong: false }));
}

interface HistoryEntry { index: number; prev: CellState; }

export default function SudokuZen() {
  const t = useTranslations('sudokuZen');

  const [level, setLevel] = useState(1);
  const [board, setBoard] = useState<CellState[]>([]);
  const [solution, setSolution] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(HINTS_PER_LEVEL);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'playing' | 'levelComplete' | 'gameOver'>('playing');
  const [adPurpose, setAdPurpose] = useState<'levelComplete' | 'gameOver' | 'bonusHint' | null>(null);
  const [adSkipIn, setAdSkipIn] = useState(AD_SKIP_SECONDS);
  const [shareLabel, setShareLabel] = useState('');

  const historyRef = useRef<HistoryEntry[]>([]);
  const timerRef = useRef<number | undefined>(undefined);
  const adTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setBest(parseInt(saved, 10) || 0);
    } catch { /* ignore */ }
  }, []);

  const startLevel = useCallback((lvl: number) => {
    setLoading(true);
    setStatus('playing');
    setAdPurpose(null);
    // Let the loading state paint before the (synchronous) generation work.
    window.setTimeout(() => {
      const { puzzle, solution: sol } = generatePuzzle(lvl);
      setBoard(boardFromPuzzle(puzzle));
      setSolution(sol);
      setSelected(null);
      setMistakes(0);
      setHints(HINTS_PER_LEVEL);
      setSeconds(0);
      historyRef.current = [];
      setLoading(false);
    }, 30);
  }, []);

  useEffect(() => {
    startLevel(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || status !== 'playing' || adPurpose) return;
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timerRef.current);
  }, [loading, status, adPurpose]);

  useEffect(() => {
    if (!adPurpose) return;
    setAdSkipIn(AD_SKIP_SECONDS);
    adTimerRef.current = window.setInterval(() => {
      setAdSkipIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(adTimerRef.current);
  }, [adPurpose]);

  function finishInterstitial() {
    window.clearInterval(adTimerRef.current);
    if (adPurpose === 'bonusHint') {
      setHints((h) => h + 1);
    } else if (adPurpose === 'levelComplete') {
      setStatus('levelComplete');
    } else if (adPurpose === 'gameOver') {
      setStatus('gameOver');
    }
    setAdPurpose(null);
  }

  function commitScoreForLevel() {
    const gained = Math.max(200, 1000 - mistakes * 150 - Math.floor(seconds / 2) * 5);
    const total = score + gained;
    setScore(total);
    if (total > best) {
      setBest(total);
      try { window.localStorage.setItem(STORAGE_KEY, String(total)); } catch { /* ignore */ }
    }
  }

  function isBoardSolved(next: CellState[]) {
    return next.every((cell, i) => cell.value === solution[i]);
  }

  function selectCell(i: number) {
    if (status !== 'playing' || loading) return;
    setSelected(i);
  }

  function applyValue(i: number, value: number) {
    const cell = board[i];
    if (cell.given) return;
    historyRef.current.push({ index: i, prev: { ...cell, notes: [...cell.notes] } });

    const next = [...board];
    if (notesMode && value !== 0) {
      const notes = cell.notes.includes(value) ? cell.notes.filter((n) => n !== value) : [...cell.notes, value];
      next[i] = { ...cell, notes, wrong: false };
      setBoard(next);
      return;
    }

    const correct = value === 0 || solution[i] === value;
    next[i] = { ...cell, value, notes: [], wrong: value !== 0 && !correct };
    setBoard(next);

    if (value !== 0 && !correct) {
      const m = mistakes + 1;
      setMistakes(m);
      if (m >= MISTAKES_LIMIT) {
        commitScoreForLevel();
        setAdPurpose('gameOver');
        return;
      }
    }

    if (value !== 0 && correct && isBoardSolved(next)) {
      commitScoreForLevel();
      setAdPurpose('levelComplete');
    }
  }

  function handleDigit(n: number) {
    if (selected === null) return;
    applyValue(selected, n);
  }

  function handleErase() {
    if (selected === null) return;
    applyValue(selected, 0);
  }

  function handleUndo() {
    const entry = historyRef.current.pop();
    if (!entry) return;
    const next = [...board];
    next[entry.index] = entry.prev;
    setBoard(next);
  }

  function handleHint() {
    if (selected === null || hints <= 0) return;
    const cell = board[selected];
    if (cell.given || cell.value === solution[selected]) return;
    historyRef.current.push({ index: selected, prev: { ...cell, notes: [...cell.notes] } });
    const next = [...board];
    next[selected] = { value: solution[selected], given: false, notes: [], wrong: false };
    setBoard(next);
    setHints((h) => h - 1);
    if (isBoardSolved(next)) {
      commitScoreForLevel();
      setAdPurpose('levelComplete');
    }
  }

  function watchAdForHint() {
    setAdPurpose('bonusHint');
  }

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (status !== 'playing' || selected === null) return;
    if (e.key >= '1' && e.key <= '9') applyValue(selected, parseInt(e.key, 10));
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') applyValue(selected, 0);
    if (e.key.toLowerCase() === 'n') setNotesMode((v) => !v);
    const r = Math.floor(selected / SIZE), c = selected % SIZE;
    if (e.key === 'ArrowUp' && r > 0) setSelected(idx(r - 1, c));
    if (e.key === 'ArrowDown' && r < 8) setSelected(idx(r + 1, c));
    if (e.key === 'ArrowLeft' && c > 0) setSelected(idx(r, c - 1));
    if (e.key === 'ArrowRight' && c < 8) setSelected(idx(r, c + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selected, board, notesMode, mistakes, hints, score, best, seconds]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  async function shareScore() {
    const message = `I scored ${score} in Sudoku Zen \u2728 reached level ${level}, best is ${best}.`;
    try {
      await navigator.clipboard.writeText(message);
      setShareLabel(t('shareCopied'));
    } catch {
      setShareLabel(message);
    }
    setTimeout(() => setShareLabel(''), 2200);
  }

  function nextLevel() {
    const lvl = level + 1;
    setLevel(lvl);
    startLevel(lvl);
  }

  function retryLevel() {
    startLevel(level);
  }

  function mm(sec: number) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const digitCounts = Array.from({ length: 10 }, (_, n) => board.filter((c) => c.value === n).length);

  return (
    <div className="sudoku-zen">
      <div className="ad-slot ad-slot--top">{t('adTop')}</div>

      <div className="hud">
        <div className="stat"><span className="stat__value">{t('levelShort')} {level}</span><span className="stat__label">{difficultyLabel(level, t)}</span></div>
        <div className="stat"><span className="stat__value">{score}</span><span className="stat__label">{t('score')}</span></div>
        <div className="stat"><span className="stat__value">{best}</span><span className="stat__label">{t('best')}</span></div>
        <div className="stat"><span className="stat__value">{mm(seconds)}</span><span className="stat__label">{t('time')}</span></div>
        <div className="stat"><span className="stat__value">{mistakes}/{MISTAKES_LIMIT}</span><span className="stat__label">{t('mistakes')}</span></div>
      </div>

      <div className="game-container">
        {loading ? (
          <div className="loading">{t('generating')}</div>
        ) : (
          <div className="board" role="grid" aria-label="Sudoku board">
            {board.map((cell, i) => {
              const r = Math.floor(i / SIZE), c = i % SIZE;
              const selRow = selected !== null && Math.floor(selected / SIZE) === r;
              const selCol = selected !== null && selected % SIZE === c;
              const selBox = selected !== null &&
                Math.floor(Math.floor(selected / SIZE) / BOX) === Math.floor(r / BOX) &&
                Math.floor((selected % SIZE) / BOX) === Math.floor(c / BOX);
              const sameNumber = selected !== null && board[selected].value !== 0 && cell.value === board[selected].value;
              const isSelected = selected === i;
              const cls = [
                'cell',
                cell.given ? 'cell--given' : 'cell--editable',
                (selRow || selCol || selBox) ? 'cell--peer' : '',
                sameNumber ? 'cell--match' : '',
                isSelected ? 'cell--selected' : '',
                cell.wrong ? 'cell--wrong' : '',
                c % BOX === 0 ? 'cell--boxleft' : '',
                r % BOX === 0 ? 'cell--boxtop' : '',
              ].filter(Boolean).join(' ');
              return (
                <button key={i} type="button" className={cls} onClick={() => selectCell(i)}>
                  {cell.value !== 0 ? cell.value : (
                    cell.notes.length > 0 && (
                      <span className="notes">
                        {Array.from({ length: 9 }, (_, n) => n + 1).map((n) => (
                          <span key={n} className="notes__cell">{cell.notes.includes(n) ? n : ''}</span>
                        ))}
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>
        )}

        {adPurpose && (
          <div className="interstitial">
            <div className="interstitial__panel">
              <p className="interstitial__label">{t('adPlaying')}</p>
              <div className="interstitial__screen">▶</div>
              {adSkipIn > 0 ? (
                <p className="interstitial__countdown">{t('adSkipInPrefix')} {adSkipIn}s</p>
              ) : (
                <button type="button" className="interstitial__skip" onClick={finishInterstitial}>
                  {t('adSkip')}
                </button>
              )}
            </div>
          </div>
        )}

        {!adPurpose && status === 'levelComplete' && (
          <div className="result">
            <div className="result__panel">
              <p className="result__eyebrow">{t('levelCompleteEyebrow')}</p>
              <h3>{score}</h3>
              <button className="continue-btn" type="button" onClick={nextLevel}>{t('nextLevel')}</button>
              <button className="share-btn" type="button" onClick={shareScore}>{shareLabel || t('shareScore')}</button>
            </div>
          </div>
        )}

        {!adPurpose && status === 'gameOver' && (
          <div className="result">
            <div className="result__panel">
              <p className="result__eyebrow">{t('gameOverEyebrow')}</p>
              <h3>{score}</h3>
              <button className="continue-btn" type="button" onClick={retryLevel}>{t('retryLevel')}</button>
              <button className="share-btn" type="button" onClick={shareScore}>{shareLabel || t('shareScore')}</button>
            </div>
          </div>
        )}
      </div>

      {status === 'playing' && !loading && (
        <>
          <div className="tools">
            <button className={`tool-btn ${notesMode ? 'tool-btn--active' : ''}`} type="button" onClick={() => setNotesMode((v) => !v)}>
              ✎ {t('notes')}
            </button>
            <button className="tool-btn" type="button" onClick={handleUndo}>↶ {t('undo')}</button>
            <button className="tool-btn" type="button" onClick={handleHint} disabled={hints <= 0}>
              💡 {t('hint')} ({hints})
            </button>
            <button className="tool-btn" type="button" onClick={watchAdForHint}>
              🎬 {t('watchAdForHint')}
            </button>
          </div>

          <div className="numpad">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className="num-btn" disabled={digitCounts[n] >= 9} onClick={() => handleDigit(n)}>
                {n}
              </button>
            ))}
            <button type="button" className="num-btn num-btn--erase" onClick={handleErase}>⌫</button>
          </div>
        </>
      )}

      <p className="hint-text">{t('hintText')}</p>

      <div className="ad-slot ad-slot--bottom">{t('adBottom')}</div>

      <style jsx>{`
        .sudoku-zen {
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          font-family: var(--font-nunito), sans-serif;
          color: #2e2a24;
        }
        .stat__value, .result__panel h3, .continue-btn, .result__eyebrow, .interstitial__label {
          font-family: var(--font-baloo), sans-serif;
        }
        .ad-slot {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(46, 42, 36, 0.05);
          border: 1px dashed rgba(46, 42, 36, 0.3);
          border-radius: 10px;
          color: #8a8070;
          font-size: 0.7rem;
          padding: 8px;
          margin: 0 auto 12px;
          max-width: 320px;
          min-height: 32px;
        }
        .ad-slot--bottom { margin-top: 12px; margin-bottom: 0; }
        .hud {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .stat {
          background: #faf6ec;
          border: 2px solid #d9cdb0;
          border-radius: 12px;
          padding: 4px 10px;
          text-align: center;
        }
        .stat__value { display: block; font-weight: 700; color: #d97757; font-size: 0.9rem; }
        .stat__label { display: block; font-size: 0.6rem; color: #8a8070; }
        .game-container {
          position: relative;
          background: #faf6ec;
          border-radius: 16px;
          padding: 8px;
          border: 2px solid #d9cdb0;
        }
        .loading {
          padding: 60px 0;
          text-align: center;
          color: #8a8070;
        }
        .board {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          grid-template-rows: repeat(9, 1fr);
          aspect-ratio: 1;
          width: 100%;
          background: #2e2a24;
          gap: 1px;
          border-radius: 8px;
          overflow: hidden;
        }
        .cell {
          background: #fffdf7;
          border: none;
          font-size: clamp(0.75rem, 4vw, 1.1rem);
          font-weight: 700;
          color: #2e2a24;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
        }
        .cell--given { color: #57432c; }
        .cell--editable { color: #d97757; }
        .cell--peer { background: #f2ead8; }
        .cell--match { background: #e4d9bd; }
        .cell--selected { background: #cfe0c4; }
        .cell--wrong { background: #f6d2ce; color: #b6493a; }
        .cell--boxleft { box-shadow: inset 2px 0 0 #2e2a24; }
        .cell--boxtop { box-shadow: inset 0 2px 0 #2e2a24; }
        .notes {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          width: 100%;
          height: 100%;
          font-size: 0.5rem;
          font-weight: 600;
          color: #8a8070;
        }
        .notes__cell { display: flex; align-items: center; justify-content: center; }
        .interstitial {
          position: absolute;
          inset: 0;
          background: rgba(20, 18, 14, 0.85);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20;
        }
        .interstitial__panel { text-align: center; color: #fffdf7; }
        .interstitial__label { font-size: 0.8rem; opacity: 0.75; margin-bottom: 10px; }
        .interstitial__screen {
          width: 200px;
          height: 130px;
          background: #000;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          color: rgba(255,255,255,0.5);
          margin: 0 auto 12px;
        }
        .interstitial__countdown { font-size: 0.8rem; opacity: 0.8; }
        .interstitial__skip {
          background: #e0a458;
          border: none;
          color: #2e2a24;
          font-weight: 700;
          padding: 8px 18px;
          border-radius: 999px;
          cursor: pointer;
        }
        .result {
          position: absolute;
          inset: 0;
          background: rgba(250, 246, 236, 0.97);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 15;
        }
        .result__panel { text-align: center; padding: 20px; }
        .result__eyebrow { margin: 0 0 6px; font-size: 0.85rem; color: #8a8070; }
        .result__panel h3 { margin: 0 0 14px; font-size: 1.8rem; color: #d97757; }
        .continue-btn {
          background: #8fae7f;
          border: 3px solid #2e2a24;
          color: #fffdf7;
          padding: 12px 24px;
          border-radius: 999px;
          font-weight: 700;
          width: 100%;
          cursor: pointer;
          max-width: 220px;
        }
        .share-btn {
          margin-top: 10px;
          background: transparent;
          border: 2px solid #d9cdb0;
          color: #57432c;
          padding: 8px 16px;
          border-radius: 999px;
          width: 100%;
          max-width: 220px;
          cursor: pointer;
        }
        .tools {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-top: 12px;
        }
        .tool-btn {
          background: #faf6ec;
          border: 2px solid #d9cdb0;
          color: #57432c;
          border-radius: 10px;
          padding: 8px 2px;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
        }
        .tool-btn--active { background: #cfe0c4; border-color: #8fae7f; }
        .tool-btn:disabled { opacity: 0.4; cursor: default; }
        .numpad {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          margin-top: 8px;
        }
        .num-btn {
          background: #fffdf7;
          border: 2px solid #d9cdb0;
          color: #2e2a24;
          border-radius: 10px;
          padding: 10px 0;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
        }
        .num-btn:disabled { opacity: 0.3; cursor: default; }
        .num-btn--erase { background: #f6d2ce; border-color: #e3a89f; }
        .hint-text { text-align: center; color: #8a8070; font-size: 0.8rem; margin-top: 10px; }
      `}</style>
    </div>
  );
}
