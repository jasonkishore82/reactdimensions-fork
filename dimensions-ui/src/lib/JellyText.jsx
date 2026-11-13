import { useEffect, useRef } from 'react'

// Jelly letters: each one is a soft body, a grid of masses joined by springs
// to their neighbours and held loosely to their rest shape. Poke a letter
// (or drag through it) and the push travels through the grid as a wobble,
// overshooting and settling slowly like real jelly. The letter is drawn by
// stretching its picture over the moving grid, triangle by triangle, with a
// glossy highlight that slides as it deforms. They drop in and land with a
// squash to start.
const N = 5 // grid points per side

export default function JellyText({
  text = 'JELLY',
  color = '#ff4d6d',
  stiffness = 1,
  wobble = 1,
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
    const chars = [...String(text)].filter((ch) => ch !== ' ')
    let size = H * 0.42
    const font = (s) => `900 ${s}px 'Arial Rounded MT Bold', 'Arial Black', sans-serif`
    const meas = document.createElement('canvas').getContext('2d')
    meas.font = font(size)
    const total = chars.reduce((a, ch) => a + meas.measureText(ch).width * 1.08, 0)
    if (total > W * 0.86) size *= (W * 0.86) / total
    meas.font = font(size)

    // one picture per letter, glossy jelly
    let x = W / 2 - chars.reduce((a, ch) => a + meas.measureText(ch).width * 1.08, 0) / 2
    const bodies = chars.map((ch, li) => {
      const w = meas.measureText(ch).width * 1.08
      const h = size * 1.1
      const pic = document.createElement('canvas')
      pic.width = Math.ceil(w * dpr)
      pic.height = Math.ceil(h * dpr)
      const pg = pic.getContext('2d')
      pg.scale(dpr, dpr)
      pg.font = font(size)
      pg.textAlign = 'center'
      pg.textBaseline = 'middle'
      pg.fillStyle = color
      pg.fillText(ch, w / 2, h / 2)
      // gloss: a white band clipped to the letter
      pg.globalCompositeOperation = 'source-atop'
      const gl = pg.createLinearGradient(0, h * 0.2, 0, h * 0.5)
      gl.addColorStop(0, 'rgba(255,255,255,.55)')
      gl.addColorStop(1, 'rgba(255,255,255,0)')
      pg.fillStyle = gl
      pg.fillRect(0, 0, w, h * 0.5)
      pg.fillStyle = 'rgba(0,0,0,.18)'
      pg.fillRect(0, h * 0.7, w, h * 0.3)
      const ox = x
      x += w
      const oy = H / 2 - h / 2
      const pts = []
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const rx = ox + (i / (N - 1)) * w
          const ry = oy + (j / (N - 1)) * h
          pts.push({ rx, ry, x: rx, y: ry - H * 0.8 - li * 60, vx: 0, vy: 0, u: i / (N - 1), v: j / (N - 1) })
        }
      }
      return { pic, w, h, pts, drop: true }
    })

    let raf = 0
    let last = 0
    let poke = null
    const K = 220 * stiffness
    const KN = 380 * stiffness
    const D = 3.2 / wobble
    const step = (dt) => {
      for (const b of bodies) {
        const P = b.pts
        for (let k = 0; k < P.length; k++) {
          const p = P[k]
          let fx = 0
          let fy = 0
          if (b.drop) {
            fy += 2600
          } else {
            // held loosely to the rest shape
            fx += (p.rx - p.x) * K
            fy += (p.ry - p.y) * K
          }
          // springs to the right and down neighbours (and back)
          const i = k % N
          const j = (k / N) | 0
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ii = i + di
            const jj = j + dj
            if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue
            const q = P[jj * N + ii]
            const ex = q.x - p.x - (q.rx - p.rx)
            const ey = q.y - p.y - (q.ry - p.ry)
            fx += ex * KN
            fy += ey * KN
          }
          if (poke) {
            const d = Math.hypot(p.x - poke.x, p.y - poke.y)
            if (d < 60) {
              fx += poke.vx * (1 - d / 60) * 30
              fy += poke.vy * (1 - d / 60) * 30
            }
          }
          p.vx = (p.vx + fx * dt) * Math.exp(-D * dt)
          p.vy = (p.vy + fy * dt) * Math.exp(-D * dt)
        }
        for (const p of P) {
          p.x += p.vx * dt
          p.y += p.vy * dt
        }
        // landing: the bottom row hits the line, and the body switches to
        // springing back to its rest shape, which gives the squash
        if (b.drop) {
          const bottom = P[(N - 1) * N].y
          const rest = P[(N - 1) * N].ry
          if (bottom >= rest) {
            b.drop = false
            for (const p of P) p.vy *= 0.35
          }
        }
      }
    }
    const tri = (pic, w, h, a, b2, c2) => {
      // map the picture's triangle (u,v) onto the moving one with an affine
      // transform, clipped to the triangle
      const [u0, v0, x0, y0] = [a.u * w, a.v * h, a.x, a.y]
      const [u1, v1, x1, y1] = [b2.u * w, b2.v * h, b2.x, b2.y]
      const [u2, v2, x2, y2] = [c2.u * w, c2.v * h, c2.x, c2.y]
      const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)
      if (!det) return
      const m11 = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / det
      const m12 = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / det
      const m21 = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / det
      const m22 = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / det
      const dx = x0 - m11 * u0 - m21 * v0
      const dy = y0 - m12 * u0 - m22 * v0
      // expand the clip a hair so triangles don't show seams
      const cx = (x0 + x1 + x2) / 3
      const cy = (y0 + y1 + y2) / 3
      const ex = (px, py) => [px + (px - cx) * 0.03, py + (py - cy) * 0.03]
      g.save()
      g.beginPath()
      g.moveTo(...ex(x0, y0))
      g.lineTo(...ex(x1, y1))
      g.lineTo(...ex(x2, y2))
      g.closePath()
      g.clip()
      g.transform(m11, m12, m21, m22, dx, dy)
      g.drawImage(pic, 0, 0, w, h)
      g.restore()
    }
    const frame = (now) => {
      const dt = Math.min(0.033, (now - (last || now)) / 1000)
      last = now
      for (let s = 0; s < 4; s++) step(dt / 4)
      if (poke) {
        poke.vx *= 0.5
        poke.vy *= 0.5
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      // a soft shadow under each letter
      for (const b of bodies) {
        const P = b.pts
        const l = P[(N - 1) * N]
        const r = P[N * N - 1]
        g.fillStyle = 'rgba(0,0,0,.12)'
        g.beginPath()
        g.ellipse((l.x + r.x) / 2, l.ry + 4, Math.abs(r.x - l.x) * 0.45, 6, 0, 0, Math.PI * 2)
        g.fill()
      }
      for (const b of bodies) {
        const P = b.pts
        for (let j = 0; j < N - 1; j++) {
          for (let i = 0; i < N - 1; i++) {
            const a = P[j * N + i]
            const bb = P[j * N + i + 1]
            const cc = P[(j + 1) * N + i]
            const dd = P[(j + 1) * N + i + 1]
            tri(b.pic, b.w, b.h, a, bb, cc)
            tri(b.pic, b.w, b.h, bb, dd, cc)
          }
        }
      }
      raf = requestAnimationFrame(frame)
    }
    let lastP = null
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left
      const py = e.clientY - r.top
      if (lastP && (e.buttons || e.type === 'pointerdown' || e.pointerType !== 'mouse')) poke = { x: px, y: py, vx: (px - lastP.x) * 40, vy: (py - lastP.y) * 40 }
      else if (lastP) poke = { x: px, y: py, vx: (px - lastP.x) * 14, vy: (py - lastP.y) * 14 }
      lastP = { x: px, y: py }
    }
    const down = (e) => {
      const r = el.getBoundingClientRect()
      poke = { x: e.clientX - r.left, y: e.clientY - r.top, vx: 0, vy: 900 }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerdown', down)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerdown', down)
    }
  }, [text, color, stiffness, wobble])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(#fdf7f2 70%, #f1e6dc)', cursor: 'pointer', touchAction: 'none', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
