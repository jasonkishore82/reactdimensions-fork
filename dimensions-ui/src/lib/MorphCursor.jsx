import { useEffect, useRef, useState } from 'react'

// Custom cursor that changes shape with what it is over, inside this area:
//   links / buttons  -> the ring grows and fills
//   [data-cursor=drag] -> the ring widens and shows arrows
//   text (p, h1-h6, [data-cursor=text]) -> it becomes a text bar
// The ring trails the dot on a spring. Mouse only: touch and pen keep the
// normal behaviour. Under reduced motion the ring follows without lag.

const kindOf = (el) => {
  const t = el?.closest?.('[data-cursor], a, button, p, h1, h2, h3, h4, h5, h6')
  if (!t) return 'default'
  if (t.dataset.cursor) return t.dataset.cursor
  if (t.tagName === 'A' || t.tagName === 'BUTTON') return 'link'
  return 'text'
}

export default function MorphCursor({ children, color = '#ff4d1a', size = 34, stiffness = 260, damping = 24, style }) {
  const wrap = useRef(null)
  const ring = useRef(null)
  const dot = useRef(null)
  const s = useRef({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 })
  const [kind, setKind] = useState('default')
  const [inside, setInside] = useState(false)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const p = s.current
      if (reduce) { p.x = p.tx; p.y = p.ty }
      else {
        p.vx += (-stiffness * (p.x - p.tx) - damping * p.vx) * dt
        p.vy += (-stiffness * (p.y - p.ty) - damping * p.vy) * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
      }
      if (ring.current) ring.current.style.transform = `translate(${p.x}px, ${p.y}px)`
      if (dot.current) dot.current.style.transform = `translate(${p.tx}px, ${p.ty}px)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [stiffness, damping])

  const onMove = (e) => {
    if (e.pointerType !== 'mouse') return
    const r = wrap.current.getBoundingClientRect()
    s.current.tx = e.clientX - r.left
    s.current.ty = e.clientY - r.top
    if (!inside) { s.current.x = s.current.tx; s.current.y = s.current.ty; setInside(true) }
    setKind(kindOf(e.target))
  }

  const shape = {
    default: { w: size, h: size, r: '50%', bg: 'transparent', border: 2 },
    link: { w: size * 1.9, h: size * 1.9, r: '50%', bg: `${color}33`, border: 2 },
    drag: { w: size * 2.4, h: size * 1.3, r: '999px', bg: color, border: 0 },
    text: { w: 3, h: size * 0.9, r: '2px', bg: color, border: 0 },
  }[kind] ?? { w: size, h: size, r: '50%', bg: 'transparent', border: 2 }

  return (
    <div
      ref={wrap}
      className="mc"
      onPointerMove={onMove}
      onPointerLeave={() => setInside(false)}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
    >
      <style>{`
        @media (pointer: fine) { .mc, .mc * { cursor: none !important; } }
        .mc-demo { height: 100%; display: grid; place-content: center; gap: 22px; padding: 24px; text-align: center; font: 400 15px/1.5 system-ui, sans-serif; color: #2b2925; }
        .mc-demo h3 { margin: 0; font: 400 34px/1.1 Georgia, serif; }
        .mc-demo p { margin: 0 auto; max-width: 34ch; color: #6b665c; }
        .mc-row { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
        .mc-btn { border: 0; border-radius: 999px; padding: 11px 20px; background: #1c1a16; color: #fff; font: 600 13px/1 system-ui, sans-serif; }
        .mc-chip { border-radius: 10px; padding: 11px 20px; background: #e8e3d8; font: 600 13px/1 system-ui, sans-serif; user-select: none; }
      `}</style>
      {children ?? (
        <div className="mc-demo">
          <h3>Point at things</h3>
          <p>The cursor reads what it is over: this paragraph turns it into a text bar.</p>
          <div className="mc-row">
            <button className="mc-btn" type="button">A button</button>
            <span className="mc-chip" data-cursor="drag">Drag area</span>
          </div>
        </div>
      )}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', opacity: inside ? 1 : 0, transition: 'opacity 150ms' }}>
        <div ref={ring} style={{ position: 'absolute' }}>
          <div
            style={{
              width: shape.w, height: shape.h, borderRadius: shape.r, background: shape.bg,
              border: `${shape.border}px solid ${color}`, transform: 'translate(-50%, -50%)',
              transition: 'width 220ms, height 220ms, border-radius 220ms, background 220ms',
              display: 'grid', placeItems: 'center', color: '#fff', font: '700 11px/1 system-ui, sans-serif', letterSpacing: '.08em',
            }}
          >
            {kind === 'drag' && '← DRAG →'}
          </div>
        </div>
        <div ref={dot} style={{ position: 'absolute' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, transform: 'translate(-50%, -50%)', opacity: kind === 'default' ? 1 : 0, transition: 'opacity 150ms' }} />
        </div>
      </div>
    </div>
  )
}
