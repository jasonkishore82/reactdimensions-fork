import { useId } from 'react'

// 😂 Face with tears of joy. Drawn on a 64×64 grid, filled, so it scales cleanly.
export default function JoyEmoji({ size = 64, title, style, ...rest }) {
  const g = 'joy' + useId().replace(/:/g, '')
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
      <circle cx="32" cy="32" r="30" fill={`url(#${g})`} />
      <path d="M14 24Q20 17 27 25M37 25Q44 17 50 24" fill="none" stroke="#5a3510" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M14 36H50Q50 54 32 54Q14 54 14 36Z" fill="#5a2a10" />
      <path d="M16 36H48Q47 41 32 41Q17 41 16 36Z" fill="#fff" />
      <ellipse cx="32" cy="50" rx="9" ry="4.5" fill="#e8574d" />
      <path d="M9 28Q3 33 6 39Q12 38 9 28ZM55 28Q61 33 58 39Q52 38 55 28Z" fill="#4fc3f7" />
    </svg>
  )
}
