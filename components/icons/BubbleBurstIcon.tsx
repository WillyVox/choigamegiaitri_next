import type { SVGProps } from 'react';

export default function BubbleBurstIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="bubble-burst-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2f6a" />
          <stop offset="1" stopColor="#0b0e26" />
        </linearGradient>
        <radialGradient id="bubble-burst-magenta" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffb3d6" />
          <stop offset="0.55" stopColor="#ff4f9a" />
          <stop offset="1" stopColor="#ff4f9a" />
        </radialGradient>
        <radialGradient id="bubble-burst-teal" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#b8fbef" />
          <stop offset="0.55" stopColor="#33e6c2" />
          <stop offset="1" stopColor="#33e6c2" />
        </radialGradient>
        <radialGradient id="bubble-burst-gold" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff0c2" />
          <stop offset="0.55" stopColor="#ffd166" />
          <stop offset="1" stopColor="#ffd166" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#bubble-burst-bg)" />
      <circle cx="130" cy="120" r="3" fill="#fff" opacity="0.7" />
      <circle cx="410" cy="90" r="2.5" fill="#fff" opacity="0.6" />
      <circle cx="440" cy="200" r="2" fill="#fff" opacity="0.5" />
      <circle cx="90" cy="260" r="2" fill="#fff" opacity="0.5" />

      <circle cx="196" cy="300" r="92" fill="url(#bubble-burst-teal)" />
      <circle cx="330" cy="230" r="72" fill="url(#bubble-burst-magenta)" />
      <circle cx="330" cy="370" r="58" fill="url(#bubble-burst-gold)" />
    </svg>
  );
}
