import { useEffect, useRef } from 'react'

// Machine embroidery: the needle fills each letter with rows of fill
// stitches, one stitch at a time, the way a sewing machine works through a
// design. Each stitch is a short length of thread lying slightly slanted,
// the rows offset like brickwork so the fill reads as a weave, and every
// thread has a light catching its upper edge. Tension pulls the cloth in a
// touch round the stitched area, so the letters cast a faint pucker shadow.
export default function EmbroideryText({
  text = 'Stitch',
  thread = '#d6334a',
  cloth = '#efe7d8',
  speed = 900,
  style,
}) {
  const box = useRef()
  const cv = useRef()

  useEffect(() => {
    const el = box.current
    const c = cv.current
    const g = c.getContext('2d')
    const W = el.clientWidth
    const H = el.clientHeight
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = W * dpr
    c.height = H * dpr
    g.scale(dpr, dpr)

    // the letters as a mask
    const m = document.createElement('canvas')
    m.width = W
    m.height = H
    const mg = m.getContext('2d', { willReadFrequently: true })
    let size = H * 0.5
    const font = (s) => `700 ${s}px 'Brush Script MT', 'Segoe Script', Georgia, serif`
    mg.font = font(size)
    const tw = mg.measureText(text).width
    if (tw > W * 0.86) size *= (W * 0.86) / tw
    mg.font = font(size)
    mg.textAlign = 'center'
    mg.textBaseline = 'middle'
    mg.fillText(text, W / 2, H / 2)
    const d = mg.getImageData(0, 0, W, H).data
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[((y | 0) * W + (x | 0)) * 4 + 3] > 120

    // plan the stitches: rows 2.6px apart, each run cut into stitches of
    // up to 9px, alternate rows shifted half a stitch; work in snaking rows
    const ROW = 2.6
    const LEN = 9
    const stitches = []
    let flip = false
    for (let y = 0; y < H; y += ROW) {
      const runs = []
      let x0 = -1
      for (let x = 0; x <= W; x++) {
        const on = x < W && inside(x, y)
        if (on && x0 < 0) x0 = x
        if (!on && x0 >= 0) {
          runs.push([x0, x - 1])
          x0 = -1
        }
      }
      const row = []
      const shift = ((y / ROW) | 0) % 2 ? LEN / 2 : 0
      for (const [a, b] of runs) {
        let x = a
        let first = true
        while (x < b) {
          const step = first ? Math.min(b - x, LEN - shift || LEN) : Math.min(b - x, LEN)
          first = false
          row.push([x, y, x + Math.max(1.5, step), y + 1.1])
          x += Math.max(1.5, step)
        }
      }
      // snake back on alternate rows: reverse the order and each stitch's direction
      if (flip) row.reverse()
      stitches.push(...(flip ? row.map(([x1, y1, x2, y2]) => [x2, y2, x1, y1]) : row))
      if (row.length) flip = !flip
    }

    // the pucker: a soft shadow under the stitched area, drawn as it fills
    const drawStitch = ([x1, y1, x2, y2]) => {
      g.lineCap = 'round'
      g.strokeStyle = 'rgba(0,0,0,.12)'
      g.lineWidth = 3.2
      g.beginPath()
      g.moveTo(x1 + 0.6, y1 + 1)
      g.lineTo(x2 + 0.6, y2 + 1)
      g.stroke()
      g.strokeStyle = thread
      g.lineWidth = 2.4
      g.beginPath()
      g.moveTo(x1, y1)
      g.lineTo(x2, y2)
      g.stroke()
      // the sheen along the twist of the thread
      g.strokeStyle = 'rgba(255,255,255,.35)'
      g.lineWidth = 0.8
      g.beginPath()
      g.moveTo(x1 + 0.5, y1 - 0.5)
      g.lineTo(x2 - 0.5, y2 - 0.5)
      g.stroke()
    }

    let i = 0
    let raf = 0
    let last = 0
    const needle = el.querySelector('[data-needle]')
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      let n = Math.max(1, Math.round(speed * dt))
      while (n-- > 0 && i < stitches.length) drawStitch(stitches[i++])
      const s = stitches[Math.min(i, stitches.length - 1)]
      if (needle && s) {
        needle.style.transform = `translate(${s[2]}px, ${s[3]}px)`
        needle.style.opacity = i < stitches.length ? '1' : '0'
      }
      if (i < stitches.length) raf = requestAnimationFrame(frame)
    }
    const start = setTimeout(() => (raf = requestAnimationFrame(frame)), 300)
    return () => {
      clearTimeout(start)
      cancelAnimationFrame(raf)
    }
  }, [text, thread, cloth, speed])

  return (
    <div
      ref={box}
      role="img"
      aria-label={text}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        // a plain weave: fine crossing threads
        background: `repeating-linear-gradient(0deg, rgba(0,0,0,.05) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0 1px, transparent 1px 3px), ${cloth}`,
        ...style,
      }}
    >
      {/* the embroidery hoop */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', width: 'min(96%, 140vh)', aspectRatio: '1.7', transform: 'translate(-50%, -50%)', borderRadius: '50%', boxShadow: '0 0 0 14px #c79a62, 0 0 0 16px #a77b45, 0 0 0 9999px rgba(30,24,16,.12)', pointerEvents: 'none' }} />
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {/* the needle */}
      <div data-needle aria-hidden="true" style={{ position: 'absolute', left: -1, top: -60, width: 2, height: 60, background: 'linear-gradient(#e6e8ec, #8d9098)', borderRadius: 1, boxShadow: '1px 0 2px rgba(0,0,0,.3)', pointerEvents: 'none', opacity: 0 }} />
    </div>
  )
}
