import { useEffect, useRef } from 'react'

// Light painting: a long-exposure photo of someone writing in the dark with
// a sparkler. The glowing point traces round each letter's outline and the
// exposure keeps everything it passed, so a streak of light builds up behind
// it, brightest where it moved slowly. Between letters the light is covered,
// so it leaves no trail. Sparks spit off the tip. When the word is done the
// "shutter" closes and the frame fades, ready for the next exposure.
function outlines(text, W, H, cell) {
  const cols = Math.ceil(W / cell)
  const rows = Math.ceil(H / cell)
  const c = document.createElement('canvas')
  c.width = cols
  c.height = rows
  const g = c.getContext('2d', { willReadFrequently: true })
  let size = rows * 0.6
  const font = (s) => `italic 700 ${s}px 'Brush Script MT', 'Segoe Script', Georgia, serif`
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
    if (loop.length > 4) {
      loop.push(loop[0])
      loops.push(loop.map(([x, y]) => [x * cell, y * cell]))
    }
  }
  loops.sort((a, b) => Math.min(...a.map((p) => p[0])) - Math.min(...b.map((p) => p[0])))
  return loops
}

export default function LightPainting({
  text = 'Light',
  color = '#ffb347',
  speed = 520,
  sparks = true,
  style,
}) {
  const box = useRef()
  const cv = useRef()
  const fx = useRef()

  useEffect(() => {
    const el = box.current
    const W = el.clientWidth
    const H = el.clientHeight
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const g = cv.current.getContext('2d')
    const gf = fx.current.getContext('2d')
    for (const k of [cv.current, fx.current]) {
      k.width = W * dpr
      k.height = H * dpr
    }
    g.scale(dpr, dpr)
    gf.scale(dpr, dpr)
    const loops = outlines(String(text), W, H, Math.max(2, W / 300))
    let li = 0
    let pi = 0
    let f = 0
    let raf = 0
    let last = 0
    let pause = 0
    let fading = 0
    const sp = []
    const streak = (a, b) => {
      g.globalCompositeOperation = 'lighter'
      g.lineCap = 'round'
      // a wide soft bloom, then the hot core
      g.strokeStyle = color + '22'
      g.lineWidth = 10
      g.beginPath()
      g.moveTo(...a)
      g.lineTo(...b)
      g.stroke()
      g.strokeStyle = color + '88'
      g.lineWidth = 3.5
      g.stroke()
      g.strokeStyle = '#fff8e8'
      g.lineWidth = 1.2
      g.stroke()
      g.globalCompositeOperation = 'source-over'
    }
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      let tip = null
      if (fading > 0) {
        // shutter closed: the frame fades to black, then a new exposure
        fading -= dt
        g.globalCompositeOperation = 'destination-out'
        g.fillStyle = 'rgba(0,0,0,.08)'
        g.fillRect(0, 0, W, H)
        g.globalCompositeOperation = 'source-over'
        if (fading <= 0) {
          g.clearRect(0, 0, W, H)
          li = pi = 0
          f = 0
          pause = 0.4
        }
      } else if (pause > 0) {
        pause -= dt
      } else if (li < loops.length) {
        let budget = speed * dt
        while (budget > 0 && li < loops.length) {
          const loop = loops[li]
          if (pi >= loop.length - 1) {
            li++
            pi = 0
            f = 0
            pause = 0.12
            break
          }
          const a = loop[pi]
          const b = loop[pi + 1]
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.01
          const from = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
          const nf = Math.min(1, f + budget / len)
          budget -= (nf - f) * len
          const to = [a[0] + (b[0] - a[0]) * nf, a[1] + (b[1] - a[1]) * nf]
          streak(from, to)
          tip = to
          f = nf
          if (f >= 1) {
            pi++
            f = 0
          }
        }
        if (li >= loops.length) fading = 2.6
      }
      // the sparkler tip and its sparks, which aren't part of the exposure
      gf.clearRect(0, 0, W, H)
      if (tip) {
        const halo = gf.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], 26)
        halo.addColorStop(0, '#ffffff')
        halo.addColorStop(0.2, color + 'cc')
        halo.addColorStop(1, color + '00')
        gf.fillStyle = halo
        gf.fillRect(tip[0] - 26, tip[1] - 26, 52, 52)
        if (sparks) for (let k = 0; k < 4; k++) sp.push({ x: tip[0], y: tip[1], vx: (Math.random() - 0.5) * 320, vy: (Math.random() - 0.7) * 320, life: 0.25 + Math.random() * 0.35 })
      }
      gf.strokeStyle = '#fff3c9'
      gf.lineWidth = 1
      for (let i = sp.length - 1; i >= 0; i--) {
        const s = sp[i]
        s.life -= dt
        if (s.life <= 0) {
          sp.splice(i, 1)
          continue
        }
        s.vy += 500 * dt
        gf.globalAlpha = Math.min(1, s.life * 3)
        gf.beginPath()
        gf.moveTo(s.x, s.y)
        s.x += s.vx * dt
        s.y += s.vy * dt
        gf.lineTo(s.x, s.y)
        gf.stroke()
      }
      gf.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [text, color, speed, sparks])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(120% 90% at 50% 100%, #12131c, #050507)', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas ref={fx} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
