import { useEffect, useRef } from 'react'

// Letters drift toward the cursor as if it were a magnet. The pull on each
// letter falls off with distance, and each letter rides a damped spring back
// to its place, so they lag behind the pointer, overshoot a little and wobble
// home when it leaves.
export default function MagneticText({
  text = 'Magnetic letters',
  strength = 0.25,
  radius = 160,
  stiffness = 170,
  damping = 13,
  style,
}) {
  const root = useRef()
  const spans = useRef([])

  useEffect(() => {
    const el = root.current
    const letters = spans.current.filter(Boolean).map((s) => ({ s, x: 0, y: 0, vx: 0, vy: 0, cx: 0, cy: 0 }))
    let px = 0
    let py = 0
    let inside = false
    let raf = 0
    let last = 0

    // rest positions, measured with the offsets taken out
    const measure = () => {
      for (const L of letters) {
        const r = L.s.getBoundingClientRect()
        L.cx = r.left + r.width / 2 - L.x
        L.cy = r.top + r.height / 2 - L.y
      }
    }
    const frame = (now) => {
      last ||= now
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      let busy = inside
      for (const L of letters) {
        let tx = 0
        let ty = 0
        if (inside) {
          const dx = px - L.cx
          const dy = py - L.cy
          // gaussian falloff: strong nearby, nothing far away
          const f = strength * Math.exp(-(dx * dx + dy * dy) / (radius * radius))
          tx = dx * f
          ty = dy * f
        }
        const ax = stiffness * (tx - L.x) - damping * L.vx
        const ay = stiffness * (ty - L.y) - damping * L.vy
        L.vx += ax * dt
        L.vy += ay * dt
        L.x += L.vx * dt
        L.y += L.vy * dt
        if (Math.abs(L.x) + Math.abs(L.y) + Math.abs(L.vx) + Math.abs(L.vy) > 0.02) busy = true
        L.s.style.transform = `translate(${L.x}px, ${L.y}px)`
      }
      raf = busy ? requestAnimationFrame(frame) : 0
      if (!busy) last = 0
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      px = e.clientX
      py = e.clientY
      const r = el.getBoundingClientRect()
      const was = inside
      inside = px > r.left - radius && px < r.right + radius && py > r.top - radius && py < r.bottom + radius
      if (inside && !was) measure()
      if (inside || was) kick()
    }
    const leave = () => {
      inside = false
      kick()
    }
    measure()
    window.addEventListener('pointermove', move)
    document.addEventListener('pointerleave', leave)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [text, strength, radius, stiffness, damping])

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
