import { useEffect, useRef } from 'react'

// Chrome lettering in the old airbrushed style: the face reflects a world of
// sky above a dark horizon, and that reflection slides across the letters
// as you move the pointer (or drifts slowly by itself), the way a polished
// surface shows the room moving as you walk past. A bright bevel edge and a
// deep drop shadow give it thickness.
export default function ChromeText({
  text = 'CHROME',
  sky = '#9fd3ff',
  horizon = '#3b2a1f',
  idle = true,
  style,
}) {
  const face = useRef()

  useEffect(() => {
    const el = face.current
    const st = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, near: false, t: 0, raf: 0, last: 0 }
    const frame = (now) => {
      st.last ||= now
      const dt = Math.min(0.05, (now - st.last) / 1000)
      st.last = now
      st.t += dt
      if (!st.near && idle) {
        st.tx = 0.5 + 0.45 * Math.sin(st.t * 0.5)
        st.ty = 0.5 + 0.25 * Math.sin(st.t * 0.33 + 1)
      }
      const k = 1 - Math.exp(-dt * (st.near ? 8 : 2))
      st.x += (st.tx - st.x) * k
      st.y += (st.ty - st.y) * k
      // the reflection moves against the pointer, like a mirror
      el.style.backgroundPosition = `${(100 - st.x * 100).toFixed(2)}% ${(100 - st.y * 100).toFixed(2)}%`
      st.raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      st.near = x > -0.4 && x < 1.4 && y > -1 && y < 2
      if (st.near) {
        st.tx = Math.max(0, Math.min(1, x))
        st.ty = Math.max(0, Math.min(1, y))
      }
    }
    st.raf = requestAnimationFrame(frame)
    window.addEventListener('pointermove', move)
    return () => {
      cancelAnimationFrame(st.raf)
      window.removeEventListener('pointermove', move)
    }
  }, [idle])

  // sky fading down to a hard horizon line, dark ground, then a bright
  // bounce near the bottom, all in one tall gradient that slides about
  const chrome = `linear-gradient(178deg, #ffffff 0%, ${sky} 22%, #e9f6ff 44%, #ffffff 47.5%, ${horizon} 48.5%, #6d5240 56%, #d8c2a8 72%, #ffffff 80%, ${sky} 100%)`

  return (
    <span aria-label={text} role="img" style={{ position: 'relative', display: 'inline-block', fontStyle: 'italic', fontWeight: 900, letterSpacing: '0.02em', ...style }}>
      {/* depth: a dark extrusion under the face */}
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, color: '#1b2430', transform: 'translate(0.03em, 0.05em)', textShadow: '0 0.08em 0.12em rgba(0,0,0,.35)' }}>
        {text}
      </span>
      {/* bevel: a thin bright outline just outside the face */}
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, color: 'transparent', WebkitTextStroke: '0.035em #f4f8ff' }}>
        {text}
      </span>
      <span
        ref={face}
        aria-hidden="true"
        style={{ position: 'relative', display: 'inline-block', color: 'transparent', backgroundImage: chrome, backgroundSize: '100% 260%', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextStroke: '0.008em rgba(20,30,45,.55)' }}
      >
        {text}
      </span>
    </span>
  )
}
