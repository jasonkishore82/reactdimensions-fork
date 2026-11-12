import { useRef, useState } from 'react'

// Hover scrub: moving across the thumbnail scrubs through a short clip.
// Pass `frames` (image URLs) for your own clip; by default it scrubs a drawn
// day cycle. Drag across on touch; arrow keys step frames when focused.
// When the pointer leaves it returns to `restFrame`.

function Day({ t }) {
  // t: 0..1 through the day. Sun arcs across, the sky shifts from dawn to dusk.
  const a = Math.PI * (1 - t)
  const sx = 160 + Math.cos(a) * 120
  const sy = 150 - Math.sin(a) * 100
  const noon = Math.sin(Math.PI * t)
  const mix = (c1, c2, k) => {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
    const [r1, g1, b1] = p(c1)
    const [r2, g2, b2] = p(c2)
    return `rgb(${Math.round(r1 + (r2 - r1) * k)} ${Math.round(g1 + (g2 - g1) * k)} ${Math.round(b1 + (b2 - b1) * k)})`
  }
  const sky = mix('#f2a46b', '#8ec5f0', noon)
  const sun = mix('#ff6a3d', '#fff2b3', noon)
  return (
    <svg viewBox="0 0 320 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="320" height="180" fill={sky} />
      <circle cx={sx} cy={sy} r="16" fill={sun} />
      <path d="M0 140 L60 105 L110 130 L170 92 L230 128 L280 108 L320 124 V180 H0Z" fill={mix('#5b4a6b', '#4f7a5a', noon)} />
      <path d="M0 160 L80 138 L150 156 L220 140 L320 158 V180 H0Z" fill={mix('#3c2f4a', '#355c41', noon)} />
    </svg>
  )
}

export default function HoverScrub({
  frames,
  count = 24,
  restFrame = 0,
  showBar = true,
  accent = '#ff4d1a',
  width = 320,
  style,
}) {
  const n = frames?.length || count
  const [i, setI] = useState(restFrame)
  const box = useRef(null)

  const at = (clientX) => {
    const r = box.current.getBoundingClientRect()
    const k = Math.min(0.9999, Math.max(0, (clientX - r.left) / r.width))
    setI(Math.floor(k * n))
  }

  return (
    <div style={{ width, maxWidth: '100%', ...style }}>
      <div
        ref={box}
        tabIndex={0}
        role="slider"
        aria-label="Scrub clip"
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={i + 1}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && at(e.clientX)}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); at(e.clientX) }}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setI(restFrame)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setI((v) => Math.min(n - 1, v + 1))
          if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
        }}
        style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', cursor: 'ew-resize', touchAction: 'pan-y', outlineOffset: 3, background: '#ddd' }}
      >
        {frames ? <img src={frames[i]} alt="" draggable="false" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <Day t={i / (n - 1)} />}
        <span style={{ position: 'absolute', right: 8, top: 8, font: '500 10px/1 ui-monospace, Menlo, monospace', letterSpacing: '.1em', color: '#fff', background: 'rgba(0,0,0,.35)', padding: '4px 6px', borderRadius: 4 }}>
          {String(i + 1).padStart(2, '0')} / {n}
        </span>
      </div>
      {showBar && (
        <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 2, marginTop: 8 }}>
          {Array.from({ length: n }, (_, k) => (
            <i key={k} style={{ height: 4, borderRadius: 2, background: k <= i ? accent : '#d9d5cc' }} />
          ))}
        </div>
      )}
    </div>
  )
}
