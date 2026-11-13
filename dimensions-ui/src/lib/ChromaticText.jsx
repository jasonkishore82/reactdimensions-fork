import { useEffect, useRef } from 'react'

// Chromatic aberration: the text splits into its colour channels, the way a
// cheap lens fails to focus red, green and blue at the same place. The split
// follows the pointer's speed and direction, so a quick flick tears the
// colours apart and they spring back together when you stop. On a light
// background the channels are cyan, magenta and yellow multiplied together,
// which recombine to the ink colour exactly when they line up.
export default function ChromaticText({
  text = 'Aberration',
  strength = 1,
  stiffness = 220,
  damping = 14,
  dark = false,
  style,
}) {
  const root = useRef()
  const layers = useRef([])

  useEffect(() => {
    const st = { x: 0, y: 0, vx: 0, vy: 0, px: null, py: null, kick: [0, 0], raf: 0, last: 0, hover: 0 }
    const frame = (now) => {
      st.last ||= now
      const dt = Math.min(0.033, (now - st.last) / 1000)
      st.last = now
      // spring the split back to zero; pointer motion kicks it
      st.vx += (-stiffness * st.x - damping * st.vx) * dt + st.kick[0]
      st.vy += (-stiffness * st.y - damping * st.vy) * dt + st.kick[1]
      st.kick = [0, 0]
      st.x += st.vx * dt
      st.y += st.vy * dt
      const base = st.hover * 0.04 // a small constant split while hovered
      const L = layers.current
      const sx = st.x + base
      const sy = st.y
      if (L[0]) L[0].style.transform = `translate(${(-sx).toFixed(3)}em, ${(-sy).toFixed(3)}em)`
      if (L[2]) L[2].style.transform = `translate(${sx.toFixed(3)}em, ${sy.toFixed(3)}em)`
      const busy = Math.abs(st.x) + Math.abs(st.y) + Math.abs(st.vx) + Math.abs(st.vy) > 1e-4
      st.raf = busy || st.hover ? requestAnimationFrame(frame) : 0
      if (!st.raf) st.last = 0
    }
    const kick = () => {
      if (!st.raf) st.raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      const r = root.current.getBoundingClientRect()
      const near = e.clientX > r.left - 60 && e.clientX < r.right + 60 && e.clientY > r.top - 60 && e.clientY < r.bottom + 60
      if (st.px !== null && near) {
        const fs = parseFloat(getComputedStyle(root.current).fontSize) || 40
        st.kick[0] += ((e.clientX - st.px) / fs) * 0.9 * strength
        st.kick[1] += ((e.clientY - st.py) / fs) * 0.9 * strength
      }
      st.hover = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom ? 1 : 0
      st.px = e.clientX
      st.py = e.clientY
      kick()
    }
    window.addEventListener('pointermove', move)
    return () => {
      cancelAnimationFrame(st.raf)
      window.removeEventListener('pointermove', move)
    }
  }, [strength, stiffness, damping])

  const chans = dark ? ['#ff0000', '#00ff00', '#0000ff'] : ['#00ffff', '#ff00ff', '#ffff00']
  return (
    <span ref={root} aria-label={text} style={{ position: 'relative', display: 'inline-block', isolation: 'isolate', ...style }}>
      {chans.map((c, i) => (
        <span
          key={c}
          ref={(n) => (layers.current[i] = n)}
          aria-hidden="true"
          style={{ position: i === 1 ? 'relative' : 'absolute', inset: 0, display: 'block', color: c, mixBlendMode: dark ? 'screen' : 'multiply', willChange: 'transform' }}
        >
          {text}
        </span>
      ))}
    </span>
  )
}
