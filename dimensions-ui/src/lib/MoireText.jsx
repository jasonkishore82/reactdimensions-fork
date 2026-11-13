import { useEffect, useRef } from 'react'

// A hidden message in a moiré. The base sheet is ruled with fine black
// lines, but inside the letters the lines are shifted by half a period, so
// on its own you can hardly see the word. Lay a transparent sheet ruled at
// the same pitch over it and slide it: where the lines line up you see the
// gaps, where they're out of step the gaps fill in, so the letters flash
// dark and light against their surroundings as the sheet slides. Tilt the
// top sheet a fraction and broad interference bands sweep across as well.
// Drag sideways to slide the top sheet.
export default function MoireText({
  text = 'MOIRÉ',
  pitch = 6,
  tilt = 0.6,
  ink = '#121214',
  paper = '#f5f2ea',
  style,
}) {
  const box = useRef()
  const top = useRef()

  useEffect(() => {
    const el = box.current
    const st = { x: 0, drag: null, t: 0, last: 0, raf: 0 }
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (st.last || now)) / 1000)
      st.last = now
      if (!st.drag) {
        st.t += dt
        st.x = Math.sin(st.t * 0.6) * pitch * 2
      }
      if (top.current) top.current.style.transform = `translateX(${st.x.toFixed(2)}px) rotate(${tilt}deg)`
      st.raf = requestAnimationFrame(frame)
    }
    const down = (e) => {
      st.drag = { x: e.clientX, from: st.x }
      el.setPointerCapture(e.pointerId)
    }
    const move = (e) => st.drag && (st.x = st.drag.from + (e.clientX - st.drag.x) * 0.25)
    const up = () => {
      if (!st.drag) return
      st.drag = null
      st.t = Math.asin(Math.max(-1, Math.min(1, st.x / (pitch * 2)))) / 0.6
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    st.raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(st.raf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
  }, [pitch, tilt])

  const lines = (shift) => `repeating-linear-gradient(90deg, ${ink} ${shift}px ${shift + pitch / 2}px, transparent ${shift + pitch / 2}px ${shift + pitch}px)`
  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: paper, cursor: 'ew-resize', touchAction: 'none', userSelect: 'none', ...style }}>
      {/* base sheet: lines everywhere... */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: lines(0) }} />
      {/* ...and inside the letters, the same lines shifted half a period */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          font: "900 clamp(64px, 13vw, 170px)/1 'Arial Black', Impact, sans-serif",
          whiteSpace: 'nowrap',
          color: 'transparent',
          backgroundColor: paper,
          backgroundImage: lines(pitch / 2),
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
        }}
      >
        {text}
      </div>
      {/* the sliding transparent overlay, a little larger so its edges never show */}
      <div ref={top} aria-hidden="true" style={{ position: 'absolute', inset: '-10%', backgroundImage: lines(0), opacity: 0.92, willChange: 'transform' }} />
    </div>
  )
}
