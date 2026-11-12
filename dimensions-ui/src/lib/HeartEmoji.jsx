import { useId } from 'react'

// ❤️ Red heart. Drawn on a 64×64 grid, filled, so it scales cleanly.
export default function HeartEmoji({ size = 64, title, style, ...rest }) {
  const g = 'hrt' + useId().replace(/:/g, '')
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
          <stop offset="0" stopColor="#ff6b6b" />
          <stop offset="1" stopColor="#d3202f" />
        </radialGradient>
      </defs>
      <path d="M32 57C10 41 5 29 5 21A13.5 13.5 0 0 1 32 17A13.5 13.5 0 0 1 59 21C59 29 54 41 32 57Z" fill={`url(#${g})`} />
      <path d="M13 21Q13 14 20 14" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}
