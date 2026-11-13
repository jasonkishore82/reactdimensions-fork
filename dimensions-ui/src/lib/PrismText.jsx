import { useEffect, useRef } from 'react'

// White text seen through a glass prism. Glass bends short wavelengths more
// than long ones, so wherever the prism sits over the letters, the white
// splits into its spectrum: red shifted least, violet most, the copies
// overlapping back to white where they still coincide. Drag the prism
// across the word; outside it the letters stay pure white. Left alone it
// drifts slowly back and forth.
const BANDS = [
  ['#ff2a2a', 0],
  ['#ff8c1a', 0.17],
  ['#ffe81a', 0.33],
  ['#3dff5a', 0.5],
  ['#1ad1ff', 0.67],
  ['#3a4dff', 0.83],
  ['#a02aff', 1],
]

export default function PrismText({
  text = 'SPECTRUM',
  spread = 18,
  background = '#0d0e12',
  style,
}) {
  const box = useRef()
  const prism = useRef()
  const split = useRef()

  useEffect(() => {
    const el = box.current
    const st = { x: 0.3, vx: 0, drag: null, t: 0, last: 0, raf: 0 }
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (st.last || now)) / 1000)
      st.last = now
      st.t += dt
      if (!st.drag) st.x += (0.5 + Math.sin(st.t * 0.45) * 0.32 - st.x) * Math.min(1, dt * 1.5)
      const W = el.clientWidth
      const px = st.x * W
      const pw = Math.min(W * 0.34, 300)
      const clip = `polygon(${px - pw / 2}px 82%, ${px}px 14%, ${px + pw / 2}px 82%)`
      if (prism.current) {
        prism.current.style.left = `${px - pw / 2}px`
        prism.current.style.width = `${pw}px`
      }
      if (split.current) split.current.style.clipPath = clip
      st.raf = requestAnimationFrame(frame)
    }
    const local = (e) => (e.clientX - el.getBoundingClientRect().left) / el.clientWidth
    const down = (e) => {
      st.drag = { off: st.x - local(e) }
      el.setPointerCapture(e.pointerId)
    }
    const move = (e) => st.drag && (st.x = Math.max(0, Math.min(1, local(e) + st.drag.off)))
    const up = () => {
      st.drag = null
      st.t = Math.asin(Math.max(-1, Math.min(1, (st.x - 0.5) / 0.32))) / 0.45
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
  }, [])

  const type = { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: "800 clamp(44px, 9vw, 116px)/1 'Helvetica Neue', Arial, sans-serif", letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, cursor: 'ew-resize', touchAction: 'none', userSelect: 'none', ...style }}>
      <div aria-hidden="true" style={{ ...type, color: '#fff' }}>{text}</div>
      {/* inside the prism: the same text, split into bands that add back to white */}
      <div ref={split} aria-hidden="true" style={{ position: 'absolute', inset: 0, background }}>
        {BANDS.map(([col, k]) => (
          <div key={col} style={{ ...type, color: col, mixBlendMode: 'screen', transform: `translateY(${(k - 0.15) * spread}px) translateX(${k * spread * 0.25}px)`, filter: 'blur(0.4px)' }}>
            {text}
          </div>
        ))}
      </div>
      {/* the prism: a glass triangle with bright edges */}
      <svg ref={prism} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', top: '14%', height: '68%', overflow: 'visible', cursor: 'grab' }}>
        <polygon points="0,100 50,0 100,100" fill="rgba(200,220,255,.07)" stroke="rgba(230,240,255,.55)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        <polygon points="50,0 56,100 100,100" fill="rgba(255,255,255,.05)" />
        <line x1="50" y1="0" x2="20" y2="60" stroke="rgba(255,255,255,.35)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
