import { useEffect, useRef } from 'react'

// A sheet of paper catching fire where you light it. Fire can only spread
// from paper that is already burning, so the time each spot catches is
// worked out as a real spread across the sheet (the quickest path from the
// ignition point over the grid, Dijkstra-style): the fibres burn at
// slightly different rates, which makes the edge ragged, and flame climbs,
// so the fire runs faster upward than down. Ahead of the edge the heat
// yellows and browns the paper, then it chars black, a thin line of embers
// glows at the very edge, and behind that the paper is gone. The print
// burns with the paper. Sparks and smoke rise off the edge. Click to light
// a fresh sheet from there.
export default function BurningPaper({
  text = 'BURN AFTER READING',
  speed = 1,
  paper = '#f2ead8',
  ink = '#1d1d1f',
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
    const CS = 3 // simulation cell, px
    const cw = Math.ceil(W / CS)
    const ch = Math.ceil(H / CS)

    // the sheet with its print
    const sheet = document.createElement('canvas')
    sheet.width = W
    sheet.height = H
    const sg = sheet.getContext('2d', { willReadFrequently: true })
    const font = (s) => `700 ${s}px Georgia, 'Times New Roman', serif`
    let size = H * 0.16
    sg.font = font(size)
    const words = String(text).split(' ')
    const half = Math.ceil(words.length / 2)
    const linesTxt = words.length > 2 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [text]
    const widest = Math.max(...linesTxt.map((l) => sg.measureText(l).width))
    if (widest > W * 0.8) size *= (W * 0.8) / widest
    const drawText = (ctx, s, sc) => {
      ctx.font = font(s * sc)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      linesTxt.forEach((l, k) => ctx.fillText(l, (W / 2) * sc, (H / 2 + (k - (linesTxt.length - 1) / 2) * s * 1.15) * sc))
    }

    const reset = () => {
      sg.clearRect(0, 0, W, H)
      sg.fillStyle = paper
      sg.fillRect(W * 0.05, H * 0.06, W * 0.9, H * 0.88)
      sg.fillStyle = ink
      drawText(sg, size, 1)
    }
    reset()

    // when each cell catches: distance from the ignition corner, made ragged
    // with a few octaves of value noise
    const noise = (() => {
      const N = 64
      const r = Array.from({ length: N * N }, () => Math.random())
      const at = (x, y) => r[((y % N) + N) % N * N + (((x % N) + N) % N)]
      const smooth = (x, y) => {
        const xi = Math.floor(x)
        const yi = Math.floor(y)
        const xf = x - xi
        const yf = y - yi
        const u = xf * xf * (3 - 2 * xf)
        const v = yf * yf * (3 - 2 * yf)
        return at(xi, yi) * (1 - u) * (1 - v) + at(xi + 1, yi) * u * (1 - v) + at(xi, yi + 1) * (1 - u) * v + at(xi + 1, yi + 1) * u * v
      }
      return (x, y) => smooth(x / 18, y / 18) * 0.6 + smooth(x / 6, y / 6) * 0.3 + smooth(x / 2, y / 2) * 0.1
    })()
    const burnAt = new Float32Array(cw * ch)
    // how slowly each cell burns: paper fibre varies a little
    const slow = new Float32Array(cw * ch)
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) slow[y * cw + x] = 0.55 + noise(x, y) * 0.9
    let ix = cw * 0.06
    let iy = ch * 0.94
    const K = 0.028 * (CS / 3) // seconds per cell at average speed
    // neighbours with a direction factor: upward is quicker (flame climbs)
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1.35], [0, -1, 0.6], [1, 1, 1.9], [-1, 1, 1.9], [1, -1, 0.85], [-1, -1, 0.85]]
    const plan = () => {
      // shortest-path arrival time of the fire, with a binary heap
      burnAt.fill(Infinity)
      const heap = []
      const push = (t, k) => {
        heap.push([t, k])
        let i = heap.length - 1
        while (i > 0) {
          const q = (i - 1) >> 1
          if (heap[q][0] <= heap[i][0]) break
          ;[heap[q], heap[i]] = [heap[i], heap[q]]
          i = q
        }
      }
      const pop = () => {
        const top = heap[0]
        const end = heap.pop()
        if (heap.length) {
          heap[0] = end
          let i = 0
          for (;;) {
            const l = i * 2 + 1
            const r = l + 1
            let m = i
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r
            if (m === i) break
            ;[heap[m], heap[i]] = [heap[i], heap[m]]
            i = m
          }
        }
        return top
      }
      const sx = Math.max(0, Math.min(cw - 1, ix | 0))
      const sy = Math.max(0, Math.min(ch - 1, iy | 0))
      burnAt[sy * cw + sx] = 0
      push(0, sy * cw + sx)
      while (heap.length) {
        const [t, k] = pop()
        if (t > burnAt[k]) continue
        const x = k % cw
        const y = (k / cw) | 0
        for (const [dx, dy, dir] of NB) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue
          const nk = ny * cw + nx
          const nt = t + K * dir * (slow[k] + slow[nk]) * 0.5
          if (nt < burnAt[nk]) {
            burnAt[nk] = nt
            push(nt, nk)
          }
        }
      }
    }
    plan()
    const low = document.createElement('canvas')
    low.width = cw
    low.height = ch
    const lg = low.getContext('2d')
    const holeImg = lg.createImageData(cw, ch)
    const colImg = lg.createImageData(cw, ch)
    const hole = document.createElement('canvas')
    hole.width = cw
    hole.height = ch
    const hg = hole.getContext('2d')
    const ember = document.createElement('canvas')
    ember.width = cw
    ember.height = ch
    const eg = ember.getContext('2d')
    const emberImg = eg.createImageData(cw, ch)

    let t = 0
    let last = 0
    let raf = 0
    const sparks = []
    const smoke = []
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      t += dt * speed
      let front = 0
      for (let k = 0; k < cw * ch; k++) {
        const p = t - burnAt[k]
        const o = k * 4
        let ha = 0
        let r = 0
        let gg = 0
        let b = 0
        let a = 0
        let ea = 0
        if (p > 0.07) {
          ha = 255 // burnt away
        } else if (p > 0) {
          // the ember line: hottest just behind the char, flickering
          const e = p / 0.07
          const f = 0.7 + Math.random() * 0.3
          r = 255
          gg = (170 - 110 * e) * f
          b = 30 * (1 - e)
          a = 255
          ea = 255 * f * (1 - e * 0.5)
          front++
          if (Math.random() < 0.0025) sparks.push({ x: (k % cw) * CS, y: ((k / cw) | 0) * CS, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 70, life: 0.6 + Math.random() * 0.8 })
          if (Math.random() < 0.0012) smoke.push({ x: (k % cw) * CS, y: ((k / cw) | 0) * CS, r: 4, a: 0.22, vx: (Math.random() - 0.5) * 12 })
        } else if (p > -0.12) {
          // charred black just ahead of the embers
          r = 22
          gg = 16
          b = 11
          a = 245
        } else if (p > -0.55) {
          // heat yellowing, then browning, the paper ahead of the fire
          const s2 = (p + 0.55) / 0.43
          r = 150 - 90 * s2
          gg = 105 - 70 * s2
          b = 40 - 25 * s2
          a = 255 * s2 * s2 * 0.85
        }
        holeImg.data[o + 3] = ha
        colImg.data[o] = r
        colImg.data[o + 1] = gg
        colImg.data[o + 2] = b
        colImg.data[o + 3] = a
        emberImg.data[o] = 255
        emberImg.data[o + 1] = 120
        emberImg.data[o + 2] = 20
        emberImg.data[o + 3] = ea
      }
      hg.putImageData(holeImg, 0, 0)
      lg.putImageData(colImg, 0, 0)
      eg.putImageData(emberImg, 0, 0)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      g.drawImage(sheet, 0, 0)
      g.imageSmoothingEnabled = true
      g.globalCompositeOperation = 'destination-out'
      g.drawImage(hole, 0, 0, W, H)
      g.globalCompositeOperation = 'source-atop'
      g.drawImage(low, 0, 0, W, H)
      // the embers glow out past the edge
      g.globalCompositeOperation = 'lighter'
      g.filter = 'blur(5px)'
      g.globalAlpha = 0.7
      g.drawImage(ember, 0, 0, W, H)
      g.globalAlpha = 1
      g.filter = 'none'
      g.globalCompositeOperation = 'source-over'
      // smoke curls up off the edge, spreading and thinning
      for (let k = smoke.length - 1; k >= 0; k--) {
        const s = smoke[k]
        s.y -= 34 * dt
        s.x += (s.vx + Math.sin(now / 500 + k) * 8) * dt
        s.r += 16 * dt
        s.a -= 0.1 * dt
        if (s.a <= 0) {
          smoke.splice(k, 1)
          continue
        }
        const sm = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r)
        sm.addColorStop(0, `rgba(70,64,60,${s.a})`)
        sm.addColorStop(1, 'rgba(70,64,60,0)')
        g.fillStyle = sm
        g.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2)
      }
      // sparks rise on the hot air and cool to grey ash
      for (let k = sparks.length - 1; k >= 0; k--) {
        const s = sparks[k]
        s.life -= dt
        if (s.life <= 0) {
          sparks.splice(k, 1)
          continue
        }
        s.vy -= 20 * dt
        s.x += (s.vx + Math.sin(now / 300 + k) * 12) * dt
        s.y += s.vy * dt
        g.fillStyle = s.life > 0.4 ? `rgba(255,${Math.round(150 + s.life * 60)},60,${Math.min(1, s.life)})` : `rgba(80,74,70,${s.life * 2})`
        g.fillRect(s.x, s.y, 1.6, 1.6)
      }
      if (front || t < 1 || sparks.length || smoke.length) raf = requestAnimationFrame(frame)
    }
    const relight = (e) => {
      const r = el.getBoundingClientRect()
      ix = (e.clientX - r.left) / CS
      iy = (e.clientY - r.top) / CS
      t = 0
      plan()
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(frame)
    }
    el.addEventListener('click', relight)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('click', relight)
    }
  }, [text, speed, paper, ink])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 60%, #2a2320, #121010)', cursor: 'pointer', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
