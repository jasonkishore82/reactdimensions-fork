import { useEffect, useRef } from 'react'

// A sheet of paper catching fire at one corner. The burning front creeps
// across it unevenly (paper fibres burn at slightly different rates, so the
// edge is ragged), with a band of brown scorch ahead of it and a thin line
// of glowing embers right at the edge. Behind the front the paper is gone.
// The printed letters are thicker card, so they burn later: for a moment
// the word stands as charred black shapes outlined in embers before it goes
// too. Ash flecks float up off the edge. Click to light a fresh sheet.
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
    // ink mask at sim resolution
    const im = document.createElement('canvas')
    im.width = cw
    im.height = ch
    const ig = im.getContext('2d', { willReadFrequently: true })
    const drawText = (ctx, s, sc) => {
      ctx.font = font(s * sc)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      linesTxt.forEach((l, k) => ctx.fillText(l, (W / 2) * sc, (H / 2 + (k - (linesTxt.length - 1) / 2) * s * 1.15) * sc))
    }
    ig.fillStyle = '#000'
    drawText(ig, size, 1 / CS)
    const inkD = ig.getImageData(0, 0, cw, ch).data

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
    const isInk = new Uint8Array(cw * ch)
    let ix = 0
    let iy = ch
    const plan = () => {
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const k = y * cw + x
          isInk[k] = inkD[k * 4 + 3] > 120 ? 1 : 0
          const dist = Math.hypot(x - ix, y - iy)
          burnAt[k] = dist * 0.028 + noise(x, y) * 1.6 + (isInk[k] ? 0.7 : 0)
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

    let t = 0
    let last = 0
    let raf = 0
    const ash = []
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
        if (p > 0.35) {
          ha = 255 // gone
        } else if (p > 0.25) {
          // glowing edge
          const e = 1 - (p - 0.25) / 0.1
          r = 255
          gg = 120 + 100 * e
          b = 30
          a = 255
          front++
        } else if (p > -0.25) {
          // scorch ahead of the edge: brown deepening to black
          const s = (p + 0.25) / 0.5
          r = 90 * (1 - s)
          gg = 50 * (1 - s)
          b = 20 * (1 - s)
          a = Math.min(255, s * 300)
        }
        holeImg.data[o + 3] = ha
        colImg.data[o] = r
        colImg.data[o + 1] = gg
        colImg.data[o + 2] = b
        colImg.data[o + 3] = a
        if (p > 0.25 && p < 0.35 && Math.random() < 0.0015) ash.push({ x: (k % cw) * CS, y: ((k / cw) | 0) * CS, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 40, life: 1 + Math.random() })
      }
      hg.putImageData(holeImg, 0, 0)
      lg.putImageData(colImg, 0, 0)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      g.drawImage(sheet, 0, 0)
      g.imageSmoothingEnabled = true
      g.globalCompositeOperation = 'destination-out'
      g.drawImage(hole, 0, 0, W, H)
      g.globalCompositeOperation = 'source-atop'
      g.drawImage(low, 0, 0, W, H)
      g.globalCompositeOperation = 'lighter'
      g.filter = 'blur(3px)'
      g.drawImage(low, 0, 0, W, H)
      g.filter = 'none'
      g.globalCompositeOperation = 'source-over'
      for (let k = ash.length - 1; k >= 0; k--) {
        const s = ash[k]
        s.life -= dt
        if (s.life <= 0) {
          ash.splice(k, 1)
          continue
        }
        s.x += (s.vx + Math.sin(now / 300 + k) * 10) * dt
        s.y += s.vy * dt
        g.fillStyle = s.life > 0.7 ? `rgba(255,170,60,${s.life - 0.7})` : `rgba(60,55,50,${s.life})`
        g.fillRect(s.x, s.y, 2, 2)
      }
      if (front || t < 2 || ash.length) raf = requestAnimationFrame(frame)
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
