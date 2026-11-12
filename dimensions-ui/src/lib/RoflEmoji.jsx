import { useId } from 'react'

// 🤣 Rolling on the floor laughing: the joy face, tilted, with squeezed eyes.
export default function RoflEmoji({ size = 64, title, style, ...rest }) {
  const g = 'rof' + useId().replace(/:/g, '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', ...style }}
      {...rest}
    >
      {title && <title>{title}</title>}
      <defs>
        <radialGradient id={g} cx=".35" cy=".3" r=".85">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="1" stopColor="#f5a623" />
        </radialGradient>
      </defs>
      <g transform="rotate(-20 32 32) translate(4 4) scale(.875)">
        <circle cx="32" cy="32" r="30" fill={`url(#${g})`} />
        <path d="M14 21L27 27L14 33M50 21L37 27L50 33" fill="none" stroke="#5a3510" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 38H50Q50 56 32 56Q14 56 14 38Z" fill="#5a2a10" />
        <path d="M16 38H48Q47 43 32 43Q17 43 16 38Z" fill="#fff" />
        <ellipse cx="32" cy="52" rx="9" ry="4.5" fill="#e8574d" />
        <path d="M8 30Q2 35 5 41Q11 40 8 30ZM56 30Q62 35 59 41Q53 40 56 30Z" fill="#4fc3f7" />
      </g>
    </svg>
  )
}
