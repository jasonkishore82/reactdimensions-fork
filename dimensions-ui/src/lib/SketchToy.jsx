import { useEffect, useRef } from 'react'

// A drawing toy with two knobs: the left one moves the stylus across, the
// right one moves it up and down, and the stylus scrapes a dark line in the
// powder on the back of the glass. The line can never be lifted, so the word
// is drawn as one unbroken stroke: round the outline of each letter, then
// along to the next. The knobs turn as the line moves. Click "shake" to
// shake the toy and the powder settles back over the glass; or use the
// arrow keys to draw yourself.
function outlines(text, W, H, cell) {
  // rasterise, then trace the letter outlines with marching squares
  const cols = Math.ceil(W / cell)
  const rows = Math.ceil(H / cell)
  const c = document.createElement('canvas')
  c.width = cols
  c.height = rows
  const g = c.getContext('2d', { willReadFrequently: true })
  let size = rows * 0.62
  g.font = `700 ${size}px 'Arial Rounded MT Bold', 'Trebuchet MS', Arial, sans-serif`
  const tw = g.measureText(text).width
  if (tw > cols * 0.86) size *= (cols * 0.86) / tw
  g.font = `700 ${size}px 'Arial Rounded MT Bold', 'Trebuchet MS', Arial, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, cols / 2, rows / 2)
  const d = g.getImageData(0, 0, cols, rows).data
  const v = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? 0 : d[(y * cols + x) * 4 + 3] > 110 ? 1 : 0)
  const segs = new Map()
  const add = (a, b) => {
    const ka = a.join()
    ;(segs.get(ka) || segs.set(ka, []).get(ka)).push(b)
  }
  for (let y = -1; y < rows; y++) {
    for (let x = -1; x < cols; x++) {
      const idx = v(x, y) * 8 + v(x + 1, y) * 4 + v(x + 1, y + 1) * 2 + v(x, y + 1)
      const T = [x + 0.5, y]
      const R = [x + 1, y + 0.5]
      const B = [x + 0.5, y + 1]
      const L = [x, y + 0.5]
      const map = { 1: [[L, B]], 2: [[B, R]], 3: [[L, R]], 4: [[R, T]], 5: [[L, B], [R, T]], 6: [[B, T]], 7: [[L, T]], 8: [[T, L]], 9: [[T, B]], 10: [[T, L], [B, R]], 11: [[T, R]], 12: [[R, L]], 13: [[R, B]], 14: [[B, L]] }
      for (const [a, b] of map[idx] || []) add(a, b)
    }
  }
  const loops = []
  for (const [k0] of segs) {
    if (!segs.get(k0)?.length) continue
    const loop = []
    let k = k0
    for (let guard = 0; guard < 100000; guard++) {
      const nexts = segs.get(k)
      if (!nexts?.length) break
      const n = nexts.pop()
      loop.push(k.split(',').map(Number))
      k = n.join()
      if (k === k0) break
    }
    if (loop.length > 3) loops.push(loop.map(([x, y]) => [x * cell, y * cell]))
  }
  // left to right; join each loop at the point nearest the pen
  loops.sort((a, b) => Math.min(...a.map((p) => p[0])) - Math.min(...b.map((p) => p[0])))
  const path = []
  let pen = [W * 0.05, H * 0.9]
  path.push(pen)
  for (const loop of loops) {
    let bi = 0
    let bd = Infinity
    loop.forEach((p, i) => {
      const dd = (p[0] - pen[0]) ** 2 + (p[1] - pen[1]) ** 2
      if (dd < bd) {
        bd = dd
        bi = i
      }
    })
    const ordered = [...loop.slice(bi), ...loop.slice(0, bi), loop[bi]]
    path.push(...ordered)
    pen = ordered[ordered.length - 1]
  }
  path.push([W * 0.95, pen[1]])
  return path
}

export default function SketchToy({
  text = 'Hello',
  speed = 260,
  frame = '#d4202a',
  style,
}) {
  const screen = useRef()
  const cv = useRef()
  const knobL = useRef()
  const knobR = useRef()
  const toy = useRef()
  const api = useRef({})

  useEffect(() => {
    const c = cv.current
    const g = c.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = screen.current.clientWidth
    const H = screen.current.clientHeight
    c.width = W * dpr
    c.height = H * dpr
    g.scale(dpr, dpr)
    const path = outlines(String(text), W, H, Math.max(2, W / 260))
    // pen state
    let i = 0
    let f = 0
    let pos = [...path[0]]
    let turnX = 0
    let turnY = 0
    let raf = 0
    let last = 0
    let auto = true
    const ink = () => {
      g.strokeStyle = 'rgba(60,60,64,.9)'
      g.lineWidth = 1.3
      g.lineCap = 'round'
      g.lineJoin = 'round'
    }
    const moveTo = (nx, ny) => {
      ink()
      g.beginPath()
      g.moveTo(pos[0], pos[1])
      g.lineTo(nx, ny)
      g.stroke()
      turnX += nx - pos[0]
      turnY += ny - pos[1]
      pos = [nx, ny]
      knobL.current.style.transform = `rotate(${turnX * 2}deg)`
      knobR.current.style.transform = `rotate(${-turnY * 2}deg)`
    }
    const clear = () => {
      g.clearRect(0, 0, W, H)
    }
    const step = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      if (auto) {
        let budget = speed * dt
        while (budget > 0 && i < path.length - 1) {
          const a = path[i]
          const b = path[i + 1]
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.001
          const left = len * (1 - f)
          if (budget >= left) {
            budget -= left
            i++
            f = 0
            moveTo(b[0], b[1])
          } else {
            f += budget / len
            budget = 0
            moveTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
          }
        }
      }
      raf = requestAnimationFrame(step)
    }
    api.current.shake = () => {
      auto = false
      toy.current.animate(
        [0, -14, 12, -10, 9, -6, 4, 0].map((x, k) => ({ transform: `translate(${x}px, ${k % 2 ? 4 : -3}px) rotate(${x / 6}deg)` })),
        { duration: 700, easing: 'ease-in-out' },
      )
      // the powder settles back in a few washes
      let n = 0
      const wash = setInterval(() => {
        g.globalCompositeOperation = 'destination-out'
        g.fillStyle = 'rgba(0,0,0,.45)'
        g.fillRect(0, 0, W, H)
        g.globalCompositeOperation = 'source-over'
        if (++n >= 7) {
          clearInterval(wash)
          clear()
          i = 0
          f = 0
          pos = [...path[0]]
          setTimeout(() => (auto = true), 500)
        }
      }, 100)
    }
    api.current.key = (dx, dy) => {
      auto = false
      moveTo(Math.max(0, Math.min(W, pos[0] + dx)), Math.max(0, Math.min(H, pos[1] + dy)))
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text, speed])

  const onKey = (e) => {
    const m = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] }[e.key]
    if (!m) return
    e.preventDefault()
    api.current.key?.(...m)
  }

  const knob = (ref, side) => (
    <div style={{ position: 'absolute', bottom: '3.5%', [side]: '3.5%', width: '9%', aspectRatio: '1', borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #ffffff, #d8d8d8 55%, #9a9a9a)', boxShadow: '0 4px 8px rgba(0,0,0,.35)' }}>
      <div ref={ref} style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'repeating-conic-gradient(rgba(0,0,0,.12) 0 4deg, transparent 4deg 12deg)' }} />
    </div>
  )

  return (
    <div tabIndex={0} onKeyDown={onKey} role="img" aria-label={`${text}, drawn in one line`} style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#efece6', outline: 'none', ...style }}>
      <div ref={toy} style={{ position: 'relative', width: 'min(92%, 680px)', aspectRatio: '1.33', borderRadius: '6% / 8%', background: `linear-gradient(160deg, color-mix(in srgb, ${frame} 80%, #fff), ${frame} 30%, color-mix(in srgb, ${frame} 75%, #000))`, boxShadow: '0 14px 30px rgba(0,0,0,.3), inset 0 2px 0 rgba(255,255,255,.35)' }}>
        <div
          ref={screen}
          style={{ position: 'absolute', left: '9%', right: '9%', top: '10%', bottom: '22%', borderRadius: '3%', background: 'linear-gradient(135deg, #cfd0cb, #b9bab4)', boxShadow: 'inset 0 3px 10px rgba(0,0,0,.35)', overflow: 'hidden' }}
        >
          <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          {/* glare on the glass */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(255,255,255,.25), rgba(255,255,255,0) 40%)', pointerEvents: 'none' }} />
        </div>
        {knob(knobL, 'left')}
        {knob(knobR, 'right')}
        <button
          type="button"
          onClick={() => api.current.shake?.()}
          style={{ position: 'absolute', left: '50%', bottom: '6%', transform: 'translateX(-50%)', padding: '6px 14px', border: 'none', borderRadius: 999, background: 'rgba(255,255,255,.9)', color: frame, font: '700 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.1em', cursor: 'pointer' }}
        >
          SHAKE
        </button>
      </div>
    </div>
  )
}
