import { useEffect, useRef } from 'react'

// Fresh ink caught in the rain. The lettering is still wet when the drops
// start landing. A drop that hits bare paper only leaves a faint water mark;
// one that hits ink dissolves it and the ink blooms out through the wet
// patch, soft-edged, carried to the rim of the drop where it dries darker
// (the coffee-ring effect), and the heavier blooms run a little way down
// the page. Click to drop rain yourself.
export default function WetInkRain({
  text = 'Rain',
  ink = '#1f3a8a',
  paper = '#f5f0e6',
  rain = 1,
  style,
}) {
  const box = useRef()
  const cv = useRef()

  useEffect(() => {
    const el = box.current
    const c = cv.current
    const g = c.getContext('2d', { willReadFrequently: true })
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = el.clientWidth
    const H = el.clientHeight
    c.width = W * dpr
    c.height = H * dpr
    g.scale(dpr, dpr)
    g.fillStyle = paper
    g.fillRect(0, 0, W, H)
    let size = H * 0.5
    const font = (s) => `italic 400 ${s}px 'Brush Script MT', 'Segoe Script', Georgia, serif`
    g.font = font(size)
    const tw = g.measureText(text).width
    if (tw > W * 0.8) size *= (W * 0.8) / tw
    g.font = font(size)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = ink
    g.fillText(text, W / 2, H / 2)
    // remember where the ink is (it gets used up as drops lift it)
    const m = document.createElement('canvas')
    m.width = W
    m.height = H
    const mg = m.getContext('2d', { willReadFrequently: true })
    mg.font = font(size)
    mg.textAlign = 'center'
    mg.textBaseline = 'middle'
    mg.fillText(text, W / 2, H / 2)
    const md = mg.getImageData(0, 0, W, H).data
    const inkAt = (x, y, r) => {
      let a = 0
      let n = 0
      for (let k = 0; k < 24; k++) {
        const ang = (k / 24) * Math.PI * 2
        const rr = r * Math.sqrt((k % 6) / 6)
        const px = (x + Math.cos(ang) * rr) | 0
        const py = (y + Math.sin(ang) * rr) | 0
        if (px < 0 || py < 0 || px >= W || py >= H) continue
        a += md[(py * W + px) * 4 + 3] / 255
        n++
      }
      return n ? a / n : 0
    }

    const blooms = []
    const drop = (x, y) => {
      const r = 8 + Math.random() * 16
      blooms.push({ x, y, r, t: 0, ink: inkAt(x, y, r), run: Math.random() < 0.5 ? 10 + Math.random() * 40 : 0 })
    }
    let raf = 0
    let last = 0
    const fx = el.querySelector('[data-splash]')
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      if (Math.random() < dt * 3 * rain) drop(W * (0.1 + Math.random() * 0.8), H * (0.2 + Math.random() * 0.6))
      for (let k = blooms.length - 1; k >= 0; k--) {
        const b = blooms[k]
        const p0 = b.t
        b.t = Math.min(1, b.t + dt * 1.4)
        // the wet patch spreads fast then slows, like water wicking out
        const R = b.r * (0.4 + 0.6 * (1 - (1 - b.t) ** 3))
        const step = b.t - p0
        if (step <= 0) {
          blooms.splice(k, 1)
          continue
        }
        // water mark: a slightly darker ring on the paper
        g.strokeStyle = `rgba(80,70,50,${0.05 * step * 5})`
        g.lineWidth = 1.2
        g.beginPath()
        g.arc(b.x, b.y, R, 0, Math.PI * 2)
        g.stroke()
        if (b.ink > 0.05) {
          // dissolved ink carried outward: soft fill plus a darker rim
          const gr = g.createRadialGradient(b.x, b.y, R * 0.1, b.x, b.y, R)
          gr.addColorStop(0, ink + '10')
          gr.addColorStop(0.75, ink + '22')
          gr.addColorStop(0.95, ink + '55')
          gr.addColorStop(1, ink + '00')
          g.globalAlpha = Math.min(1, b.ink * 2) * step * 3
          g.fillStyle = gr
          g.beginPath()
          g.arc(b.x, b.y, R, 0, Math.PI * 2)
          g.fill()
          // a run trickling down the page
          if (b.run) {
            const len = b.run * b.t
            const rg = g.createLinearGradient(b.x, b.y + R * 0.6, b.x, b.y + R * 0.6 + len)
            rg.addColorStop(0, ink + '40')
            rg.addColorStop(1, ink + '00')
            g.fillStyle = rg
            g.fillRect(b.x - R * 0.18, b.y + R * 0.6, R * 0.36, len)
          }
          g.globalAlpha = 1
        }
      }
      raf = requestAnimationFrame(frame)
    }
    const click = (e) => {
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      drop(x, y)
      if (fx) {
        fx.style.left = `${x}px`
        fx.style.top = `${y}px`
        fx.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0.8 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }], { duration: 400 })
      }
    }
    el.addEventListener('click', click)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('click', click)
    }
  }, [text, ink, paper, rain])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: paper, cursor: 'pointer', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div data-splash aria-hidden="true" style={{ position: 'absolute', width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(120,150,190,.6)', opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
}
