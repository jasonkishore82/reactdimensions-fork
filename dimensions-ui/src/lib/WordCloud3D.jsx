import { useEffect, useRef } from 'react'

// Words spread evenly over a sphere (a Fibonacci spiral, so none bunch up at
// the poles) that turns slowly in 3D. Drag to spin it; it keeps the speed you
// gave it and eases back to a slow drift. Words in front are big and sharp,
// words at the back small, faint and soft. Hover a word to pick it out.
export default function WordCloud3D({
  words = 'Motion, Depth, Light, Physics, Spring, Inertia, Orbit, Gravity, Friction, Torque, Mass, Momentum, Bounce, Drift, Shadow, Glass, Metal, Texture, Lens, Focus, Scroll, Hover, Tilt, Rotate',
  radius = 0.36,
  speed = 0.25,
  ink = '#1c1a16',
  accent = '#ff4d1a',
  background = '#f7f7f8',
  style,
}) {
  const box = useRef()
  const spans = useRef([])
  const list = String(words).split(',').map((w) => w.trim()).filter(Boolean)

  useEffect(() => {
    const el = box.current
    const n = list.length
    // Fibonacci sphere
    const pts = list.map((_, i) => {
      const y = 1 - (2 * (i + 0.5)) / n
      const r = Math.sqrt(1 - y * y)
      const th = Math.PI * (3 - Math.sqrt(5)) * i
      return [Math.cos(th) * r, y, Math.sin(th) * r]
    })
    const st = { yaw: 0, pitch: 0.25, wy: speed, wp: 0, drag: null, raf: 0, last: 0 }
    const frame = (now) => {
      st.last ||= now
      const dt = Math.min(0.05, (now - st.last) / 1000)
      st.last = now
      if (!st.drag) {
        st.wy += (speed - st.wy) * (1 - Math.exp(-dt * 0.9))
        st.wp += (0 - st.wp) * (1 - Math.exp(-dt * 0.9))
        st.pitch += (0.25 - st.pitch) * (1 - Math.exp(-dt * 0.4))
      }
      st.yaw += st.wy * dt
      st.pitch = Math.max(-1.2, Math.min(1.2, st.pitch + st.wp * dt))
      const W = el.clientWidth
      const H = el.clientHeight
      const R = Math.min(W, H) * radius * 1.12
      const cy = Math.cos(st.yaw)
      const sy = Math.sin(st.yaw)
      const cp = Math.cos(st.pitch)
      const sp = Math.sin(st.pitch)
      const f = 2.6 // camera distance in sphere radii
      pts.forEach(([x, y, z], i) => {
        const s = spans.current[i]
        if (!s) return
        // yaw about y, then pitch about x
        const x1 = x * cy + z * sy
        const z1 = -x * sy + z * cy
        const y2 = y * cp - z1 * sp
        const z2 = y * sp + z1 * cp
        const k = f / (f - z2) // perspective
        const front = (z2 + 1) / 2
        s.style.transform = `translate(-50%, -50%) translate3d(${(W / 2 + x1 * R * k).toFixed(1)}px, ${(H / 2 + y2 * R * k).toFixed(1)}px, 0) scale(${(0.55 * k).toFixed(3)})`
        s.style.opacity = (0.18 + 0.82 * front).toFixed(3)
        s.style.filter = front < 0.45 ? `blur(${((0.45 - front) * 5).toFixed(2)}px)` : 'none'
        s.style.zIndex = String(Math.round(front * 100))
      })
      st.raf = requestAnimationFrame(frame)
    }
    const down = (e) => {
      st.drag = { x: e.clientX, y: e.clientY, t: performance.now() }
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
    }
    const move = (e) => {
      if (!st.drag) return
      const now = performance.now()
      const dt = Math.max(1, now - st.drag.t) / 1000
      const k = 3 / Math.max(300, el.clientWidth)
      const dyaw = (e.clientX - st.drag.x) * k
      const dpitch = -(e.clientY - st.drag.y) * k
      st.yaw += dyaw
      st.pitch = Math.max(-1.2, Math.min(1.2, st.pitch + dpitch))
      st.wy = dyaw / dt
      st.wp = dpitch / dt
      st.drag = { x: e.clientX, y: e.clientY, t: now }
    }
    const up = () => {
      st.drag = null
      el.style.cursor = ''
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    st.raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(st.raf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [words, radius, speed])

  return (
    <div ref={box} role="list" aria-label="Word cloud" style={{ position: 'relative', isolation: 'isolate', width: '100%', height: '100%', overflow: 'hidden', background, color: ink, cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', ...style }}>
      <style>{`.wc3-w { position: absolute; left: 0; top: 0; white-space: nowrap; will-change: transform; transition: color .2s; } .wc3-w:hover { color: ${accent}; }`}</style>
      {list.map((w, i) => (
        <span key={`${i}-${w}`} role="listitem" ref={(n) => (spans.current[i] = n)} className="wc3-w" style={{ color: i % 5 === 0 ? accent : undefined }}>
          {w}
        </span>
      ))}
    </div>
  )
}
