import type { SVGProps } from 'react';

const PETAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export default function PlantsVsBugsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="pvb-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3c6b28" />
          <stop offset="1" stopColor="#12200c" />
        </linearGradient>
        <linearGradient id="pvb-petal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe37a" />
          <stop offset="1" stopColor="#ffb020" />
        </linearGradient>
        <linearGradient id="pvb-center" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a2b" />
          <stop offset="1" stopColor="#5a3618" />
        </linearGradient>
        <linearGradient id="pvb-bug" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9c5334" />
          <stop offset="1" stopColor="#5d2f16" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="116" fill="url(#pvb-bg)" />
      <ellipse cx="170" cy="130" rx="150" ry="70" fill="#ffffff" opacity="0.06" />

      {/* pea motion trail */}
      <path d="M198 244 L296 264 L198 288 Z" fill="#b6ff3c" opacity="0.35" />
      <path d="M228 250 L310 264 L228 278 Z" fill="#b6ff3c" opacity="0.55" />

      {/* pea projectile */}
      <circle cx="318" cy="264" r="15" fill="#c8ff5e" />
      <circle cx="313" cy="259" r="5" fill="#eaffb0" opacity="0.8" />

      {/* stem and leaf */}
      <path d="M186 232 L186 356" stroke="#3f7d2c" strokeWidth="16" strokeLinecap="round" />
      <path d="M186 292 C 150 286 128 306 118 336 C 156 336 180 320 186 292 Z" fill="#4c9235" />

      {/* sunflower petals */}
      <g fill="url(#pvb-petal)">
        {PETAL_ANGLES.map((angle) => (
          <ellipse
            key={angle}
            cx="186"
            cy="112"
            rx="22"
            ry="54"
            transform={angle === 0 ? undefined : `rotate(${angle} 186 176)`}
          />
        ))}
      </g>

      {/* sunflower center */}
      <circle cx="186" cy="176" r="46" fill="url(#pvb-center)" />
      <circle cx="172" cy="164" r="6" fill="#c98a3a" opacity="0.6" />
      <circle cx="196" cy="180" r="5" fill="#c98a3a" opacity="0.6" />
      <circle cx="180" cy="192" r="4" fill="#c98a3a" opacity="0.6" />

      {/* bug legs */}
      <g stroke="#3a1c0d" strokeWidth="7" strokeLinecap="round">
        <path d="M312 300 L288 322" />
        <path d="M330 312 L316 336" />
        <path d="M350 312 L360 338" />
        <path d="M368 300 L392 320" />
      </g>

      {/* bug antennae */}
      <path d="M328 268 L306 240" stroke="#3a1c0d" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M352 268 L374 240" stroke="#3a1c0d" strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="304" cy="236" r="6" fill="#3a1c0d" />
      <circle cx="376" cy="236" r="6" fill="#3a1c0d" />

      {/* bug body */}
      <ellipse cx="340" cy="304" rx="60" ry="42" fill="url(#pvb-bug)" transform="rotate(-8 340 304)" />
      <ellipse cx="340" cy="304" rx="60" ry="42" fill="none" stroke="#2a1408" strokeWidth="4" transform="rotate(-8 340 304)" />
      <path d="M340 264 L340 344" stroke="#2a1408" strokeWidth="4" transform="rotate(-8 340 304)" />

      {/* bug head */}
      <circle cx="290" cy="286" r="26" fill="url(#pvb-bug)" />
      <circle cx="282" cy="280" r="5" fill="#ffe37a" />
      <circle cx="298" cy="280" r="5" fill="#ffe37a" />
    </svg>
  );
}
