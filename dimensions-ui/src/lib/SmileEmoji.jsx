import { useId } from 'react'

// 😊 Smiling face with smiling eyes and blush. Drawn on a 64×64 grid, filled.
export default function SmileEmoji({ size = 64, title, style, ...rest }) {
  const g = 'smi' + useId().replace(/:/g, '')
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
      <path d="M15 29Q21 21 27 29M37 29Q43 21 49 29" fill="none" stroke="#5a3510" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="14" cy="40" rx="5" ry="3.5" fill="#ff7a8a" opacity=".6" />
      <ellipse cx="50" cy="40" rx="5" ry="3.5" fill="#ff7a8a" opacity=".6" />
      <path d="M19 40Q32 54 45 40" fill="none" stroke="#5a3510" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}
