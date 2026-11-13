import { useEffect, useRef } from 'react'

// A peg light board: a black panel full of holes with a lamp behind it.
// Translucent coloured pegs are pushed in one at a time to spell the word;
// each one clicks home with a little bounce and lights up, glowing in its
// own colour and throwing a soft halo onto the panel. The holes are on a
// staggered (hexagonal) grid like the real toy. Click an empty hole to plug
// a peg in, click a lit peg to pull it out.
const PALETTE = ['#ff3b5c', '#ffb02e', '#ffe14d', '#3ddc84', '#35b7ff', '#b56cff']

export default function PegLights({
  text = 'GLOW',
  pitch = 16,
  speed = 28,
  board = '#111114',
  style,
}) {
  const box = useRef()
  const cv = useRef()

  useEffect(() => {
    const el = box.current
    const c = cv.current
    const g = c.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let W = 0
    let H = 0
    let holes = []
    let raf = 0
    let t0 = 0

    // one pre-drawn glowing peg per colour
    const sprites = {}
    const sprite = (col) => {
      if (sprites[col]) return sprites[col]
      const k = document.createElement('canvas')
      k.width = k.height = 96
      const kg = k.getContext('2d')
      const halo = kg.createRadialGradient(48, 48, 6, 48, 48, 48)
      halo.addColorStop(0, col + 'aa')
      halo.addColorStop(0.35, col + '44')
      halo.addColorStop(1, col + '00')
      kg.fillStyle = halo
      kg.fillRect(0, 0, 96, 96)
      const cap = kg.createRadialGradient(42, 40, 2, 48, 48, 16)
      cap.addColorStop(0, '#ffffff')
      cap.addColorStop(0.35, col)
      cap.addColorStop(1, col + 'cc')
      kg.fillStyle = cap
      kg.beginPath()
      kg.arc(48, 48, 16, 0, Math.PI * 2)
      kg.fill()
      return (sprites[col] = k)
    }

    const build = () => {
      W = el.clientWidth
      H = el.clientHeight
      c.width = W * dpr
      c.height = H * dpr
      const rowH = pitch * 0.866
      const cols = Math.floor(W / pitch)
      const rows = Math.floor(H / rowH)
      // the word, sampled once per hole
      const m = document.createElement('canvas')
      m.width = W
      m.height = H
      const mg = m.getContext('2d', { willReadFrequently: true })
      let size = H * 0.5
      mg.font = `900 ${size}px 'Arial Rounded MT Bold', 'Arial Black', sans-serif`
      const tw = mg.measureText(text).width
      if (tw > W * 0.84) size *= (W * 0.84) / tw
      mg.font = `900 ${size}px 'Arial Rounded MT Bold', 'Arial Black', sans-serif`
      mg.textAlign = 'center'
      mg.textBaseline = 'middle'
      // each letter gets its own colour
      const chars = [...text]
      const widths = chars.map((ch) => mg.measureText(ch).width)
      let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2
      chars.forEach((ch, i) => {
        mg.fillStyle = `rgb(${i + 1},0,0)`
        mg.fillText(ch, x + widths[i] / 2, H / 2)
        x += widths[i]
      })
      const d = mg.getImageData(0, 0, W, H).data
      holes = []
      for (let r = 0; r < rows; r++) {
        for (let q = 0; q < cols; q++) {
          const hx = (q + 0.5 + (r % 2) * 0.5) * pitch
          const hy = (r + 0.5) * rowH + (H - rows * rowH) / 2
          if (hx > W - pitch * 0.3) continue
          const k = ((hy | 0) * W + (hx | 0)) * 4
          const on = d[k + 3] > 140
          holes.push({ x: hx, y: hy, want: on, col: on ? PALETTE[(d[k] - 1) % PALETTE.length] : null, at: Infinity, s: 0, v: 0, peg: false })
        }
      }
      // plug them in left to right, a few at a time, like a hand working along
      const order = holes.filter((h) => h.want).sort((a, b) => a.x - b.x + (Math.random() - 0.5) * pitch * 3)
      order.forEach((h, i) => (h.at = 300 + (i * 1000) / speed))
      t0 = 0
    }

    let last = 0
    const frame = (now) => {
      t0 ||= now
      const dt = Math.min(0.033, (now - (last || now)) / 1000)
      last = now
      const t = now - t0
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = board
      g.fillRect(0, 0, W, H)
      const r = pitch * 0.17
      for (const h of holes) {
        if (!h.peg && t >= h.at) {
          h.peg = true
          h.at = Infinity
        }
        const goal = h.peg ? 1 : 0
        h.v += ((goal - h.s) * 420 - h.v * 20) * dt
        h.s += h.v * dt
        // the hole: a little light leaks round its edge from the lamp behind
        g.fillStyle = '#050506'
        g.beginPath()
        g.arc(h.x, h.y, r * 1.2, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = 'rgba(255,240,220,.06)'
        g.beginPath()
        g.arc(h.x, h.y, r * 0.7, 0, Math.PI * 2)
        g.fill()
      }
      g.globalCompositeOperation = 'lighter'
      for (const h of holes) {
        if (h.s < 0.02 || !h.col) continue
        const s = pitch * 1.6 * Math.max(0, h.s)
        g.globalAlpha = Math.min(1, h.s)
        g.drawImage(sprite(h.col), h.x - s / 2, h.y - s / 2, s, s)
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(frame)
    }

    const click = (e) => {
      const b = el.getBoundingClientRect()
      const x = e.clientX - b.left
      const y = e.clientY - b.top
      let best = null
      let bd = pitch * 0.6
      for (const h of holes) {
        const d = Math.hypot(h.x - x, h.y - y)
        if (d < bd) {
          bd = d
          best = h
        }
      }
      if (!best) return
      if (best.peg) best.peg = false
      else {
        best.col ||= PALETTE[Math.floor(Math.random() * PALETTE.length)]
        best.peg = true
      }
    }
    build()
    const ro = new ResizeObserver(build)
    ro.observe(el)
    el.addEventListener('click', click)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('click', click)
    }
  }, [text, pitch, speed, board])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: board, cursor: 'pointer', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
