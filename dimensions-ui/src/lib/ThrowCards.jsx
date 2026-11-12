import { useEffect, useRef } from 'react'

// Throwable cards: grab a card and throw it; it flies on, spinning with its
// speed, and bounces off the walls of the area until friction settles it.
// The card you grab comes to the top. Optional gravity drops them to the
// floor. Under reduced motion cards drop where you let go.

const DEFAULT_CARDS = [
  ['#ff4d1a', 'Throw'],
  ['#1d2b4f', 'Bounce'],
  ['#f4d35e', 'Spin'],
  ['#2a9d8f', 'Settle'],
  ['#e8e3d8', 'Again'],
]

export default function ThrowCards({ cards = DEFAULT_CARDS, bounce = 0.7, friction = 1.2, gravity = false, width = 120, height = 160, style }) {
  const area = useRef(null)
  const els = useRef([])
  const bodies = useRef([])
  const drag = useRef(null)
  const z = useRef(cards.length)

  useEffect(() => {
    const r = area.current.getBoundingClientRect()
    bodies.current = cards.map((_, i) => ({
      x: r.width / 2 - width / 2 + (i - (cards.length - 1) / 2) * 34,
      y: r.height / 2 - height / 2 + (i % 2 ? 10 : -10),
      vx: 0, vy: 0, a: (i - 2) * 6, va: 0, z: i,
    }))
    let raf = 0
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const box = area.current?.getBoundingClientRect()
      bodies.current.forEach((b, i) => {
        if (box && drag.current?.i !== i) {
          if (gravity) b.vy += 1600 * dt
          const k = Math.exp(-friction * dt)
          b.vx *= k
          b.vy *= gravity ? 1 : k
          b.va *= Math.exp(-friction * 1.5 * dt)
          b.x += b.vx * dt
          b.y += b.vy * dt
          b.a += b.va * dt
          const maxX = box.width - width
          const maxY = box.height - height
          if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * bounce; b.va *= -0.6 }
          if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx) * bounce; b.va *= -0.6 }
          if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * bounce }
          if (b.y > maxY) {
            b.y = maxY
            b.vy = -Math.abs(b.vy) * bounce
            if (gravity) { b.vx *= 0.92; b.va *= 0.8; if (Math.abs(b.vy) < 40) b.vy = 0 }
          }
        }
        const el = els.current[i]
        if (el) {
          el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.a}deg)`
          el.style.zIndex = b.z
        }
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [cards, bounce, friction, gravity, width, height])

  const down = (i) => (e) => {
    const b = bodies.current[i]
    const r = area.current.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    b.z = ++z.current
    b.vx = b.vy = b.va = 0
    drag.current = { i, ox: e.clientX - r.left - b.x, oy: e.clientY - r.top - b.y, hist: [{ x: e.clientX, y: e.clientY, t: performance.now() }] }
  }
  const move = (e) => {
    const d = drag.current
    if (!d) return
    const b = bodies.current[d.i]
    const r = area.current.getBoundingClientRect()
    b.x = Math.max(0, Math.min(r.width - width, e.clientX - r.left - d.ox))
    b.y = Math.max(0, Math.min(r.height - height, e.clientY - r.top - d.oy))
    d.hist.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    if (d.hist.length > 6) d.hist.shift()
  }
  const up = () => {
    const d = drag.current
    if (!d) return
    drag.current = null
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const a = d.hist[0]
    const c = d.hist[d.hist.length - 1]
    const dt = Math.max(0.016, (c.t - a.t) / 1000)
    const b = bodies.current[d.i]
    b.vx = Math.max(-4000, Math.min(4000, (c.x - a.x) / dt))
    b.vy = Math.max(-4000, Math.min(4000, (c.y - a.y) / dt))
    b.va = b.vx * 0.12
  }

  return (
    <div ref={area} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f4f1ea', touchAction: 'none', ...style }}>
      {cards.map(([c, label], i) => {
        const light = parseInt(c.slice(1, 3), 16) * 0.299 + parseInt(c.slice(3, 5), 16) * 0.587 + parseInt(c.slice(5, 7), 16) * 0.114 > 150
        return (
          <div
            key={i}
            ref={(el) => (els.current[i] = el)}
            onPointerDown={down(i)}
            style={{
              position: 'absolute', left: 0, top: 0, width, height, borderRadius: 14, background: c, color: light ? '#1c1a16' : '#f4f1ea',
              cursor: 'grab', userSelect: 'none', padding: 14, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              border: '1px solid rgba(0,0,0,.08)', boxShadow: '0 10px 24px -12px rgba(20,18,14,.45)',
            }}
          >
            <span style={{ font: '500 9px/1 ui-monospace, Menlo, monospace', letterSpacing: '.14em', opacity: 0.6 }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ font: '400 26px/1 Georgia, serif' }}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}
