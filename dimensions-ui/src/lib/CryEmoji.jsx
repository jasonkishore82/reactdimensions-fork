import { useId } from 'react'

// 😭 Loudly crying face: squeezed eyes, wailing mouth and streaming tears.
export default function CryEmoji({ size = 64, title, style, ...rest }) {
  const g = 'cry' + useId().replace(/:/g, '')
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
      <path d="M13 20L26 17M51 20L38 17" stroke="#5a3510" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 29Q20 22 27 29M37 29Q44 22 50 29" fill="none" stroke="#5a3510" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M18 54Q32 33 46 54Q32 47 18 54Z" fill="#5a2a10" />
      <path d="M20 31Q10 42 14 56M44 31Q54 42 50 56" fill="none" stroke="#4fc3f7" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
