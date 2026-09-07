import type { SVGProps } from 'react';

export default function ChaosOrNahIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="chaos-or-nah-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8c6bff" />
          <stop offset="1" stopColor="#2e2060" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#chaos-or-nah-bg)" />
      <ellipse cx="176" cy="140" rx="150" ry="70" fill="#ffffff" opacity="0.1" />

      <g transform="translate(256 256) rotate(-10)">
        <rect x="-108" y="-108" width="216" height="216" rx="36" fill="#fffdf7" />
        <rect x="-108" y="-108" width="216" height="216" rx="36" fill="none" stroke="#2e2060" strokeWidth="4" opacity="0.08" />
        <circle cx="-52" cy="-52" r="16" fill="#ff4f9a" />
        <circle cx="52" cy="-52" r="16" fill="#2e2060" />
        <circle cx="-52" cy="0" r="16" fill="#2e2060" />
        <circle cx="52" cy="0" r="16" fill="#2e2060" />
        <circle cx="-52" cy="52" r="16" fill="#2e2060" />
        <circle cx="52" cy="52" r="16" fill="#ff4f9a" />
      </g>
    </svg>
  );
}
