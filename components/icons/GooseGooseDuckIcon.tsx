import type { SVGProps } from 'react';

export default function GooseGooseDuckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="ggd-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2fa6a6" />
          <stop offset="1" stopColor="#1c7373" />
        </linearGradient>
        <linearGradient id="ggd-duck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="1" stopColor="#fff8ec" />
        </linearGradient>
        <linearGradient id="ggd-bill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffc257" />
          <stop offset="1" stopColor="#f5a623" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="116" fill="url(#ggd-bg)" />
      <ellipse cx="176" cy="140" rx="150" ry="70" fill="#ffffff" opacity="0.06" />

      {/* water ripples */}
      <path d="M60 392 Q106 372 152 392 T244 392 T336 392 T428 392" stroke="#eafcfa" strokeWidth="8" fill="none" opacity="0.25" />
      <path d="M40 424 Q86 404 132 424 T224 424 T316 424 T408 424" stroke="#eafcfa" strokeWidth="8" fill="none" opacity="0.18" />

      {/* back goose (left) */}
      <g opacity="0.55">
        <ellipse cx="140" cy="332" rx="54" ry="42" fill="#dff3f0" />
        <circle cx="94" cy="286" r="26" fill="#dff3f0" />
        <path d="M72 282 L46 276 L72 296 Z" fill="#f5a623" opacity="0.85" />
        <circle cx="86" cy="280" r="4.5" fill="#1c7373" />
      </g>

      {/* back goose (right) */}
      <g opacity="0.7">
        <ellipse cx="392" cy="322" rx="58" ry="46" fill="#eafcfa" />
        <circle cx="440" cy="272" r="28" fill="#eafcfa" />
        <path d="M464 268 L492 260 L464 284 Z" fill="#f5a623" opacity="0.9" />
        <circle cx="450" cy="264" r="5" fill="#1c7373" />
      </g>

      {/* front duck (main subject) */}
      <g>
        <ellipse cx="256" cy="356" rx="98" ry="70" fill="url(#ggd-duck)" />
        <circle cx="256" cy="240" r="72" fill="url(#ggd-duck)" />
        {/* wing */}
        <path d="M300 340 Q356 330 344 396 Q308 404 288 372 Z" fill="#f2e9d3" />
        {/* bill */}
        <path d="M212 244 Q140 240 138 262 Q140 284 212 268 Z" fill="url(#ggd-bill)" />
        <circle cx="150" cy="256" r="4.5" fill="#c97e12" />
        {/* eye */}
        <circle cx="242" cy="222" r="9" fill="#173238" />
        <circle cx="245" cy="219" r="3" fill="#ffffff" />
        {/* cheek blush */}
        <ellipse cx="288" cy="248" rx="14" ry="9" fill="#ff9fae" opacity="0.5" />
      </g>

      {/* highlight accent */}
      <circle cx="188" cy="168" r="16" fill="#ffffff" opacity="0.18" />
    </svg>
  );
}
