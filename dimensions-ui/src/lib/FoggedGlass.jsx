import { useEffect, useRef } from 'react'

// Writing on a steamed-up window. A fingertip wipes the word through the
// fog, and through the clear strokes you see the lit street outside. Where
// the finger pushed the condensation together it beads up, and the heavier
// beads run down from the bottoms of the strokes, clearing thin trails. The
// fog slowly creeps back over everything. Drag to write on it yourself.
export default function FoggedGlass({
  text = 'hello',
  fog = 0.82,
  regrow = 1,
  style,
}) {
  const box = useRef()
  const cv = useRef()
  const ovRef = useRef()

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

    const fill = (a) => {
      g.fillStyle = `rgba(214,222,228,${a})`
      g.fillRect(0, 0, W, H)
    }
    fill(fog)
    // fine droplets in the fog
    for (let k = 0; k < 2500; k++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`
      g.fillRect(Math.random() * W, Math.random() * H, 1.2, 1.2)
    }

    // the finger's path: trace each letter's centre-ish by following the
    // outline of a thin rendering with a brush as wide as the stroke
    const m = document.createElement('canvas')
    const cell = 3
    const cols = Math.ceil(W / cell)
    const rows = Math.ceil(H / cell)
    m.width = cols
    m.height = rows
    const mg = m.getContext('2d', { willReadFrequently: true })
    let size = rows * 0.55
    const font = (s) => `400 ${s}px 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive`
    mg.font = font(size)
    const tw = mg.measureText(text).width
    if (tw > cols * 0.84) size *= (cols * 0.84) / tw
    mg.font = font(size)
    mg.textAlign = 'center'
    mg.textBaseline = 'middle'
    mg.fillText(text, cols / 2, rows / 2)
    const d = mg.getImageData(0, 0, cols, rows).data
    // collect ink cells column by column, like writing left to right
    const pts = []
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (d[(y * cols + x) * 4 + 3] > 90) pts.push([x * cell, y * cell])
    const brush = Math.max(6, size * cell * 0.07)

    const inStroke = (x, y) => {
      const cx = (x / cell) | 0
      const cy = (y / cell) | 0
      return cx >= 0 && cy >= 0 && cx < cols && cy < rows && d[(cy * cols + cx) * 4 + 3] > 90
    }

    // water on the glass is drawn on its own layer, every frame, as lenses:
    // static beads where the finger pushed condensation aside, and runs that
    // slide down from the bottoms of the strokes
    const ov = ovRef.current
    const o = ov.getContext('2d')
    ov.width = W * dpr
    ov.height = H * dpr
    o.scale(dpr, dpr)
    const beads = []
    const runs = []

    let i = 0
    let raf = 0
    let last = 0
    let user = null
    const wipe = (x, y, r) => {
      g.globalCompositeOperation = 'destination-out'
      const gr = g.createRadialGradient(x, y, r * 0.4, x, y, r)
      gr.addColorStop(0, 'rgba(0,0,0,.9)')
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = gr
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.fill()
      g.globalCompositeOperation = 'source-over'
    }
    // condensation the finger pushes ahead of it collects in beads along
    // the edge of the stroke; at the bottom edge the bigger ones run
    const shed = (x, y, r) => {
      const a = Math.random() * Math.PI * 2
      const bx = x + Math.cos(a) * r * 1.05
      const by = y + Math.sin(a) * r * 1.05
      if (!user && inStroke(bx, by)) return
      if (beads.length < 500 && Math.random() < 0.35) beads.push({ x: bx, y: by, r: 0.8 + Math.random() * 2.2 })
      const bottom = !inStroke(x, y + r * 1.2)
      if (bottom && Math.random() < 0.05 && runs.length < 24) {
        runs.push({ x, y: y + r * 0.9, r: 2.2 + Math.random() * 1.8, v: 0, stick: Math.random() * 0.6, len: 0, max: 30 + Math.random() * 120, drift: 0 })
      }
    }
    // one water drop on glass: it works as a little lens, so it shows the
    // dark sky above flipped to its lower half and the lights below flipped
    // to its top: darker at the top, brighter at the bottom, with a sharp
    // specular glint and a thin dark rim
    const drop = (x, y, r, stretch = 1) => {
      const ry = r * stretch
      o.save()
      o.translate(x, y)
      o.beginPath()
      if (stretch > 1) {
        // a running drop is a teardrop: round below, drawn out above
        o.moveTo(0, -ry * 1.5)
        o.bezierCurveTo(r * 0.55, -ry * 0.9, r, -ry * 0.2, r, ry * 0.15)
        o.arc(0, ry * 0.15, r, 0, Math.PI)
        o.bezierCurveTo(-r, -ry * 0.2, -r * 0.55, -ry * 0.9, 0, -ry * 1.5)
      } else {
        o.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2)
      }
      const body = o.createLinearGradient(0, -ry, 0, ry)
      body.addColorStop(0, 'rgba(8,12,22,.32)')
      body.addColorStop(0.55, 'rgba(255,255,255,.05)')
      body.addColorStop(1, 'rgba(255,240,220,.32)')
      o.fillStyle = body
      o.fill()
      o.strokeStyle = 'rgba(10,14,24,.38)'
      o.lineWidth = Math.max(0.5, r * 0.16)
      o.stroke()
      // specular glint
      o.fillStyle = 'rgba(255,255,255,.9)'
      o.beginPath()
      o.ellipse(-r * 0.35, -ry * 0.35, Math.max(0.4, r * 0.2), Math.max(0.3, r * 0.13), -0.6, 0, Math.PI * 2)
      o.fill()
      o.restore()
    }

    const finger = el.querySelector('[data-finger]')
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      // write: a few hundred ink cells a second
      let n = Math.round(1400 * dt)
      let tip = null
      while (n-- > 0 && i < pts.length) {
        const [x, y] = pts[i++]
        wipe(x, y, brush)
        tip = [x, y]
        if (Math.random() < 0.06) shed(x, y, brush)
      }
      if (finger) {
        finger.style.opacity = tip ? '1' : '0'
        if (tip) finger.style.transform = `translate(${tip[0] - 14}px, ${tip[1] - 14}px)`
      }
      if (user) {
        wipe(user.x, user.y, brush * 1.2)
        if (Math.random() < 0.25) shed(user.x, user.y, brush * 1.2)
      }
      // runs move in fits and starts (stick-slip): they cling to the glass
      // until enough water gathers, slide, and catch again, wandering a
      // little sideways, and leave a clean wet channel through the fog
      for (let k = runs.length - 1; k >= 0; k--) {
        const r = runs[k]
        if (r.stick > 0) {
          r.stick -= dt
          continue
        }
        r.v = Math.min(90, r.v + 260 * dt)
        const step = r.v * dt
        r.drift += (Math.random() - 0.5) * 0.6
        r.drift *= 0.9
        const nx = r.x + r.drift * step * 0.08
        const ny = r.y + step
        g.globalCompositeOperation = 'destination-out'
        g.strokeStyle = '#000'
        g.lineCap = 'round'
        g.lineWidth = r.r * 1.3
        g.beginPath()
        g.moveTo(r.x, r.y)
        g.lineTo(nx, ny)
        g.stroke()
        g.globalCompositeOperation = 'source-over'
        r.x = nx
        r.y = ny
        r.len += step
        // it picks up any beads in its path and grows
        for (let b = beads.length - 1; b >= 0; b--) {
          const q = beads[b]
          if (Math.abs(q.x - r.x) < r.r + q.r && Math.abs(q.y - r.y) < r.r + q.r) {
            r.r = Math.min(4.5, Math.sqrt(r.r * r.r + q.r * q.r * 0.5))
            beads.splice(b, 1)
          }
        }
        // and loses water to the glass as it goes, so it catches again
        r.r -= step * 0.006
        if (Math.random() < dt * 1.6) {
          r.stick = 0.15 + Math.random() * 0.7
          r.v = 0
        }
        if (r.len > r.max || r.r < 1.4 || r.y > H + 10) {
          beads.push({ x: r.x, y: r.y, r: Math.max(1.2, r.r) })
          runs.splice(k, 1)
        }
      }
      o.clearRect(0, 0, W, H)
      for (const b of beads) drop(b.x, b.y, b.r)
      for (const r of runs) drop(r.x, r.y, r.r, r.v > 5 ? 1.25 : 1.05)
      // the fog creeps back
      g.fillStyle = `rgba(214,222,228,${0.012 * regrow * dt})`
      g.fillRect(0, 0, W, H)
      raf = requestAnimationFrame(frame)
    }
    const local = (e) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e) => {
      user = local(e)
      el.setPointerCapture(e.pointerId)
    }
    const move = (e) => user && (user = local(e))
    const up = () => (user = null)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    const start = setTimeout(() => (raf = requestAnimationFrame(frame)), 500)
    return () => {
      clearTimeout(start)
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
  }, [text, fog, regrow])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', touchAction: 'none', cursor: 'pointer', background: '#1b2433', ...style }}>
      {/* the street at night, seen through the glass */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 60%, #ffb85c, transparent 12%), radial-gradient(circle at 70% 40%, #ff5f6d, transparent 9%), radial-gradient(circle at 85% 75%, #6fd3ff, transparent 10%), radial-gradient(circle at 45% 80%, #ffe08a, transparent 8%), linear-gradient(#202a3c, #0f141d)', filter: 'blur(3px)' }} />
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'blur(0.6px)' }} />
      <canvas ref={ovRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      <div data-finger aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 28, height: 28, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, rgba(255,214,190,.55), rgba(220,150,120,.25))', opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
}
