import { useEffect, useRef } from 'react'

// Frost forming on a cold window. Ice crystals nucleate inside the letters
// and grow as branching needles, each tip splitting off side branches at
// the 60 degree angles of hexagonal ice, so the letters fill in with fern
// frost while the rest of the glass gets only a light rime. Your pointer is
// warm: drag across the glass and the frost melts away along your path,
// leaving clear glass and a few beads of water.
export default function FrostText({
  text = 'FROST',
  growth = 1,
  tint = '#9fc3dd',
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

    const m = document.createElement('canvas')
    m.width = W
    m.height = H
    const mg = m.getContext('2d', { willReadFrequently: true })
    let size = H * 0.42
    const font = (s) => `900 ${s}px 'Arial Black', Impact, sans-serif`
    mg.font = font(size)
    const tw = mg.measureText(text).width
    if (tw > W * 0.86) size *= (W * 0.86) / tw
    mg.font = font(size)
    mg.textAlign = 'center'
    mg.textBaseline = 'middle'
    mg.fillText(text, W / 2, H / 2)
    const d = mg.getImageData(0, 0, W, H).data
    const inLetter = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[((y | 0) * W + (x | 0)) * 4 + 3] > 100

    // seeds: many inside the letters, a sprinkling elsewhere
    const tips = []
    const seed = (x, y, strong) => {
      const a0 = Math.random() * Math.PI * 2
      for (let k = 0; k < 6; k++) tips.push({ x, y, a: a0 + (k * Math.PI) / 3, life: strong ? 26 + Math.random() * 30 : 4 + Math.random() * 8, strong })
    }
    for (let k = 0; k < 900; k++) {
      const x = Math.random() * W
      const y = Math.random() * H
      if (inLetter(x, y)) seed(x, y, true)
      else if (Math.random() < 0.05) seed(x, y, false)
    }
    let raf = 0
    let warm = null
    let last = 0
    const drops = []
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      // grow a batch of tips each frame
      g.lineCap = 'round'
      let budget = Math.round(1800 * growth * dt * 30)
      for (let i = tips.length - 1; i >= 0 && budget > 0; i--, budget--) {
        const t = tips[i]
        const step = t.strong ? 1.6 : 1.1
        const nx = t.x + Math.cos(t.a) * step
        const ny = t.y + Math.sin(t.a) * step
        // needles stay inside the letters; rime outside stays short
        if ((t.strong && !inLetter(nx, ny)) || --t.life <= 0) {
          tips.splice(i, 1)
          continue
        }
        g.strokeStyle = t.strong ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.28)'
        g.lineWidth = t.strong ? 0.9 : 0.6
        g.beginPath()
        g.moveTo(t.x, t.y)
        g.lineTo(nx, ny)
        g.stroke()
        t.x = nx
        t.y = ny
        // side branches at 60 degrees, as hexagonal ice grows
        if (t.strong && Math.random() < 0.09 && tips.length < 5000) tips.push({ x: nx, y: ny, a: t.a + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 3), life: t.life * 0.6, strong: true })
      }
      // the pointer melts a soft path
      if (warm) {
        g.globalCompositeOperation = 'destination-out'
        const gr = g.createRadialGradient(warm.x, warm.y, 0, warm.x, warm.y, 34)
        gr.addColorStop(0, 'rgba(0,0,0,.6)')
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = gr
        g.fillRect(warm.x - 34, warm.y - 34, 68, 68)
        g.globalCompositeOperation = 'source-over'
        if (Math.random() < 0.15) drops.push({ x: warm.x + (Math.random() - 0.5) * 40, y: warm.y + (Math.random() - 0.5) * 30, r: 1.5 + Math.random() * 2.5 })
        warm = null
      }
      for (const dr of drops.splice(0)) {
        g.fillStyle = 'rgba(255,255,255,.35)'
        g.beginPath()
        g.arc(dr.x, dr.y, dr.r, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = 'rgba(255,255,255,.9)'
        g.beginPath()
        g.arc(dr.x - dr.r * 0.35, dr.y - dr.r * 0.35, dr.r * 0.3, 0, Math.PI * 2)
        g.fill()
      }
      raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      if (!e.buttons && e.pointerType === 'mouse') return
      const r = el.getBoundingClientRect()
      warm = { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerdown', move)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerdown', move)
    }
  }, [text, growth])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: `radial-gradient(120% 90% at 30% 20%, color-mix(in srgb, ${tint} 60%, #fff), ${tint} 45%, color-mix(in srgb, ${tint} 50%, #0b1a2a))`, cursor: 'grab', touchAction: 'none', ...style }}>
      {/* the cold outdoors, out of focus beyond the glass */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 75% 70%, rgba(255,240,210,.35), transparent 30%), radial-gradient(circle at 20% 80%, rgba(20,40,70,.4), transparent 40%)', filter: 'blur(10px)' }} />
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'drop-shadow(0 0 1px rgba(255,255,255,.6))' }} />
    </div>
  )
}
