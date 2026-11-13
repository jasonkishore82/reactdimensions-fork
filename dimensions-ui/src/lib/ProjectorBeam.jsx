import { useEffect, useRef } from 'react'

// A projector in a dark room. The beam spreads from the lens across the
// room, made visible by the dust drifting through it (each mote lights up
// only while it's inside the cone), and lands on the screen as the word,
// keystoned because the projector sits below and to one side. The lens
// hunts for focus when it starts, overshooting sharp and back, then settles.
// Click the screen to pull focus again.
export default function ProjectorBeam({
  text = 'NOW SHOWING',
  light = '#fff4dc',
  dust = 60,
  style,
}) {
  const box = useRef()
  const cv = useRef()
  const img = useRef()

  useEffect(() => {
    const el = box.current
    const c = cv.current
    const g = c.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let W = 0
    let H = 0
    const resize = () => {
      W = el.clientWidth
      H = el.clientHeight
      c.width = W * dpr
      c.height = H * dpr
    }
    resize()
    // lens at bottom-left, screen on the right
    const lens = () => [W * 0.06, H * 0.78]
    const scr = () => [W * 0.42, H * 0.12, W * 0.94, H * 0.7] // x0, y0, x1, y1
    const motes = Array.from({ length: dust }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.01, vy: (Math.random() - 0.5) * 0.01, s: 0.6 + Math.random() * 1.6 }))
    let raf = 0
    let last = 0
    let focusT = 0
    const inside = (px, py) => {
      // is the point inside the triangle lens -> screen edge?
      const [lx, ly] = lens()
      const [x0, y0, x1, y1] = scr()
      const ex = x0 + (x1 - x0) * 0.08
      const s = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy)
      const d1 = s(px, py, lx, ly, ex, y0)
      const d2 = s(px, py, ex, y0, ex, y1)
      const d3 = s(px, py, ex, y1, lx, ly)
      const neg = d1 < 0 || d2 < 0 || d3 < 0
      const pos = d1 > 0 || d2 > 0 || d3 > 0
      return !(neg && pos)
    }
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      focusT += dt
      // focus hunting: a damped oscillation of blur
      const blur = Math.max(0, 9 * Math.exp(-focusT * 1.6) * Math.abs(Math.cos(focusT * 4.2))) + 0.2
      const flick = 0.93 + Math.random() * 0.07
      if (img.current) {
        img.current.style.filter = `blur(${blur.toFixed(2)}px) brightness(${flick.toFixed(3)})`
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      const [lx, ly] = lens()
      const [x0, y0, x1, y1] = scr()
      const ex = x0 + (x1 - x0) * 0.08
      // the beam itself: faint, brighter near the lens
      const gr = g.createLinearGradient(lx, ly, ex, (y0 + y1) / 2)
      gr.addColorStop(0, light + '55')
      gr.addColorStop(1, light + '08')
      g.fillStyle = gr
      g.beginPath()
      g.moveTo(lx, ly)
      g.lineTo(ex, y0)
      g.lineTo(ex, y1)
      g.closePath()
      g.fill()
      // dust: dark outside, lit inside the beam
      for (const m of motes) {
        m.x += (m.vx + Math.sin(now / 2000 + m.s) * 0.004) * dt
        m.y += (m.vy - 0.004) * dt
        if (m.x < 0) m.x += 1
        if (m.x > 1) m.x -= 1
        if (m.y < 0) m.y += 1
        if (m.y > 1) m.y -= 1
        const px = m.x * W
        const py = m.y * H
        if (!inside(px, py)) continue
        g.fillStyle = light
        g.globalAlpha = 0.5 + 0.4 * Math.sin(now / 300 + m.s * 9)
        g.beginPath()
        g.arc(px, py, m.s, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }
    const refocus = () => (focusT = 0)
    el.addEventListener('click', refocus)
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('click', refocus)
    }
  }, [text, light, dust])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(120% 100% at 70% 40%, #1d1c22, #0b0b0e)', cursor: 'pointer', ...style }}>
      {/* the screen, seen a little from the side */}
      <div style={{ position: 'absolute', left: '42%', top: '12%', width: '52%', height: '58%', perspective: 900 }}>
        <div style={{ position: 'absolute', inset: 0, background: '#2b2a30', transform: 'rotateY(-14deg)', transformOrigin: '0 50%', boxShadow: '0 0 0 4px #141418' }}>
          {/* the projected image: keystoned, brighter in the middle (hotspot) */}
          <div
            ref={img}
            style={{ position: 'absolute', left: '6%', right: '4%', top: '8%', bottom: '12%', display: 'grid', placeItems: 'center', background: `radial-gradient(ellipse at 45% 50%, ${light}, color-mix(in srgb, ${light} 70%, #000) 90%)`, clipPath: 'polygon(0 6%, 100% 0, 100% 100%, 0 92%)', color: '#16151a', font: "800 clamp(22px, 4.6vw, 54px)/1.05 Georgia, 'Times New Roman', serif", textAlign: 'center', letterSpacing: '0.04em' }}
          >
            {text}
          </div>
        </div>
      </div>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'screen' }} />
      {/* the projector */}
      <div style={{ position: 'absolute', left: '1%', top: 'calc(78% - 22px)', width: 70, height: 44, borderRadius: 8, background: 'linear-gradient(#3d3e44, #1c1d21)', boxShadow: '0 6px 14px rgba(0,0,0,.6)' }}>
        <div style={{ position: 'absolute', right: -8, top: 10, width: 22, height: 24, borderRadius: 6, background: 'radial-gradient(circle at 60% 50%, #fffbe8, #8c8a7e 60%, #2a2a2e)' }} />
      </div>
    </div>
  )
}
