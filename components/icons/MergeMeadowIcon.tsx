import type { SVGProps } from 'react';

export default function MergeMeadowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="merge-meadow-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe0b0" />
          <stop offset="1" stopColor="#ff9d6b" />
        </linearGradient>
        <radialGradient id="merge-meadow-apple" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#ffe9cf" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#merge-meadow-bg)" />
      <ellipse cx="176" cy="140" rx="150" ry="70" fill="#ffffff" opacity="0.18" />

      {/* small orbiting fruit */}
      <circle cx="140" cy="360" r="34" fill="#ffd166" opacity="0.9" />
      <circle cx="372" cy="150" r="26" fill="#8fae7f" opacity="0.9" />

      {/* main apple */}
      <path
        d="M256 190
           C 330 190, 372 244, 366 308
           C 360 366, 316 410, 256 410
           C 196 410, 152 366, 146 308
           C 140 244, 182 190, 256 190 Z"
        fill="url(#merge-meadow-apple)"
      />
      <path d="M256 190 C 246 160, 246 138, 262 118" stroke="#8fae7f" strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d="M262 130 C 288 118, 306 122, 316 140" fill="#8fae7f" />
    </svg>
  );
}
