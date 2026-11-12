import { useId } from 'react'

// 🥺 Pleading face: huge glossy eyes, raised brows and a tiny wobbly mouth.
export default function PleadingEmoji({ size = 64, title, style, ...rest }) {
  const g = 'pld' + useId().replace(/:/g, '')
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
      <path d="M13 21Q19 14 28 19M51 21Q45 14 36 19" fill="none" stroke="#5a3510" strokeWidth="3" strokeLinecap="round" />
      <circle cx="21" cy="31" r="9" fill="#3b2412" />
      <circle cx="43" cy="31" r="9" fill="#3b2412" />
      <circle cx="18" cy="27" r="3.5" fill="#fff" />
      <circle cx="40" cy="27" r="3.5" fill="#fff" />
      <circle cx="24" cy="35" r="1.8" fill="#fff" />
      <circle cx="46" cy="35" r="1.8" fill="#fff" />
      <path d="M26 49Q29 45 32 48Q35 45 38 49" fill="none" stroke="#5a3510" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
