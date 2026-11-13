import { useId } from 'react'

// The React Dimensions mark: one swooping "R" whose bowl doubles as the "D".
// "Dimensions" rides the bowl and "eact" runs down the outside of the leg.
// `words={false}` drops the lettering for small sizes (nav, favicon).
export const R_PATH =
  'M168 320 L172 186 L130 172 C150 100 270 42 370 44 C440 46 472 80 462 120 C452 160 380 194 270 236 ' +
  'L376 322 L378 342 L242 344 L240 302 L228 308 L226 318 Z ' +
  'M230 198 L233 150 C254 122 300 102 346 104 C384 106 412 116 422 128 C428 136 420 142 404 147 Z'

export function BrandMark({ words = true, className = 'brand-mark', title }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      className={className}
      viewBox="122 36 352 314"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`rd-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--signal-ink, #ff7a4d)" />
          <stop offset="1" stopColor="var(--signal, #ff4d1a)" />
        </linearGradient>
      </defs>
      <path d={R_PATH} fill={`url(#rd-${id})`} fillRule="evenodd" />
      {words && (
        <g fontFamily="var(--display, Inter, Arial, sans-serif)" fontWeight="700">
          {/* "Dimensions" rides the bowl, just above the counter's top edge */}
          <path id={`rd-arc-${id}`} d="M238 133 C260 106 302 88 356 90" fill="none" />
          <text fontSize="21" fill="var(--paper, #0d0c11)">
            <textPath href={`#rd-arc-${id}`}>Dimensions</textPath>
          </text>
          {/* "eact" runs down the outside of the leg */}
          <path id={`rd-leg-${id}`} d="M290 245 L378 316" fill="none" />
          <text fontSize="30" fill="var(--ink, #f4f2f7)">
            <textPath href={`#rd-leg-${id}`}>eact</textPath>
          </text>
        </g>
      )}
    </svg>
  )
}
