import type { SVGProps } from 'react';

export default function MagicDodosIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="magic-dodos-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#352761" />
          <stop offset="1" stopColor="#150C29" />
        </linearGradient>
        <linearGradient id="magic-dodos-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3D2FB" />
          <stop offset="1" stopColor="#B18AF0" />
        </linearGradient>
        <linearGradient id="magic-dodos-beak" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE9A8" />
          <stop offset="1" stopColor="#FFC857" />
        </linearGradient>
        <linearGradient id="magic-dodos-egg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF6DC" />
          <stop offset="1" stopColor="#FFC857" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="116" fill="url(#magic-dodos-bg)" />
      <ellipse cx="176" cy="140" rx="150" ry="70" fill="#ffffff" opacity="0.06" />

      {/* magic sparkles */}
      <path d="M394 300 L399 313 L412 318 L399 323 L394 336 L389 323 L376 318 L389 313 Z" fill="#FFC857" opacity="0.85" />
      <path d="M356 400 L360 409 L369 413 L360 417 L356 426 L352 417 L343 413 L352 409 Z" fill="#FFC857" opacity="0.6" />
      <path d="M318 322 L321 329 L328 332 L321 335 L318 342 L315 335 L308 332 L315 329 Z" fill="#F4EEFF" opacity="0.7" />

      {/* legs */}
      <ellipse cx="232" cy="392" rx="13" ry="20" fill="#C98F1E" />
      <ellipse cx="284" cy="392" rx="13" ry="20" fill="#C98F1E" />

      {/* tail tuft */}
      <path d="M356 300 L392 288 L380 312 L392 330 L354 322 Z" fill="#B18AF0" opacity="0.9" />

      {/* body */}
      <ellipse cx="268" cy="302" rx="104" ry="86" fill="url(#magic-dodos-body)" />
      <ellipse cx="310" cy="288" rx="42" ry="56" fill="#7E5AC2" opacity="0.55" />

      {/* head */}
      <circle cx="192" cy="224" r="66" fill="url(#magic-dodos-body)" />

      {/* head tuft feathers */}
      <path d="M164 168 L172 138 L182 166 Z" fill="#FFC857" />
      <path d="M186 160 L196 128 L204 158 Z" fill="#FFC857" />
      <path d="M208 166 L220 138 L226 168 Z" fill="#FFC857" />

      {/* beak */}
      <path
        d="M228 240
           C 270 210, 336 220, 344 252
           C 350 276, 320 288, 296 282
           C 300 296, 284 306, 268 296
           C 250 284, 232 262, 228 240 Z"
        fill="url(#magic-dodos-beak)"
      />
      <circle cx="270" cy="252" r="5" fill="#C98F1E" opacity="0.7" />

      {/* eye */}
      <circle cx="176" cy="212" r="13" fill="#F4EEFF" />
      <circle cx="179" cy="214" r="6.5" fill="#150C29" />

      {/* magic egg */}
      <ellipse cx="352" cy="372" rx="44" ry="56" fill="url(#magic-dodos-egg)" />
      <path d="M330 350 Q352 362 334 380 Q356 392 344 408" stroke="#C98F1E" strokeWidth="4" fill="none" opacity="0.35" />
    </svg>
  );
}
