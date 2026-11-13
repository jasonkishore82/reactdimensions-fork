import { useEffect, useRef } from 'react'

// Text in a dark room: only the letters near the pointer are lit, by a soft
// round spotlight that follows the cursor with a little lag. The lit layer
// is the same text, bright and glowing, masked to a radial falloff around
// the light. With nobody pointing (idle on), the light rests on the text and
// drifts slowly across it; otherwise it fades out when you leave.
export default function SpotlightText({
  text = 'Only what you point at is lit',
  radius = 140,
  dim = 0.14,
  color = '#1c1a16',
  glow = '#ff9a3c',
  lag = 9,
  idle = true,
  style,
}) {
  const root = useRef()
  const lit = useRef()

  useEffect(() => {
    const el = root.current
    const st = { x: 0, y: 0, tx: 0, ty: 0, r: 0, tr: 0, raf: 0, last: 0, near: false, t: 0 }
    const apply = () => {
      const m = `radial-gradient(circle ${st.r.toFixed(1)}px at ${st.x.toFixed(1)}px ${st.y.toFixed(1)}px, #000 0%, rgba(0,0,0,.55) 45%, transparent 100%)`
      lit.current.style.maskImage = m
      lit.current.style.webkitMaskImage = m
    }
    const frame = (now) => {
      st.last ||= now
      const dt = Math.min(0.05, (now - st.last) / 1000)
      st.last = now
      st.t += dt
      if (idle && !st.near) {
        // a slow wander across the text, like a searchlight
        const r = el.getBoundingClientRect()
        st.tx = r.width * (0.5 + 0.32 * Math.sin(st.t * 0.45))
        st.ty = r.height * (0.5 + 0.18 * Math.sin(st.t * 0.7 + 1))
        st.tr = radius * 0.85
      }
      const k = 1 - Math.exp(-dt * (st.near ? lag : 2))
      st.x += (st.tx - st.x) * k
      st.y += (st.ty - st.y) * k
      st.r += (st.tr - st.r) * (1 - Math.exp(-dt * 7))
      apply()
      const busy = Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) > 0.3 || Math.abs(st.tr - st.r) > 0.3
      st.raf = busy || (idle && !st.near) ? requestAnimationFrame(frame) : 0
      if (!st.raf) st.last = 0
    }
    const kick = () => {
      if (!st.raf) st.raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      const near = x > -radius && x < r.width + radius && y > -radius && y < r.height + radius
      st.near = near
      if (near && st.r < 1) {
        // the light switches on where the pointer is, not where it last was
        st.x = x
        st.y = y
      }
      st.tx = x
      st.ty = y
      st.tr = near ? radius : idle ? radius * 0.85 : 0
      kick()
    }
    if (idle) {
      const r = el.getBoundingClientRect()
      st.x = st.tx = r.width / 2
      st.y = st.ty = r.height / 2
    }
    apply()
    if (idle) kick()
    window.addEventListener('pointermove', move)
    return () => {
      cancelAnimationFrame(st.raf)
      window.removeEventListener('pointermove', move)
    }
  }, [radius, lag, idle])

  return (
    <span ref={root} aria-label={text} style={{ position: 'relative', display: 'inline-block', color, ...style }}>
      <span aria-hidden="true" style={{ opacity: dim }}>
        {text}
      </span>
      <span
        ref={lit}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, textShadow: `0 0 0.18em ${glow}, 0 0 0.5em ${glow}99`, pointerEvents: 'none' }}
      >
        {text}
      </span>
    </span>
  )
}
