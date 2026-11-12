import { useId } from 'react'

// 👍 Thumbs up: a hand with a raised thumb and a sleeve cuff.
export default function ThumbsUpEmoji({ size = 64, title, style, ...rest }) {
  const g = 'thu' + useId().replace(/:/g, '')
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
      <path
        d="M22 28H30C34 20 34 12 38 9C44 7 47 15 43 26H54C58 26 59 31 57 34C59 37 58 40 56 42C58 46 55 49 53 50C54 53 51 57 48 57H28C25 57 22 56 22 53Z"
        fill={`url(#${g})`}
      />
      <path d="M44 34H56M43 42H54M41 50H51" stroke="#c98a50" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="6" y="26" width="14" height="33" rx="3.5" fill="#4a6cf7" />
    </svg>
  )
}
