import { useEffect, useRef } from 'react'

// Each word is a card hinged along its top edge. It starts folded up flat,
// facing the sky, then lets go: gravity swings it down like a pendulum, past
// hanging straight, back and forth until friction in the hinge settles it.
// The motion is the real one: theta'' = -w^2 sin(theta) - c theta'.
export default function UnfoldText({
  text = 'Swinging down from the hinge',
  stagger = 110,
  swing = 13,
  friction = 4.5,
  trigger = 'mount',
  style,
}) {
  const words = useRef([])
  const raf = useRef(0)

  const play = () => {
    cancelAnimationFrame(raf.current)
    const els = words.current.filter(Boolean)
    const bodies = els.map((el, i) => ({ el, th: -Math.PI / 2, w: 0, start: i * stagger, done: false }))
    for (const b of bodies) apply(b)
    let t0 = 0
    let last = 0
    const frame = (now) => {
      if (!t0) t0 = last = now
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      let busy = false
      for (const b of bodies) {
        if (b.done) continue
        busy = true
        if (now - t0 < b.start) continue
        // a few substeps keep the pendulum stable at low frame rates
        for (let s = 0; s < 4; s++) {
          const h = dt / 4
          b.w += (-swing * swing * Math.sin(b.th) - friction * b.w) * h
          b.th += b.w * h
        }
        if (Math.abs(b.th) < 0.002 && Math.abs(b.w) < 0.02) {
          b.th = 0
          b.done = true
        }
        apply(b)
      }
      if (busy) raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
  }

  // the card faces away from the light as it tilts, so it darkens a little
  const apply = (b) => {
    const deg = (b.th * 180) / Math.PI
    b.el.style.transform = b.th === 0 && b.done ? '' : `rotateX(${-deg}deg)`
    b.el.style.filter = b.done ? '' : `brightness(${0.55 + 0.45 * Math.cos(b.th)})`
    b.el.style.opacity = b.th <= -Math.PI / 2 + 0.001 ? '0' : '1'
  }

  useEffect(() => {
    if (trigger === 'mount') play()
    return () => cancelAnimationFrame(raf.current)
  }, [text, stagger, swing, friction, trigger])

  const parts = String(text).split(/(\s+)/)
  let n = 0
  return (
    <span aria-label={text} onPointerEnter={trigger === 'hover' ? play : undefined} style={{ perspective: '6em', ...style }}>
      {parts.map((p, i) => {
        if (!p || /^\s+$/.test(p)) return p
        const idx = n++
        return (
          <span key={i} aria-hidden="true" style={{ display: 'inline-block', perspective: '4em' }}>
            <span ref={(el) => (words.current[idx] = el)} style={{ display: 'inline-block', transformOrigin: '50% 0%', willChange: 'transform' }}>
              {p}
            </span>
          </span>
        )
      })}
    </span>
  )
}
