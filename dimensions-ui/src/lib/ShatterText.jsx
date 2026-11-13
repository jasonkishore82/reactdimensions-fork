import { useEffect, useRef } from 'react'

// Shatter: click the word and it cracks from that point into shards that
// fall away under gravity, spinning, then fly back up and fit together
// again. The shards are a Voronoi fracture seeded densely round the point
// of impact and sparsely further out, which is roughly how glass and
// brittle sheets break: lots of small pieces where it was struck, a few big
// ones at the edges.
function voronoi(seeds, x0, y0, x1, y1) {
  // each cell: the bounding box clipped by the half-plane nearer its seed
  // than each other seed
  return seeds.map((s, i) => {
    let poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    for (let j = 0; j < seeds.length && poly.length; j++) {
      if (i === j) continue
      const o = seeds[j]
      const mx = (s[0] + o[0]) / 2
      const my = (s[1] + o[1]) / 2
      const nx = o[0] - s[0]
      const ny = o[1] - s[1]
      const inside = (p) => (p[0] - mx) * nx + (p[1] - my) * ny <= 0
      const out = []
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k]
        const b = poly[(k + 1) % poly.length]
        const ia = inside(a)
        const ib = inside(b)
        if (ia) out.push(a)
        if (ia !== ib) {
          const da = (a[0] - mx) * nx + (a[1] - my) * ny
          const db = (b[0] - mx) * nx + (b[1] - my) * ny
          const t = da / (da - db)
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
        }
      }
      poly = out
    }
    return poly
  })
}

export default function ShatterText({
  text = 'SHATTER',
  pieces = 36,
  gravity = 1,
  ink = '#1d1d1f',
  accent = '#ff4d1a',
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

    const img = document.createElement('canvas')
    img.width = W * dpr
    img.height = H * dpr
    const ig = img.getContext('2d')
    ig.scale(dpr, dpr)
    let size = H * 0.3
    const font = (s) => `900 ${s}px 'Arial Black', Impact, sans-serif`
    ig.font = font(size)
    const tw = ig.measureText(text).width
    if (tw > W * 0.86) size *= (W * 0.86) / tw
    ig.font = font(size)
    const w = ig.measureText(text).width
    const gr = ig.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0)
    gr.addColorStop(0, ink)
    gr.addColorStop(0.65, ink)
    gr.addColorStop(1, accent)
    ig.fillStyle = gr
    ig.textAlign = 'center'
    ig.textBaseline = 'middle'
    ig.fillText(text, W / 2, H / 2)
    const bx0 = W / 2 - w / 2 - 8
    const bx1 = W / 2 + w / 2 + 8
    const by0 = H / 2 - size * 0.6
    const by1 = H / 2 + size * 0.6

    let shards = null
    let t0 = 0
    let raf = 0
    let last = 0
    const draw = (now) => {
      const dt = Math.min(0.033, (now - (last || now)) / 1000)
      last = now
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, c.width, c.height)
      if (!shards) {
        g.drawImage(img, 0, 0)
        return
      }
      const t = (now - t0) / 1000
      const back = t > 1.6
      let home = 0
      for (const s of shards) {
        if (!back) {
          s.vy += 1600 * gravity * dt
          s.x += s.vx * dt
          s.y += s.vy * dt
          s.a += s.w * dt
          // the floor
          if (s.y + s.cy > H - 10) {
            s.y = H - 10 - s.cy
            s.vy *= -0.3
            s.vx *= 0.7
            s.w *= 0.6
          }
          s.fx = s.x
          s.fy = s.y
          s.fa = s.a
        } else {
          // fly back home along an eased path
          const k = Math.min(1, (t - 1.6 - s.delay) / 0.6)
          const e = k <= 0 ? 0 : 1 - (1 - k) ** 3
          s.x = s.fx * (1 - e)
          s.y = s.fy * (1 - e)
          s.a = s.fa * (1 - e)
          if (k >= 1) home++
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
        g.translate(s.cx + s.x, s.cy + s.y)
        g.rotate(s.a)
        g.translate(-s.cx, -s.cy)
        g.beginPath()
        s.poly.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)))
        g.closePath()
        g.save()
        g.clip()
        g.drawImage(img, 0, 0, W, H)
        g.restore()
        // a bright cut edge on each shard while it's apart
        if (!back || home < shards.length) {
          g.strokeStyle = 'rgba(255,255,255,.5)'
          g.lineWidth = 0.6
          g.stroke()
        }
      }
      if (back && home === shards.length) {
        shards = null
        g.setTransform(1, 0, 0, 1, 0, 0)
        g.clearRect(0, 0, c.width, c.height)
        g.drawImage(img, 0, 0)
        return
      }
      raf = requestAnimationFrame(draw)
    }

    const smash = (px, py) => {
      if (shards) return
      // seeds: dense near the impact, sparse away from it
      const seeds = []
      for (let k = 0; k < pieces; k++) {
        const r = Math.pow(Math.random(), 1.8) * Math.max(bx1 - bx0, by1 - by0) * 0.7
        const a = Math.random() * Math.PI * 2
        seeds.push([Math.max(bx0, Math.min(bx1, px + Math.cos(a) * r)), Math.max(by0, Math.min(by1, py + Math.sin(a) * r * 0.6))])
      }
      shards = voronoi(seeds, bx0, by0, bx1, by1)
        .filter((p) => p.length > 2)
        .map((poly) => {
          const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length
          const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length
          const dx = cx - px
          const dy = cy - py
          const d = Math.hypot(dx, dy) + 1
          const kick = 600 / Math.sqrt(d)
          return { poly, cx, cy, x: 0, y: 0, a: 0, vx: (dx / d) * kick * 4 + (Math.random() - 0.5) * 80, vy: (dy / d) * kick * 3 - 200 * Math.random(), w: (Math.random() - 0.5) * 8, delay: Math.random() * 0.25 }
        })
      t0 = performance.now()
      last = 0
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    }
    const click = (e) => {
      const r = el.getBoundingClientRect()
      smash(e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('click', click)
    draw(performance.now())
    const auto = setTimeout(() => smash(W / 2 - w * 0.12, H / 2 + size * 0.08), 900)
    return () => {
      clearTimeout(auto)
      cancelAnimationFrame(raf)
      el.removeEventListener('click', click)
    }
  }, [text, pieces, gravity, ink, accent])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(#f7f6f3 80%, #e6e2da)', cursor: 'crosshair', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
