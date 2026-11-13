import { useEffect, useRef } from 'react'

// Knitting: the word appears as a colourwork pattern, the way it would be
// knitted into a jumper. Knitting grows from the bottom up, one row at a
// time, and flat knitting works each row back and forth, so the stitches
// appear left to right, then right to left on the next row. Every stitch is
// the familiar "V" of two leaning loops of yarn, in the main colour or the
// contrast colour depending on the chart.
export default function KnitText({
  text = 'KNIT',
  main = '#2f4a7a',
  contrast = '#f2e6cf',
  stitch = 14,
  speed = 180,
  style,
}) {
  const box = useRef()
  const cv = useRef()

  useEffect(() => {
    const el = box.current
    const c = cv.current
    const g = c.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = el.clientWidth
    const H = el.clientHeight
    c.width = W * dpr
    c.height = H * dpr
    g.scale(dpr, dpr)
    const sw = stitch
    const sh = stitch * 0.82
    const cols = Math.floor(W / sw)
    const rows = Math.floor(H / sh)
    const ox = (W - cols * sw) / 2

    // the chart: the word rasterised at one cell per stitch
    const m = document.createElement('canvas')
    m.width = cols
    m.height = rows
    const mg = m.getContext('2d', { willReadFrequently: true })
    let size = rows * 0.6
    mg.font = `900 ${size}px 'Arial Black', Impact, sans-serif`
    const tw = mg.measureText(text).width
    if (tw > cols * 0.88) size *= (cols * 0.88) / tw
    mg.font = `900 ${size}px 'Arial Black', Impact, sans-serif`
    mg.textAlign = 'center'
    mg.textBaseline = 'middle'
    mg.fillText(text, cols / 2, rows / 2)
    const d = mg.getImageData(0, 0, cols, rows).data
    const chart = (x, y) => d[(y * cols + x) * 4 + 3] > 110

    // two pre-drawn stitches, one per colour
    const sprite = (col) => {
      const k = document.createElement('canvas')
      k.width = sw * 2
      k.height = sh * 2.4
      const kg = k.getContext('2d')
      kg.scale(2, 2)
      for (const side of [-1, 1]) {
        kg.save()
        kg.translate(sw / 2 + side * sw * 0.22, sh * 0.62)
        kg.rotate(side * 0.5)
        const gr = kg.createLinearGradient(-sw * 0.25, 0, sw * 0.25, 0)
        gr.addColorStop(0, 'rgba(0,0,0,.35)')
        gr.addColorStop(0.45, col)
        gr.addColorStop(0.7, col)
        gr.addColorStop(1, 'rgba(0,0,0,.25)')
        kg.fillStyle = col
        kg.beginPath()
        kg.ellipse(0, 0, sw * 0.24, sh * 0.62, 0, 0, Math.PI * 2)
        kg.fill()
        kg.fillStyle = gr
        kg.fill()
        // the ply twist
        kg.strokeStyle = 'rgba(255,255,255,.18)'
        kg.lineWidth = 0.8
        for (let t = -0.4; t <= 0.4; t += 0.27) {
          kg.beginPath()
          kg.moveTo(-sw * 0.18, sh * t)
          kg.lineTo(sw * 0.18, sh * (t + 0.12))
          kg.stroke()
        }
        kg.restore()
      }
      return k
    }
    const A = sprite(main)
    const B = sprite(contrast)

    // background: the needle-side gap colour
    g.fillStyle = 'rgba(0,0,0,.0)'
    let n = 0
    const total = cols * rows
    let raf = 0
    let last = 0
    const needle = el.querySelector('[data-needle]')
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      let k = Math.max(1, Math.round(speed * dt))
      while (k-- > 0 && n < total) {
        const r = Math.floor(n / cols) // 0 = bottom row
        const q = n % cols
        const x = r % 2 ? cols - 1 - q : q
        const y = rows - 1 - r
        g.drawImage(chart(x, y) ? B : A, ox + x * sw, y * sh - sh * 0.15, sw, sh * 1.2)
        n++
        if (needle) needle.style.transform = `translate(${ox + x * sw}px, ${y * sh - 6}px)`
      }
      if (n < total) raf = requestAnimationFrame(frame)
      else if (needle) needle.style.opacity = '0'
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [text, main, contrast, stitch, speed])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: `color-mix(in srgb, ${main} 55%, #000)`, ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {/* the working needle along the current row */}
      <div data-needle aria-hidden="true" style={{ position: 'absolute', left: -120, top: 0, width: 240, height: 5, borderRadius: 3, background: 'linear-gradient(#e9d7a8, #b48a4e)', boxShadow: '0 2px 3px rgba(0,0,0,.35)', transition: 'transform 60ms linear', pointerEvents: 'none' }} />
    </div>
  )
}
