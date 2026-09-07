import type { SVGProps } from 'react';

export default function SkyStrikeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="sky-strike-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2f5c" />
          <stop offset="1" stopColor="#12142c" />
        </linearGradient>
        <linearGradient id="sky-strike-jet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ef0ff" />
          <stop offset="1" stopColor="#4fc3ff" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#sky-strike-bg)" />
      <ellipse cx="176" cy="140" rx="150" ry="70" fill="#ffffff" opacity="0.06" />

      {/* motion trail */}
      <path d="M120 330 L230 300 L120 280 Z" fill="#ff4f9a" opacity="0.55" />
      <path d="M150 360 L250 330 L150 310 Z" fill="#ff4f9a" opacity="0.35" />

      {/* jet body */}
      <path
        d="M256 90
           L296 300
           L360 350
           L300 335
           L256 380
           L212 335
           L152 350
           L216 300 Z"
        fill="url(#sky-strike-jet)"
      />
      <path d="M256 90 L256 380" stroke="#eafcff" strokeWidth="6" opacity="0.5" />
      <circle cx="256" cy="180" r="14" fill="#12142c" opacity="0.5" />
    </svg>
  );
}
