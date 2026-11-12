import { useEffect, useRef } from 'react'

// Drag with inertia and snap-to-grid: fling the tile and it keeps travelling,
// slowing with friction; as it slows it is pulled into the nearest grid cell
// on a spring. Stays inside the area. Arrow keys move it one cell when
// focused. Under reduced motion it snaps straight to the cell on release.

export default function InertiaSnap({ grid = 72, friction = 4, stiffness = 180, damping = 22, tile = 56, color = '#ff4d1a', style }) {
  const area = useRef(null)
  const el = useRef(null)
  const s = useRef({ x: 0, y: 0, vx: 0, vy: 0, drag: false, ox: 0, oy: 0, hist: [], snap: false, tx: 0, ty: 0 })

  useEffect(() => {
    const p = s.current
    const box = area.current.getBoundingClientRect()
    p.x = p.tx = Math.round((box.width / 2 - tile / 2) / grid) * grid + (grid - tile) / 2
    p.y = p.ty = Math.round((box.height / 2 - tile / 2) / grid) * grid + (grid - tile) / 2
    let raf = 0
    let last = performance.now()
    const cellOf = (v, max) => {
      const off = (grid - tile) / 2
      const n = Math.max(0, Math.min(Math.floor((max - tile - off) / grid), Math.round((v - off) / grid)))
      return n * grid + off
    }
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const r = area.current?.getBoundingClientRect()
      if (r && !p.drag) {
        const speed = Math.hypot(p.vx, p.vy)
        if (!p.snap) {
          // coast with friction, bouncing softly off the edges
          p.vx *= Math.exp(-friction * dt)
          p.vy *= Math.exp(-friction * dt)
          p.x += p.vx * dt
          p.y += p.vy * dt
          if (p.x < 0 || p.x > r.width - tile) { p.x = Math.max(0, Math.min(r.width - tile, p.x)); p.vx *= -0.4 }
          if (p.y < 0 || p.y > r.height - tile) { p.y = Math.max(0, Math.min(r.height - tile, p.y)); p.vy *= -0.4 }
          if (speed < 260) { p.snap = true; p.tx = cellOf(p.x + p.vx * 0.12, r.width); p.ty = cellOf(p.y + p.vy * 0.12, r.height) }
        } else {
          p.vx += (-stiffness * (p.x - p.tx) - damping * p.vx) * dt
          p.vy += (-stiffness * (p.y - p.ty) - damping * p.vy) * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
        }
      }
      if (el.current) el.current.style.transform = `translate(${p.x}px, ${p.y}px)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [grid, friction, stiffness, damping, tile])

  const down = (e) => {
    const p = s.current
    const r = area.current.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    p.drag = true
    p.snap = false
    p.ox = e.clientX - r.left - p.x
    p.oy = e.clientY - r.top - p.y
    p.hist = [{ x: e.clientX, y: e.clientY, t: performance.now() }]
  }
  const move = (e) => {
    const p = s.current
    if (!p.drag) return
    const r = area.current.getBoundingClientRect()
    p.x = Math.max(0, Math.min(r.width - tile, e.clientX - r.left - p.ox))
    p.y = Math.max(0, Math.min(r.height - tile, e.clientY - r.top - p.oy))
    p.hist.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    if (p.hist.length > 6) p.hist.shift()
  }
  const up = () => {
    const p = s.current
    if (!p.drag) return
    p.drag = false
    const a = p.hist[0]
    const b = p.hist[p.hist.length - 1]
    const dt = Math.max(0.016, (b.t - a.t) / 1000)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    p.vx = reduce ? 0 : (b.x - a.x) / dt
    p.vy = reduce ? 0 : (b.y - a.y) / dt
  }
  const key = (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!d) return
    e.preventDefault()
    const p = s.current
    const r = area.current.getBoundingClientRect()
    const off = (grid - tile) / 2
    p.snap = true
    p.tx = Math.max(off, Math.min(r.width - tile, p.tx + d[0] * grid))
    p.ty = Math.max(off, Math.min(r.height - tile, p.ty + d[1] * grid))
  }

  return (
    <div
      ref={area}
      style={{
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f4f1ea',
        backgroundImage: `radial-gradient(circle, #cfc8ba 1.5px, transparent 1.6px)`, backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${-grid / 2}px ${-grid / 2}px`,
        ...style,
      }}
    >
      <div
        ref={el}
        role="button"
        tabIndex={0}
        aria-label="Draggable tile. Use arrow keys to move one cell."
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        style={{ position: 'absolute', left: 0, top: 0, width: tile, height: tile, borderRadius: 12, background: color, cursor: 'grab', touchAction: 'none', outlineOffset: 3, display: 'grid', placeItems: 'center', color: '#1c1a16', font: '600 10px/1 ui-monospace, Menlo, monospace', letterSpacing: '.1em' }}
      >
        FLING
      </div>
    </div>
  )
}
