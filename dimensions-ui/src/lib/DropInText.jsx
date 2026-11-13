import { useEffect, useRef } from 'react'

// Letters fall into place from above, one after another, and bounce on the
// baseline. Each letter is a little falling body: gravity pulls it down, and
// when it hits the line it rebounds with some of its speed (the bounciness),
// so the bounces get smaller and quicker until it settles. A short squash on
// each landing sells the weight.
export default function DropInText({
  text = 'Falling into place',
  stagger = 55,
  height = 1.6,
  gravity = 60,
  bounciness = 0.45,
  trigger = 'mount',
  style,
}) {
  const spans = useRef([])
  const raf = useRef(0)

  const play = () => {
    cancelAnimationFrame(raf.current)
    const els = spans.current.filter(Boolean)
    const fontPx = parseFloat(getComputedStyle(els[0] ?? document.body).fontSize) || 16
    // positions in em, so the motion scales with the font size
    const g = gravity
    const bodies = els.map((el, i) => ({ el, y: -height, v: 0, start: i * stagger, squash: 0, done: false }))
    for (const b of bodies) {
      b.el.style.opacity = '0'
      b.el.style.transform = `translateY(${-height * fontPx}px)`
    }
    let t0 = 0
    let last = 0
    const frame = (now) => {
      if (!t0) t0 = last = now
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const t = now - t0
      let moving = false
      for (const b of bodies) {
        if (b.done) continue
        moving = true
        if (t < b.start) continue
        b.v += g * dt
        b.y += b.v * dt
        if (b.y >= 0) {
          b.y = 0
          b.squash = Math.min(0.25, b.v * 0.02)
          b.v = -b.v * bounciness
          // too slow to leave the line again: it has landed
          if (Math.abs(b.v) < 0.6) b.done = true
        }
        b.squash *= Math.exp(-dt * 18)
        const sq = b.done ? 0 : b.squash
        b.el.style.opacity = String(Math.min(1, 1 + b.y / height + 0.4))
        b.el.style.transform = b.done ? '' : `translateY(${b.y * fontPx}px) scale(${1 + sq * 0.6}, ${1 - sq})`
      }
      if (moving) raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
  }

  useEffect(() => {
    if (trigger === 'mount') play()
    return () => cancelAnimationFrame(raf.current)
  }, [text, stagger, height, gravity, bounciness, trigger])

  return (
    <span aria-label={text} onPointerEnter={trigger === 'hover' ? play : undefined} style={{ display: 'inline-block', whiteSpace: 'pre', ...style }}>
      {[...text].map((c, i) => (
        <span
          key={`${i}-${c}`}
          ref={(el) => (spans.current[i] = el)}
          aria-hidden="true"
          style={{ display: 'inline-block', transformOrigin: '50% 100%', willChange: 'transform' }}
        >
          {c}
        </span>
      ))}
    </span>
  )
}
