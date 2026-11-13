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

    let i = 0
    let raf = 0
    let last = 0
    let user = null
    const runs = []
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
        // condensation pushed aside beads up and sometimes runs
        if (Math.random() < 0.004) runs.push({ x, y: y + brush * 0.6, v: 10 + Math.random() * 25, life: 1 + Math.random() * 2.5, r: 1.6 + Math.random() * 1.6 })
      }
      if (finger) {
        finger.style.opacity = tip ? '1' : '0'
        if (tip) finger.style.transform = `translate(${tip[0] - 14}px, ${tip[1] - 14}px)`
      }
      if (user) {
        wipe(user.x, user.y, brush * 1.2)
        if (Math.random() < 0.05) runs.push({ x: user.x, y: user.y + brush, v: 12 + Math.random() * 20, life: 1 + Math.random() * 2, r: 1.8 + Math.random() * 1.4 })
      }
      // drips run down, clearing a thin trail and slowing as they shrink
      for (let k = runs.length - 1; k >= 0; k--) {
        const r = runs[k]
        r.life -= dt
        if (r.life <= 0) {
          runs.splice(k, 1)
          continue
        }
        const ny = r.y + r.v * dt
        g.globalCompositeOperation = 'destination-out'
        g.fillStyle = 'rgba(0,0,0,.85)'
        g.fillRect(r.x - r.r * 0.5, r.y, r.r, ny - r.y + 0.5)
        g.globalCompositeOperation = 'source-over'
        g.fillStyle = 'rgba(255,255,255,.35)'
        g.beginPath()
        g.arc(r.x, ny, r.r, 0, Math.PI * 2)
        g.fill()
        r.y = ny + (Math.random() - 0.5) * 0.3
        r.x += (Math.random() - 0.5) * 0.4
      }
      // the fog creeps back
      g.fillStyle = `rgba(214,222,228,${(0.012 * regrow * dt * 60) / 60})`
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
      <div data-finger aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 28, height: 28, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, rgba(255,214,190,.55), rgba(220,150,120,.25))', opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
}
