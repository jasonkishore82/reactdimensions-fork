import { useEffect, useRef } from 'react'

// Holographic foil lettering. The foil is ruled with a microscopic grating,
// so the colour you see depends on the angle you look from: tilt it and the
// rainbow slides across the letters, bands shifting through the spectrum,
// while a bright specular streak runs over where the light catches. Move the
// pointer to tilt the card; left alone it rocks gently.
export default function HologramFoil({
  text = 'HOLO',
  base = '#c9ccd6',
  intensity = 1,
  style,
}) {
  const card = useRef()
  const ink = useRef()
  const shine = useRef()

  useEffect(() => {
    const el = card.current
    const st = { rx: 0, ry: 0, tx: 0, ty: 0, near: false, t: 0, last: 0, raf: 0 }
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (st.last || now)) / 1000)
      st.last = now
      st.t += dt
      if (!st.near) {
        st.tx = Math.sin(st.t * 0.7) * 0.6
        st.ty = Math.cos(st.t * 0.5) * 0.4
      }
      const k = 1 - Math.exp(-dt * 8)
      st.rx += (st.tx - st.rx) * k
      st.ry += (st.ty - st.ry) * k
      el.style.transform = `rotateY(${st.rx * 22}deg) rotateX(${-st.ry * 18}deg)`
      // the grating sends a different wavelength to your eye at each angle:
      // shift the spectrum along with the tilt
      const shift = 50 + st.rx * 60 * intensity + st.ry * 30 * intensity
      if (ink.current) ink.current.style.backgroundPosition = `${shift}% ${50 + st.ry * 40}%`
      if (shine.current) {
        shine.current.style.backgroundPosition = `${50 - st.rx * 90}% ${50 - st.ry * 90}%`
        shine.current.style.opacity = String(0.35 + Math.abs(st.rx) * 0.5)
      }
      st.raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const x = ((e.clientX - r.left) / r.width) * 2 - 1
      const y = ((e.clientY - r.top) / r.height) * 2 - 1
      st.near = Math.abs(x) < 1.6 && Math.abs(y) < 1.8
      if (st.near) {
        st.tx = Math.max(-1, Math.min(1, x))
        st.ty = Math.max(-1, Math.min(1, y))
      }
    }
    window.addEventListener('pointermove', move)
    st.raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(st.raf)
      window.removeEventListener('pointermove', move)
    }
  }, [intensity])

  const rainbow = 'linear-gradient(115deg, #ff5f6d, #ffc371, #f9f871, #6dfa9a, #3ee2ff, #7a6cff, #ff6ad5, #ff5f6d, #ffc371, #f9f871, #6dfa9a, #3ee2ff, #7a6cff, #ff6ad5)'
  return (
    <div style={{ perspective: '900px', display: 'inline-block', ...style }}>
      <div
        ref={card}
        role="img"
        aria-label={text}
        style={{ position: 'relative', padding: '0.18em 0.32em', borderRadius: '0.12em', background: `linear-gradient(135deg, ${base}, #f3f4f8 50%, ${base})`, boxShadow: '0 0.12em 0.3em rgba(0,0,0,.25)', transformStyle: 'preserve-3d' }}
      >
        <div
          ref={ink}
          style={{
            font: "900 1em/1 'Arial Black', Impact, sans-serif",
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            // the rainbow, plus a fine grating texture over it
            backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,.25) 0 1px, transparent 1px 3px), ${rainbow}`,
            backgroundSize: '100% 100%, 400% 400%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: 'saturate(1.2)',
          }}
        >
          {text}
        </div>
        {/* specular streak across the foil */}
        <div
          ref={shine}
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', backgroundImage: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,.75) 48%, transparent 60%)', backgroundSize: '250% 250%', mixBlendMode: 'overlay' }}
        />
      </div>
    </div>
  )
}
