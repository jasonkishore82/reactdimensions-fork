import { useEffect, useRef, useState } from 'react'

// Anamorphic type: the word is cut into fragments hung at different depths
// in space. Each fragment is pushed back by a random amount and enlarged by
// exactly enough to cancel the perspective, so from one viewpoint (straight
// on) they line up into the word, and from anywhere else they're scattered
// shards. The view orbits round and swings back into the sweet spot; drag
// to orbit it yourself.
const P = 900 // perspective distance, px

export default function AnamorphicText({
  text = 'ALIGN',
  pieces = 7,
  depth = 600,
  ink = '#1d1d1f',
  accent = '#ff4d1a',
  style,
}) {
  const box = useRef()
  const scene = useRef()
  const [src, setSrc] = useState(null)

  // render the word once to an image; fragments show parts of it
  useEffect(() => {
    const c = document.createElement('canvas')
    const g = c.getContext('2d')
    const font = "900 160px 'Arial Black', Impact, sans-serif"
    g.font = font
    const w = Math.ceil(g.measureText(text).width) + 40
    c.width = w
    c.height = 200
    g.font = font
    g.textBaseline = 'middle'
    const grad = g.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, ink)
    grad.addColorStop(0.6, ink)
    grad.addColorStop(1, accent)
    g.fillStyle = grad
    g.fillText(text, 20, 104)
    setSrc({ url: c.toDataURL(), w, h: 200 })
  }, [text, ink, accent])

  // fragment layout: a grid of cells, each at a random depth
  const cells = []
  if (src) {
    const cols = Math.max(3, Math.round(pieces * (src.w / src.h) * 0.5))
    const rows = Math.max(2, Math.round(pieces * 0.5))
    let seed = 1
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        cells.push({ q, r, cols, rows, z: -rnd() * depth + depth * 0.25, jitter: rnd() })
      }
    }
  }

  useEffect(() => {
    const el = box.current
    const st = { a: 0.9, b: 0.2, va: 0, drag: null, t: 0, last: 0, idle: 0, raf: 0 }
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (st.last || now)) / 1000)
      st.last = now
      st.t += dt
      if (!st.drag) {
        st.idle += dt
        // swing back towards the sweet spot, overshoot a little, then
        // wander off again after a while
        const target = Math.floor(st.t / 7) % 2 ? Math.sin(st.t * 0.5) * 0.9 : 0
        st.va += (target - st.a) * 6 * dt
        st.va *= Math.exp(-dt * 2.2)
        st.a += st.va * dt
        st.b += (Math.sin(st.t * 0.4) * 0.15 * (Math.abs(target) > 0 ? 1 : 0) - st.b) * dt * 2
      }
      if (scene.current) scene.current.style.transform = `rotateX(${st.b}rad) rotateY(${st.a}rad)`
      const aligned = Math.abs(st.a) < 0.03 && Math.abs(st.b) < 0.03
      el.dataset.aligned = aligned ? '1' : ''
      st.raf = requestAnimationFrame(frame)
    }
    const down = (e) => {
      st.drag = { x: e.clientX, y: e.clientY, a: st.a, b: st.b }
      el.setPointerCapture(e.pointerId)
    }
    const move = (e) => {
      if (!st.drag) return
      st.a = st.drag.a + (e.clientX - st.drag.x) * 0.005
      st.b = st.drag.b - (e.clientY - st.drag.y) * 0.004
      st.va = 0
    }
    const up = () => {
      st.drag = null
      st.t = 7 // head back to the sweet spot
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

  const dispW = 'min(80vw, 760px)'
  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 45%, #fbfaf7, #e4e0d8)', perspective: `${P}px`, cursor: 'grab', touchAction: 'none', ...style }}>
      <style>{'[data-aligned="1"] .rd-ana-hint { opacity: 1 } '}</style>
      {src && (
        <div ref={scene} style={{ position: 'absolute', left: '50%', top: '50%', width: dispW, aspectRatio: `${src.w} / ${src.h}`, translate: '-50% -50%', transformStyle: 'preserve-3d' }}>
          {cells.map((c, i) => {
            // seen from the camera, a piece at depth z appears scaled by
            // P / (P - z) about the view axis; undo that so it lines up
            const k = (P - c.z) / P
            const cx = (c.q + 0.5) / c.cols - 0.5
            const cy = (c.r + 0.5) / c.rows - 0.5
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${(c.q / c.cols) * 100}%`,
                  top: `${(c.r / c.rows) * 100}%`,
                  width: `${100 / c.cols}%`,
                  height: `${100 / c.rows}%`,
                  backgroundImage: `url(${src.url})`,
                  backgroundSize: `${c.cols * 100}% ${c.rows * 100}%`,
                  backgroundPosition: `${(c.q / (c.cols - 1)) * 100}% ${(c.r / (c.rows - 1)) * 100}%`,
                  transform: `translate3d(calc(${cx * (k - 1)} * ${dispW}), calc(${cy * (k - 1)} * ${dispW} * ${src.h / src.w}), ${c.z}px) scale(${k})`,
                  outline: '1px solid rgba(0,0,0,.04)',
                }}
              />
            )
          })}
        </div>
      )}
      <div className="rd-ana-hint" style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', color: accent, opacity: 0, transition: 'opacity 300ms' }}>
        ALIGNED
      </div>
    </div>
  )
}
