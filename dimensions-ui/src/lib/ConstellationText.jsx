import { useEffect, useRef } from 'react'

// The word as a constellation. Stars fade in at the corners of each letter,
// brighter ones first, then faint lines are drawn between them one by one,
// joining them into the letter shapes, as on a star chart. Behind them the
// whole sky turns slowly about the pole, background stars twinkle (the air
// makes small stars flicker), and now and then a meteor streaks across.
function outlines(text, W, H, cell) {
  const cols = Math.ceil(W / cell)
  const rows = Math.ceil(H / cell)
  const c = document.createElement('canvas')
  c.width = cols
  c.height = rows
  const g = c.getContext('2d', { willReadFrequently: true })
  let size = rows * 0.5
  const font = (s) => `700 ${s}px 'Helvetica Neue', Arial, sans-serif`
  g.font = font(size)
  const tw = g.measureText(text).width
  if (tw > cols * 0.84) size *= (cols * 0.84) / tw
  g.font = font(size)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, cols / 2, rows / 2)
  const d = g.getImageData(0, 0, cols, rows).data
  const v = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? 0 : d[(y * cols + x) * 4 + 3] > 110 ? 1 : 0)
  const segs = new Map()
  const add = (a, b) => {
    const k = a.join()
    ;(segs.get(k) || segs.set(k, []).get(k)).push(b)
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
      const nx = segs.get(k)
      if (!nx?.length) break
      loop.push(k.split(',').map(Number))
      k = nx.pop().join()
      if (k === k0) break
    }
    if (loop.length > 6) loops.push(loop.map(([x, y]) => [x * cell, y * cell]))
  }
  return loops
}

// Douglas-Peucker: keep only the corners that matter
function simplify(pts, eps) {
  if (pts.length < 3) return pts
  let best = 0
  let bi = 0
  const [a, b] = [pts[0], pts[pts.length - 1]]
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L
    if (d > best) {
      best = d
      bi = i
    }
  }
  if (best <= eps) return [a, b]
  return [...simplify(pts.slice(0, bi + 1), eps).slice(0, -1), ...simplify(pts.slice(bi), eps)]
}

export default function ConstellationText({
  text = 'ORION',
  star = '#eaf2ff',
  line = '#7fa8ff',
  turn = 1,
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
    const loops = outlines(String(text), W, H, Math.max(2, W / 260)).map((l) => {
      // split each closed loop in two halves so simplify keeps its shape
      const h = (l.length / 2) | 0
      const s = [...simplify(l.slice(0, h + 1), 7), ...simplify(l.slice(h), 7).slice(1)]
      return s
    })
    const stars = []
    const edges = []
    for (const l of loops) {
      const base = stars.length
      l.forEach(([x, y]) => stars.push({ x, y, m: 0.6 + Math.random() * 0.8, at: 0.3 + Math.random() * 1.6 }))
      for (let k = 0; k < l.length; k++) edges.push([base + k, base + ((k + 1) % l.length)])
    }
    edges.forEach((e, k) => (e.at = 2.2 + k * 0.06))
    const field = Array.from({ length: 260 }, () => ({ x: (Math.random() - 0.5) * W * 1.6, y: (Math.random() - 0.5) * H * 1.6, m: Math.random() ** 3 * 1.6 + 0.2, tw: Math.random() * 10 }))
    let meteor = null
    let t = 0
    let last = 0
    let raf = 0
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      t += dt
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      // the sky turns slowly round a pole above the frame
      const rot = Math.sin(t * 0.05 * turn) * 0.05
      g.translate(W / 2, H / 2)
      g.rotate(rot)
      for (const s of field) {
        const tw = 0.6 + 0.4 * Math.sin(t * (2 + s.tw) + s.tw * 7)
        g.fillStyle = `rgba(220,230,255,${(0.25 + s.m * 0.35) * tw})`
        g.beginPath()
        g.arc(s.x, s.y, s.m * 0.8, 0, Math.PI * 2)
        g.fill()
      }
      g.translate(-W / 2, -H / 2)
      // lines first, under the stars
      g.strokeStyle = line
      g.lineWidth = 1
      for (const e of edges) {
        const k = Math.max(0, Math.min(1, (t - e.at) / 0.35))
        if (!k) continue
        const a = stars[e[0]]
        const b = stars[e[1]]
        g.globalAlpha = 0.55
        g.beginPath()
        g.moveTo(a.x, a.y)
        g.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)
        g.stroke()
      }
      g.globalAlpha = 1
      for (const s of stars) {
        const k = Math.max(0, Math.min(1, (t - s.at) / 0.8))
        if (!k) continue
        const r = 1.2 + s.m * 1.6
        const halo = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 4)
        halo.addColorStop(0, star)
        halo.addColorStop(0.25, `rgba(180,205,255,${0.35 * k})`)
        halo.addColorStop(1, 'rgba(180,205,255,0)')
        g.globalAlpha = k
        g.fillStyle = halo
        g.fillRect(s.x - r * 4, s.y - r * 4, r * 8, r * 8)
        g.fillStyle = star
        g.beginPath()
        g.arc(s.x, s.y, r * 0.55, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
      // a meteor now and then
      if (!meteor && Math.random() < dt * 0.15) meteor = { x: Math.random() * W, y: -10, vx: -380 - Math.random() * 200, vy: 260 + Math.random() * 120, life: 0.9 }
      if (meteor) {
        meteor.life -= dt
        const mx = meteor.x
        const my = meteor.y
        meteor.x += meteor.vx * dt
        meteor.y += meteor.vy * dt
        const gr = g.createLinearGradient(mx - meteor.vx * 0.15, my - meteor.vy * 0.15, meteor.x, meteor.y)
        gr.addColorStop(0, 'rgba(255,255,255,0)')
        gr.addColorStop(1, `rgba(255,255,255,${Math.max(0, meteor.life)})`)
        g.strokeStyle = gr
        g.lineWidth = 1.4
        g.beginPath()
        g.moveTo(mx - meteor.vx * 0.15, my - meteor.vy * 0.15)
        g.lineTo(meteor.x, meteor.y)
        g.stroke()
        if (meteor.life <= 0) meteor = null
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [text, star, line, turn])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(120% 100% at 50% 110%, #1b2a4a, #070b18 60%, #04060d)', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
