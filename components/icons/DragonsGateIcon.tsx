import type { SVGProps } from 'react';

export default function DragonsGateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="dragons-gate-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffcf86" />
          <stop offset="1" stopColor="#ff6b5b" />
        </linearGradient>
        <linearGradient id="dragons-gate-gate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#fff0da" />
        </linearGradient>
        <radialGradient id="dragons-gate-pearl" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff7e6" />
          <stop offset="0.6" stopColor="#ffd166" />
          <stop offset="1" stopColor="#ff9d4d" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#dragons-gate-bg)" />
      <ellipse cx="176" cy="140" rx="150" ry="70" fill="#ffffff" opacity="0.16" />

      {/* torii-style gate */}
      <rect x="120" y="180" width="30" height="220" rx="10" fill="url(#dragons-gate-gate)" />
      <rect x="362" y="180" width="30" height="220" rx="10" fill="url(#dragons-gate-gate)" />
      <rect x="150" y="252" width="212" height="20" rx="8" fill="url(#dragons-gate-gate)" />
      <path
        d="M96 190 C 160 150, 352 150, 416 190
           C 416 208, 402 214, 386 208
           C 328 176, 184 176, 126 208
           C 110 214, 96 208, 96 190 Z"
        fill="url(#dragons-gate-gate)"
      />

      {/* dragon pearl glowing in the gateway */}
      <circle cx="256" cy="330" r="40" fill="url(#dragons-gate-pearl)" />
      <circle cx="242" cy="316" r="10" fill="#fffdf7" opacity="0.8" />
    </svg>
  );
}
