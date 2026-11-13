import { useEffect, useRef } from 'react'

// The word built from toy bricks, bottom row first. Each brick drops in
// from above, presses down onto the studs of the bricks below with a small
// squash and rebound, and the next one follows. Wherever two cells sit side
// by side in a letter they're joined into one longer brick, the way you'd
// really build it, and only the studs that nothing sits on are visible.
// Click to knock it down and build it again.
const COLORS = ['#e3342f', '#f6b93b', '#3490dc', '#38c172', '#9561e2', '#f66d9b']

export default function BrickText({
  text = 'BUILD',
  stagger = 45,
  cell = 0,
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
    let bricks = []
    let t0 = 0
    let raf = 0
    let u = 16
    let gridH = 0
    let ox = 0
    let oy = 0
    let topOf = null

    const build = () => {
      W = el.clientWidth
      H = el.clientHeight
      c.width = W * dpr
      c.height = H * dpr
      // the word on a coarse grid: 9 bricks tall
      const rows = 9
      const m = document.createElement('canvas')
      const mg = m.getContext('2d', { willReadFrequently: true })
      const font = `900 ${rows * 4 * 1.2}px 'Arial Black', Impact, sans-serif`
      mg.font = font
      const chars = [...text]
      const gaps = 4
      let wpx = 0
      const ws = chars.map((ch) => mg.measureText(ch).width)
      wpx = ws.reduce((a, b) => a + b + gaps, 0)
      m.width = Math.ceil(wpx)
      m.height = rows * 4
      mg.font = font
      mg.textBaseline = 'alphabetic'
      let x = 0
      const owner = []
      chars.forEach((ch, i) => {
        mg.fillStyle = `rgb(${i + 1},0,0)`
        mg.fillText(ch, x, rows * 4 * 0.92)
        x += ws[i] + gaps
      })
      const d = mg.getImageData(0, 0, m.width, m.height).data
      const cols = Math.ceil(m.width / 4)
      const grid = []
      for (let r = 0; r < rows; r++) {
        grid.push([])
        for (let q = 0; q < cols; q++) {
          let a = 0
          let who = 0
          for (let dy = 0; dy < 4; dy++)
            for (let dx = 0; dx < 4; dx++) {
              const k = ((r * 4 + dy) * m.width + q * 4 + dx) * 4
              if (d[k + 3] > 128) {
                a++
                who = d[k]
              }
            }
          grid[r].push(a >= 7 ? who : 0)
        }
      }
      u = cell || Math.min((W * 0.9) / cols, (H * 0.7) / (rows * 1.2))
      const bh = u * 1.2
      gridH = rows * bh
      ox = (W - cols * u) / 2
      oy = (H - gridH) / 2 + u * 0.3
      // join runs of up to 4 cells of the same letter into one brick,
      // staggering joints between rows like real brickwork
      bricks = []
      for (let r = rows - 1; r >= 0; r--) {
        let q = 0
        while (q < cols) {
          const who = grid[r][q]
          if (!who) {
            q++
            continue
          }
          let len = 1
          const maxLen = (rows - r) % 2 ? 2 : 3
          while (q + len < cols && grid[r][q + len] === who && len < maxLen) len++
          bricks.push({ r, q, len, col: COLORS[(who - 1) % COLORS.length], y: 0, v: 0, landed: false, at: 0 })
          q += len
        }
      }
      bricks.forEach((b, i) => (b.at = 300 + i * stagger))
      // which cells have something on top (to hide those studs)
      topOf = (b) => {
        for (const o of bricks) if (o.r === b.r - 1 && o.landed && o.q < b.q + b.len && o.q + o.len > b.q) return true
        return false
      }
      t0 = 0
    }

    let last = 0
    const frame = (now) => {
      t0 ||= now
      const dt = Math.min(0.033, (now - (last || now)) / 1000)
      last = now
      const t = now - t0
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      const bh = u * 1.2
      // the baseplate
      g.fillStyle = '#2f9e44'
      g.fillRect(ox - u, oy + gridH, (W - 2 * ox) + 2 * u, u * 0.35)
      for (const b of bricks) {
        if (t < b.at) continue
        const restY = oy + b.r * bh
        if (!b.started) {
          b.started = true
          b.y = restY - H * 0.5
          b.v = 0
        }
        if (!b.landed) {
          b.v += 5200 * dt
          b.y += b.v * dt
          if (b.y >= restY) {
            b.y = restY
            b.landed = true
            b.squash = 1
          }
        }
        b.squash = Math.max(0, (b.squash || 0) - dt * 7)
        const sq = Math.sin(b.squash * Math.PI) * 0.06
        const x = ox + b.q * u
        const w = b.len * u
        const y = b.y + bh * sq
        const h = bh * (1 - sq)
        // body with a lit top edge and a darker side
        g.fillStyle = b.col
        g.fillRect(x + 0.5, y, w - 1, h)
        g.fillStyle = 'rgba(255,255,255,.22)'
        g.fillRect(x + 0.5, y, w - 1, h * 0.12)
        g.fillStyle = 'rgba(0,0,0,.18)'
        g.fillRect(x + 0.5, y + h * 0.82, w - 1, h * 0.18)
        g.fillRect(x + w - 1.5, y, 1, h)
        // studs on top, unless covered
        if (!(b.landed && topOf(b))) {
          for (let s = 0; s < b.len; s++) {
            const sx = x + (s + 0.5) * u
            g.fillStyle = b.col
            g.fillRect(sx - u * 0.3, y - u * 0.18, u * 0.6, u * 0.2)
            g.fillStyle = 'rgba(255,255,255,.3)'
            g.fillRect(sx - u * 0.3, y - u * 0.18, u * 0.6, u * 0.05)
            g.fillStyle = 'rgba(0,0,0,.15)'
            g.fillRect(sx + u * 0.15, y - u * 0.18, u * 0.15, u * 0.2)
          }
        }
      }
      raf = requestAnimationFrame(frame)
    }

    // knock it down: bricks fly off, then it rebuilds
    const knock = () => {
      const all = bricks
      const start = performance.now()
      cancelAnimationFrame(raf)
      const fly = all.map((b) => ({ ...b, vx: (Math.random() - 0.5) * 900, vy: -300 - Math.random() * 600, rot: 0, w: (Math.random() - 0.5) * 12 }))
      let prev = start
      const out = (now) => {
        const dt = Math.min(0.033, (now - prev) / 1000)
        prev = now
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
        g.clearRect(0, 0, W, H)
        for (const b of fly) {
          b.vy += 2600 * dt
          b.q += (b.vx * dt) / u
          b.y += b.vy * dt
          b.rot += b.w * dt
          g.save()
          g.translate(ox + (b.q + b.len / 2) * u, b.y + u * 0.6)
          g.rotate(b.rot)
          g.fillStyle = b.col
          g.fillRect((-b.len * u) / 2, -u * 0.6, b.len * u, u * 1.2)
          g.restore()
        }
        if (now - start < 900) raf = requestAnimationFrame(out)
        else {
          build()
          raf = requestAnimationFrame(frame)
        }
      }
      raf = requestAnimationFrame(out)
    }

    build()
    el.addEventListener('click', knock)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('click', knock)
    }
  }, [text, stagger, cell])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(#f6f4ef, #e7e2d8)', cursor: 'pointer', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
