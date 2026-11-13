import { useEffect, useRef } from 'react'

// Shadow type. The letters are cut from clear glass and stand a little in
// front of a wall, so you can barely see them; what you read is the shadow
// they cast. Move the pointer and you move the lamp: the shadow slides the
// opposite way, grows as the lamp comes closer, and its edge softens the
// further it falls from the letters (a lamp has a size, so shadows have a
// penumbra). With no pointer about, the lamp circles slowly on its own.
export default function ShadowType({
  text = 'SHADOW',
  wall = '#e8e2d6',
  lamp = '#ffe6b0',
  gap = 1,
  style,
}) {
  const box = useRef()
  const shadow = useRef()
  const glow = useRef()

  useEffect(() => {
    const el = box.current
    const st = { x: 0.2, y: 0.25, tx: 0.2, ty: 0.25, near: false, t: 0, last: 0, raf: 0 }
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (st.last || now)) / 1000)
      st.last = now
      st.t += dt
      if (!st.near) {
        st.tx = 0.5 + 0.38 * Math.cos(st.t * 0.5)
        st.ty = 0.42 + 0.3 * Math.sin(st.t * 0.5)
      }
      const k = 1 - Math.exp(-dt * (st.near ? 10 : 2.5))
      st.x += (st.tx - st.x) * k
      st.y += (st.ty - st.y) * k
      const W = el.clientWidth
      const H = el.clientHeight
      // the lamp's offset from the letters, in px
      const lx = (st.x - 0.5) * W
      const ly = (st.y - 0.5) * H
      // similar triangles: the shadow lands opposite the lamp, offset in
      // proportion to how far the wall is behind the letters
      const d = 0.12 * gap
      const sx = -lx * d
      const sy = -ly * d
      const scale = 1 + d * 0.6
      const blur = 2 + Math.hypot(lx, ly) * 0.012 * gap
      if (shadow.current) {
        shadow.current.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${scale.toFixed(3)})`
        shadow.current.style.filter = `blur(${blur.toFixed(1)}px)`
      }
      if (glow.current) glow.current.style.background = `radial-gradient(circle at ${st.x * 100}% ${st.y * 100}%, ${lamp} 0%, ${lamp}55 18%, transparent 55%)`
      st.raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      st.near = x >= 0 && x <= 1 && y >= 0 && y <= 1
      if (st.near) {
        st.tx = x
        st.ty = y
      }
    }
    window.addEventListener('pointermove', move)
    st.raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(st.raf)
      window.removeEventListener('pointermove', move)
    }
  }, [gap, lamp])

  const type = { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: "900 clamp(56px, 11vw, 140px)/1 'Arial Black', Impact, sans-serif", letterSpacing: '0.02em', whiteSpace: 'nowrap' }
  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: `color-mix(in srgb, ${wall} 55%, #000)`, ...style }}>
      {/* the lamp's pool of light on the wall */}
      <div ref={glow} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }} />
      <div style={{ position: 'absolute', inset: 0, background: wall, mixBlendMode: 'multiply', opacity: 0.9 }} />
      {/* the shadow on the wall */}
      <div ref={shadow} aria-hidden="true" style={{ ...type, color: 'rgba(20,16,10,.62)', transformOrigin: '50% 50%' }}>
        {text}
      </div>
      {/* the glass letters themselves: almost invisible */}
      <div aria-hidden="true" style={{ ...type, color: 'rgba(255,255,255,.05)', WebkitTextStroke: '1px rgba(255,255,255,.28)' }}>
        {text}
      </div>
    </div>
  )
}
