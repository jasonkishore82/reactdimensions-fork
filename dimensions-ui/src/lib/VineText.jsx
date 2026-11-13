import { useEffect, useRef } from 'react'

// Letters that grow as climbing vines. A stem creeps along the outline of
// each letter, thickening as it ages (the oldest part of a stem is the
// thickest), putting out leaves on alternate sides as it goes, curling a
// tendril now and then, and every so often opening a small flower. All the
// letters grow at once, like plants in a bed.
function outlines(text, W, H, cell) {
  const cols = Math.ceil(W / cell)
  const rows = Math.ceil(H / cell)
  const c = document.createElement('canvas')
  c.width = cols
  c.height = rows
  const g = c.getContext('2d', { willReadFrequently: true })
  let size = rows * 0.6
  const font = (s) => `700 ${s}px Georgia, 'Times New Roman', serif`
  g.font = font(size)
  const tw = g.measureText(text).width
  if (tw > cols * 0.86) size *= (cols * 0.86) / tw
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
    if (loop.length > 4) {
      loop.push(loop[0])
      // smooth the staircase a little
      const sm = loop.map((p, i) => {
        const a = loop[Math.max(0, i - 2)]
        const b = loop[Math.min(loop.length - 1, i + 2)]
        return [((a[0] + p[0] * 2 + b[0]) / 4) * cell, ((a[1] + p[1] * 2 + b[1]) / 4) * cell]
      })
      loops.push(sm)
    }
  }
  return loops
}

export default function VineText({
  text = 'Grow',
  stem = '#3f6b2a',
  leaf = '#5f9e3a',
  flower = '#ff7aa8',
  speed = 120,
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
    const loops = outlines(String(text), W, H, Math.max(2, W / 320))
    // each loop grows from a random point, at its own pace
    const vines = loops.map((pts) => {
      const start = (Math.random() * pts.length) | 0
      return { pts: [...pts.slice(start), ...pts.slice(0, start)], i: 0, dist: 0, nextLeaf: 10, side: 1, rate: 0.8 + Math.random() * 0.4 }
    })
    const leafAt = (x, y, ang, s) => {
      g.save()
      g.translate(x, y)
      g.rotate(ang)
      g.fillStyle = leaf
      g.beginPath()
      g.moveTo(0, 0)
      g.quadraticCurveTo(s * 0.5, -s * 0.45, s, 0)
      g.quadraticCurveTo(s * 0.5, s * 0.45, 0, 0)
      g.fill()
      g.strokeStyle = 'rgba(30,60,20,.4)'
      g.lineWidth = 0.6
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(s * 0.9, 0)
      g.stroke()
      g.restore()
    }
    const tendril = (x, y, ang) => {
      g.strokeStyle = stem
      g.lineWidth = 0.8
      g.beginPath()
      g.moveTo(x, y)
      let a = ang
      let r = 7
      let px = x
      let py = y
      for (let k = 0; k < 26; k++) {
        a += 0.45
        r *= 0.93
        px += Math.cos(a) * r * 0.35
        py += Math.sin(a) * r * 0.35
        g.lineTo(px, py)
      }
      g.stroke()
    }
    const bloom = (x, y) => {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        g.fillStyle = flower
        g.beginPath()
        g.ellipse(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 3.2, 2, a, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = '#ffd34d'
      g.beginPath()
      g.arc(x, y, 1.8, 0, Math.PI * 2)
      g.fill()
    }
    let raf = 0
    let last = 0
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      let growing = false
      for (const v of vines) {
        // keep the loop alive while any vine is unfinished, even on a frame
        // with no time in it (the first one), or it would stop before starting
        if (v.i < v.pts.length - 1) growing = true
        let budget = speed * v.rate * dt
        while (budget > 0 && v.i < v.pts.length - 1) {
          const a = v.pts[v.i]
          const b = v.pts[v.i + 1]
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.01
          // stem: thickens with age, drawn as it grows
          const age = v.i / v.pts.length
          g.strokeStyle = stem
          g.lineCap = 'round'
          g.lineWidth = 1.2 + (1 - age) * 1.8
          g.beginPath()
          g.moveTo(a[0], a[1])
          g.lineTo(b[0], b[1])
          g.stroke()
          v.dist += len
          budget -= len
          v.i++
          if (v.dist > v.nextLeaf) {
            const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
            v.side = -v.side
            const roll = Math.random()
            if (roll < 0.08) tendril(b[0], b[1], ang + v.side * 1.2)
            else if (roll < 0.14) bloom(b[0], b[1])
            else leafAt(b[0], b[1], ang + v.side * (0.7 + Math.random() * 0.4), 6 + Math.random() * 6)
            v.nextLeaf = v.dist + 9 + Math.random() * 14
          }
        }
      }
      if (growing) raf = requestAnimationFrame(frame)
    }
    const start = setTimeout(() => (raf = requestAnimationFrame(frame)), 300)
    return () => {
      clearTimeout(start)
      cancelAnimationFrame(raf)
    }
  }, [text, stem, leaf, flower, speed])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(120% 100% at 50% 30%, #fbf8ef, #ece4d0)', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
