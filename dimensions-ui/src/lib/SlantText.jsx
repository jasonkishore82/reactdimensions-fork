import { useEffect, useRef } from 'react'

// Letters lean toward the pointer, like grass bending toward a hand: each
// letter's slant follows where the cursor is to its left or right, strongest
// for the letters level with it, and rides a spring so the lean sways and
// settles. Move away and they stand back up.
export default function SlantText({
  text = 'Leaning toward you',
  maxSlant = 22,
  reach = 160,
  stiffness = 140,
  damping = 12,
  style,
}) {
  const root = useRef()
  const spans = useRef([])

  useEffect(() => {
    const L = spans.current.filter(Boolean).map((s) => ({ s, a: 0, v: 0, cx: 0, cy: 0 }))
    let px = 0
    let py = 0
    let inside = false
    let raf = 0
    let last = 0
    const measure = () => {
      for (const l of L) {
        const r = l.s.getBoundingClientRect()
        l.cx = r.left + r.width / 2
        l.cy = r.top + r.height / 2
      }
    }
    const frame = (now) => {
      last ||= now
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      let busy = inside
      for (const l of L) {
        let target = 0
        if (inside) {
          // which side the pointer is on sets the lean, how level it is sets how much
          const side = Math.tanh((px - l.cx) / (reach * 0.5))
          const level = Math.exp(-(((py - l.cy) / reach) ** 2))
          target = maxSlant * side * level
        }
        l.v += (stiffness * (target - l.a) - damping * l.v) * dt
        l.a += l.v * dt
        if (Math.abs(l.a) + Math.abs(l.v) > 0.02) busy = true
        // skew leans the top of the letter; keep the baseline planted
        l.s.style.transform = `skewX(${(-l.a).toFixed(2)}deg)`
      }
      raf = busy ? requestAnimationFrame(frame) : 0
      if (!busy) last = 0
    }
    const move = (e) => {
      const r = root.current.getBoundingClientRect()
      const was = inside
      px = e.clientX
      py = e.clientY
      inside = px > r.left - reach && px < r.right + reach && py > r.top - reach && py < r.bottom + reach
      if (inside && !was) measure()
      if ((inside || was) && !raf) raf = requestAnimationFrame(frame)
    }
    window.addEventListener('pointermove', move)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
    }
  }, [text, maxSlant, reach, stiffness, damping])

  return (
    <span ref={root} aria-label={text} style={{ display: 'inline-block', whiteSpace: 'pre', ...style }}>
      {[...String(text)].map((c, i) => (
        <span key={`${i}-${c}`} ref={(el) => (spans.current[i] = el)} aria-hidden="true" style={{ display: 'inline-block', transformOrigin: '50% 85%', willChange: 'transform' }}>
          {c}
        </span>
      ))}
    </span>
  )
}
