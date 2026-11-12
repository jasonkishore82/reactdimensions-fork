import { useId } from 'react'

// 🙏 Folded hands: two mirrored hands pressed together above a pair of cuffs.
export default function PrayEmoji({ size = 64, title, style, ...rest }) {
  const g = 'pry' + useId().replace(/:/g, '')
  const hand = 'M32 5C27 5 25 10 24 16L17 37C15 43 18 50 26 52L32 53Z'
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
          <stop offset="0" stopColor="#ffd9a8" />
          <stop offset="1" stopColor="#f0a860" />
        </linearGradient>
      </defs>
      <path d={hand} fill={`url(#${g})`} />
      <path d={hand} fill={`url(#${g})`} transform="translate(64 0) scale(-1 1)" />
      <path d="M32 5V53" stroke="#b9743a" strokeWidth="1.5" />
      <path d="M25 24L29 30M23 30L28 36M22 36L27 42M39 24L35 30M41 30L36 36M42 36L37 42" stroke="#c98a50" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <rect x="15" y="52" width="34" height="8" rx="3" fill="#4a6cf7" />
    </svg>
  )
}
