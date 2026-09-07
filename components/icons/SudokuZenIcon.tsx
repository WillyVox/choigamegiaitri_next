import type { SVGProps } from 'react';

export default function SudokuZenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="sudoku-zen-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3ecd8" />
          <stop offset="1" stopColor="#cfe0c4" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#sudoku-zen-bg)" />
      <ellipse cx="176" cy="140" rx="150" ry="70" fill="#ffffff" opacity="0.35" />

      {/* 3x3 grid */}
      <g stroke="#2e2a24" strokeLinecap="round">
        <rect x="128" y="128" width="256" height="256" rx="18" fill="#fffdf7" strokeWidth="10" />
        <line x1="213.3" y1="128" x2="213.3" y2="384" strokeWidth="4" opacity="0.55" />
        <line x1="298.6" y1="128" x2="298.6" y2="384" strokeWidth="4" opacity="0.55" />
        <line x1="128" y1="213.3" x2="384" y2="213.3" strokeWidth="4" opacity="0.55" />
        <line x1="128" y1="298.6" x2="384" y2="298.6" strokeWidth="4" opacity="0.55" />
      </g>

      {/* a few filled cells, like a puzzle in progress */}
      <rect x="139" y="139" width="64" height="64" rx="10" fill="#d97757" opacity="0.85" />
      <rect x="309" y="224" width="64" height="64" rx="10" fill="#8fae7f" opacity="0.85" />
      <rect x="224" y="309" width="64" height="64" rx="10" fill="#e0a458" opacity="0.85" />
    </svg>
  );
}
