import { useId } from 'react'

// 😍 Smiling face with heart eyes. Drawn on a 64×64 grid, filled, so it scales cleanly.
export default function HeartEyesEmoji({ size = 64, title, style, ...rest }) {
  const g = 'hey' + useId().replace(/:/g, '')
  const heart = 'M0 8C-9 2-8-6-3-6C-1-6 0-4 0-3C0-4 1-6 3-6C8-6 9 2 0 8Z'
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
      <path d={heart} transform="translate(20 27) scale(1.6)" fill="#e0243a" />
      <path d={heart} transform="translate(44 27) scale(1.6)" fill="#e0243a" />
      <path d="M16 39Q32 62 48 39Z" fill="#5a2a10" />
      <path d="M22 41Q32 45 42 41Q32 43 22 41Z" fill="#fff" />
    </svg>
  )
}
