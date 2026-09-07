import type { SVGProps } from 'react';

export default function CrystalBlocksIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="crystal-blocks-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a5adb" />
          <stop offset="1" stopColor="#1c2048" />
        </linearGradient>
        <linearGradient id="crystal-blocks-c1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c7f5f0" />
          <stop offset="1" stopColor="#4fd1c5" />
        </linearGradient>
        <linearGradient id="crystal-blocks-c2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e5daff" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="crystal-blocks-c3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0c2" />
          <stop offset="1" stopColor="#ffd166" />
        </linearGradient>
        <linearGradient id="crystal-blocks-c4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#cfe4ff" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#crystal-blocks-bg)" />
      <ellipse cx="176" cy="140" rx="150" ry="70" fill="#ffffff" opacity="0.08" />

      {/* S-tetromino made of 4 rounded gem blocks */}
      <rect x="150" y="230" width="86" height="86" rx="16" fill="url(#crystal-blocks-c1)" />
      <rect x="236" y="230" width="86" height="86" rx="16" fill="url(#crystal-blocks-c2)" />
      <rect x="236" y="144" width="86" height="86" rx="16" fill="url(#crystal-blocks-c3)" />
      <rect x="322" y="144" width="86" height="86" rx="16" fill="url(#crystal-blocks-c4)" />
    </svg>
  );
}
