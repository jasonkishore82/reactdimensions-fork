import { useRef, useState } from 'react'

// Drafting-paper background with major/minor grid lines and a crosshair
// that follows the cursor and reads out its coordinates.
export default function DraftingGrid({
  children,
  cell = 24,
  major = 5,
  color = '#15171a',
  accent = '#ff4d1a',
  crosshair = true,
  background = '#efece4',
  style,
}) {
  const el = useRef(null)
  const [pos, setPos] = useState(null)
  const minor = `${color}14`
  const majorC = `${color}29`
  const big = cell * major

  return (
    <div
      ref={el}
      onPointerMove={(e) => {
        const r = el.current.getBoundingClientRect()
        setPos({ x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) })
      }}
      onPointerLeave={() => setPos(null)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background,
        backgroundImage: `linear-gradient(${majorC} 1px, transparent 1px), linear-gradient(90deg, ${majorC} 1px, transparent 1px), linear-gradient(${minor} 1px, transparent 1px), linear-gradient(90deg, ${minor} 1px, transparent 1px)`,
        backgroundSize: `${big}px ${big}px, ${big}px ${big}px, ${cell}px ${cell}px, ${cell}px ${cell}px`,
        ...style,
      }}
    >
      {crosshair && pos && (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
          <span style={{ position: 'absolute', left: 0, right: 0, top: pos.y, height: 1, background: `${accent}99` }} />
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: pos.x, width: 1, background: `${accent}99` }} />
          <span
            style={{
              position: 'absolute',
              left: pos.x + 10,
              top: pos.y + 10,
              padding: '4px 6px',
              background: accent,
              color: '#fff',
              font: '500 10px/1 ui-monospace, Menlo, monospace',
              letterSpacing: '0.06em',
              whiteSpace: 'pre',
            }}
          >
            {`x ${String(pos.x).padStart(4)}  y ${String(pos.y).padStart(4)}`}
          </span>
        </div>
      )}
      <div style={{ position: 'relative', height: '100%' }}>{children}</div>
    </div>
  )
}
