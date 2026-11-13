import { useEffect, useRef } from 'react'

// A magnifying glass that follows the pointer over the text. The lens is a
// second copy of the text scaled up around the pointer and clipped to a
// circle, so whatever is under the glass is shown bigger, exactly in place.
// It glides after the cursor and grows in when you arrive.
export default function LensText({
  text = 'Read the fine print',
  zoom = 2.2,
  size = 120,
  lag = 14,
  ring = '#1c1a16',
  paper = '#f7f7f8',
  style,
}) {
  const root = useRef()
  const layer = useRef()
  const glass = useRef()

  useEffect(() => {
    const st = { x: 0, y: 0, tx: 0, ty: 0, s: 0, ts: 0, raf: 0, last: 0 }
    const apply = () => {
      const R = (size / 2) * st.s
      const z = zoom
      // scaling about the lens centre keeps that point fixed; the clip lives in
      // the layer's own (pre-scale) space, so its radius is divided by the zoom
      layer.current.style.transformOrigin = `${st.x}px ${st.y}px`
      layer.current.style.transform = `scale(${z})`
      layer.current.style.clipPath = `circle(${(R / z).toFixed(2)}px at ${st.x.toFixed(2)}px ${st.y.toFixed(2)}px)`
      glass.current.style.transform = `translate(${st.x - size / 2}px, ${st.y - size / 2}px) scale(${st.s})`
      glass.current.style.opacity = st.s > 0.02 ? '1' : '0'
    }
    const frame = (now) => {
      st.last ||= now
      const dt = Math.min(0.05, (now - st.last) / 1000)
      st.last = now
      const k = 1 - Math.exp(-dt * lag)
      st.x += (st.tx - st.x) * k
      st.y += (st.ty - st.y) * k
      st.s += (st.ts - st.s) * (1 - Math.exp(-dt * 10))
      apply()
      const busy = Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) > 0.2 || Math.abs(st.ts - st.s) > 0.002
      st.raf = busy ? requestAnimationFrame(frame) : 0
      if (!busy) st.last = 0
    }
    const move = (e) => {
      const r = root.current.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      const m = size * 0.4
      const near = x > -m && x < r.width + m && y > -m && y < r.height + m
      if (near && st.ts === 0) {
        st.x = x
        st.y = y
      }
      st.tx = x
      st.ty = y
      st.ts = near ? 1 : 0
      if (!st.raf) st.raf = requestAnimationFrame(frame)
    }
    apply()
    window.addEventListener('pointermove', move)
    return () => {
      cancelAnimationFrame(st.raf)
      window.removeEventListener('pointermove', move)
    }
  }, [zoom, size, lag])

  return (
    <span ref={root} aria-label={text} style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre', ...style }}>
      <span aria-hidden="true">{text}</span>
      <span ref={layer} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', clipPath: 'circle(0px at 0 0)' }}>
        {/* the paper behind the glass, so the small text doesn't show through */}
        <span style={{ position: 'absolute', inset: '-100vmax', background: paper, zIndex: -1 }} />
        {text}
      </span>
      <span
        ref={glass}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          borderRadius: '50%',
          pointerEvents: 'none',
          opacity: 0,
          boxShadow: `0 0 0 3px ${ring}, 0 10px 28px rgba(0,0,0,.25), inset 0 0 18px rgba(255,255,255,.55), inset 0 -10px 22px rgba(0,0,0,.08)`,
          background: 'radial-gradient(circle at 32% 26%, rgba(255,255,255,.45), transparent 38%)',
        }}
      />
    </span>
  )
}
