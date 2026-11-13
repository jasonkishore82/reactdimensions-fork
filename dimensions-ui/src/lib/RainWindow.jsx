import { useEffect, useRef } from 'react'

// A sign seen through a rainy window. Through the wet glass it's a blur, but
// every drop is a tiny lens: look into one and you see a sharp, upside-down,
// shrunken image of what's behind it, as you do in real raindrops. Small
// drops land and sit; bigger ones get heavy, slide down in a wobbly path,
// swallow the small drops in their way and leave a clear trail behind.
export default function RainWindow({
  text = 'OPEN',
  sign = '#ff3d6e',
  rain = 1,
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

    // the scene behind the glass, sharp, at device resolution
    const scene = document.createElement('canvas')
    scene.width = W * dpr
    scene.height = H * dpr
    const sg = scene.getContext('2d')
    sg.scale(dpr, dpr)
    const bg = sg.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#141a26')
    bg.addColorStop(1, '#0a0d14')
    sg.fillStyle = bg
    sg.fillRect(0, 0, W, H)
    // a few street lights
    for (const [x, y, col, r] of [[0.15, 0.25, '#ffd28a', 60], [0.85, 0.3, '#8ad8ff', 50], [0.7, 0.85, '#ffb070', 70]]) {
      const gl = sg.createRadialGradient(x * W, y * H, 0, x * W, y * H, r)
      gl.addColorStop(0, col)
      gl.addColorStop(1, 'transparent')
      sg.fillStyle = gl
      sg.fillRect(0, 0, W, H)
    }
    let size = H * 0.34
    const font = (s) => `700 ${s}px 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif`
    sg.font = font(size)
    const tw = sg.measureText(text).width
    if (tw > W * 0.7) size *= (W * 0.7) / tw
    sg.font = font(size)
    sg.textAlign = 'center'
    sg.textBaseline = 'middle'
    sg.shadowColor = sign
    sg.shadowBlur = 30
    sg.fillStyle = sign
    sg.fillText(text, W / 2, H / 2)
    sg.shadowBlur = 0
    sg.fillStyle = '#fff3f6'
    sg.globalAlpha = 0.6
    sg.fillText(text, W / 2, H / 2)
    sg.globalAlpha = 1
    // the same, blurred: the view through wet glass
    const blurred = document.createElement('canvas')
    blurred.width = scene.width
    blurred.height = scene.height
    const bgc = blurred.getContext('2d')
    bgc.filter = `blur(${10 * dpr}px)`
    bgc.drawImage(scene, 0, 0)

    const drops = []
    const add = (x, y, r) => drops.push({ x, y, r, vy: 0, slide: false, wob: Math.random() * 10 })
    for (let k = 0; k < 160; k++) add(Math.random() * W, Math.random() * H, 1 + Math.random() * 3.5)
    // trails: a canvas where sliding drops wipe the blur away
    const trail = document.createElement('canvas')
    trail.width = W * dpr
    trail.height = H * dpr
    const tg = trail.getContext('2d')
    tg.scale(dpr, dpr)

    const clearView = document.createElement('canvas')
    clearView.width = W * dpr
    clearView.height = H * dpr
    const cg = clearView.getContext('2d')

    let raf = 0
    let last = 0
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      // new drops land
      for (let k = 0; k < 18 * rain * dt * 10; k++) if (Math.random() < 0.1) add(Math.random() * W, Math.random() * H, 0.8 + Math.random() * 3.2)
      // big drops start to slide; small ones grow slowly from mist
      for (const d of drops) {
        if (!d.slide && d.r > 4.2 && Math.random() < 0.02) d.slide = true
        if (d.slide) {
          d.vy = Math.min(220, d.vy + 300 * dt)
          d.wob += dt * 6
          const nx = d.x + Math.sin(d.wob) * 0.4
          const ny = d.y + d.vy * dt * (0.6 + Math.random() * 0.8)
          // clear a trail
          tg.fillStyle = '#000'
          tg.beginPath()
          tg.ellipse(nx, ny - d.r, d.r * 0.55, d.r * 1.4, 0, 0, Math.PI * 2)
          tg.fill()
          d.x = nx
          d.y = ny
          // leave small beads behind now and then, losing water
          if (Math.random() < 0.08 && d.r > 3) {
            add(d.x, d.y - d.r * 2, d.r * 0.3)
            d.r *= 0.985
          }
        }
      }
      // big drops swallow small ones they touch
      for (const a of drops) {
        if (!a.slide) continue
        for (const b of drops) {
          if (a === b || b.dead || b.slide) continue
          if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) {
            a.r = Math.sqrt(a.r * a.r + b.r * b.r * 0.6)
            b.dead = true
          }
        }
      }
      for (let k = drops.length - 1; k >= 0; k--) if (drops[k].dead || drops[k].y > H + 20 || drops.length > 420) drops.splice(k, 1)
      // trails fog back in
      tg.globalCompositeOperation = 'destination-out'
      tg.fillStyle = `rgba(0,0,0,${0.25 * dt})`
      tg.fillRect(0, 0, W, H)
      tg.globalCompositeOperation = 'source-over'

      g.setTransform(1, 0, 0, 1, 0, 0)
      g.drawImage(blurred, 0, 0)
      // where sliding drops wiped the glass, the view is sharp
      cg.globalCompositeOperation = 'copy'
      cg.drawImage(trail, 0, 0)
      cg.globalCompositeOperation = 'source-in'
      cg.drawImage(scene, 0, 0)
      g.globalAlpha = 0.85
      g.drawImage(clearView, 0, 0)
      g.globalAlpha = 1
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      // each drop: a lens showing the scene behind it, flipped and shrunk
      for (const d of drops) {
        const r = d.r * (d.slide ? 1.1 : 1)
        const span = r * 9 // how much of the scene a drop "sees"
        g.save()
        g.beginPath()
        g.ellipse(d.x, d.y, r, r * (d.slide ? 1.15 : 1), 0, 0, Math.PI * 2)
        g.clip()
        g.translate(d.x, d.y)
        g.scale(-1, -1)
        g.drawImage(scene, (d.x - span) * dpr, (d.y - span) * dpr, span * 2 * dpr, span * 2 * dpr, -r, -r, r * 2, r * 2)
        g.restore()
        // rim shadow and a highlight
        g.strokeStyle = 'rgba(0,0,0,.35)'
        g.lineWidth = Math.max(0.6, r * 0.18)
        g.beginPath()
        g.arc(d.x, d.y + r * 0.08, r * 0.95, 0.2, Math.PI - 0.2)
        g.stroke()
        g.fillStyle = 'rgba(255,255,255,.55)'
        g.beginPath()
        g.arc(d.x - r * 0.3, d.y - r * 0.35, Math.max(0.5, r * 0.18), 0, Math.PI * 2)
        g.fill()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [text, sign, rain])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#0a0d14', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
