import { useId } from 'react'

// 🔥 Fire: an orange flame with a bright yellow core.
export default function FireEmoji({ size = 64, title, style, ...rest }) {
  const g = 'fir' + useId().replace(/:/g, '')
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
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9a1f" />
          <stop offset="1" stopColor="#e62f1c" />
        </linearGradient>
      </defs>
      <path d="M32 3C34 14 47 20 49 35C51 49 43 61 32 61C21 61 13 51 15 38C16 31 21 28 23 21C26 25 28 28 28 31C32 24 34 14 32 3Z" fill={`url(#${g})`} />
      <path d="M32 61C25 61 22 55 24 49C25 44 30 41 31 35C35 39 41 43 41 51C41 57 37 61 32 61Z" fill="#ffd23f" />
    </svg>
  )
}
