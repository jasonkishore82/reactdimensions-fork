import { useEffect, useRef } from 'react'

// Letters scatter away from the cursor and spring back. Each letter is pushed
// directly away from the pointer, hardest when it's close (a smooth falloff
// over the radius), and spins a little as it's knocked aside. A damped spring
// pulls it home, so they bob back into the line once the pointer moves on.
export default function RepelText({
  text = 'Keep your distance',
  radius = 110,
  force = 60,
  spin = 25,
  stiffness = 160,
  damping = 11,
  style,
}) {
  const root = useRef()
  const spans = useRef([])

  useEffect(() => {
    const L = spans.current.filter(Boolean).map((s) => ({ s, x: 0, y: 0, vx: 0, vy: 0, cx: 0, cy: 0 }))
    let px = -1e6
    let py = -1e6
    let inside = false
    let raf = 0
    let last = 0
    const measure = () => {
      for (const l of L) {
        const r = l.s.getBoundingClientRect()
        l.cx = r.left + r.width / 2 - l.x
        l.cy = r.top + r.height / 2 - l.y
      }
    }
    const frame = (now) => {
      last ||= now
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      let busy = inside
      for (const l of L) {
        let tx = 0
        let ty = 0
        if (inside) {
          const dx = l.cx - px
          const dy = l.cy - py
          const d = Math.hypot(dx, dy) || 1
          // push grows as the pointer gets closer, gone by the radius
          const f = force * Math.max(0, 1 - d / radius) ** 2
          tx = (dx / d) * f
          ty = (dy / d) * f
        }
        l.vx += (stiffness * (tx - l.x) - damping * l.vx) * dt
        l.vy += (stiffness * (ty - l.y) - damping * l.vy) * dt
        l.x += l.vx * dt
        l.y += l.vy * dt
        if (Math.abs(l.x) + Math.abs(l.y) + Math.abs(l.vx) + Math.abs(l.vy) > 0.03) busy = true
        l.s.style.transform = `translate(${l.x.toFixed(2)}px, ${l.y.toFixed(2)}px) rotate(${((l.x / force) * spin).toFixed(2)}deg)`
      }
      raf = busy ? requestAnimationFrame(frame) : 0
      if (!busy) last = 0
    }
    const move = (e) => {
      const r = root.current.getBoundingClientRect()
      const was = inside
      px = e.clientX
      py = e.clientY
      inside = px > r.left - radius && px < r.right + radius && py > r.top - radius && py < r.bottom + radius
      if (inside && !was) measure()
      if ((inside || was) && !raf) raf = requestAnimationFrame(frame)
    }
    measure()
    window.addEventListener('pointermove', move)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [text, radius, force, spin, stiffness, damping])

  return (
    <span ref={root} aria-label={text} style={{ display: 'inline-block', whiteSpace: 'pre', ...style }}>
      {[...String(text)].map((c, i) => (
        <span key={`${i}-${c}`} ref={(el) => (spans.current[i] = el)} aria-hidden="true" style={{ display: 'inline-block', willChange: 'transform' }}>
          {c}
        </span>
      ))}
    </span>
  )
}
