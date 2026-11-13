import { useEffect, useRef } from 'react'

// A scratch card. The message is printed underneath a silver foil coating;
// drag across it to scratch the foil away. The scratch is ragged, because a
// coin edge chips the foil off in flakes rather than wiping it cleanly, and
// the flakes fall away under gravity. Once most of the foil is gone the
// rest flakes off on its own. With "demo" on, a coin scratches a few strokes
// by itself first.
export default function ScratchCard({
  text = 'YOU WIN!',
  prize = '#ff4d1a',
  foil = '#b9bcc4',
  demo = true,
  style,
}) {
  const box = useRef()
  const cv = useRef()
  const fx = useRef()

  useEffect(() => {
    const el = box.current
    const c = cv.current
    const f = fx.current
    const g = c.getContext('2d', { willReadFrequently: true })
    const gf = f.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = el.clientWidth
    const H = el.clientHeight
    for (const k of [c, f]) {
      k.width = W * dpr
      k.height = H * dpr
    }
    g.scale(dpr, dpr)
    gf.scale(dpr, dpr)

    // the foil: metallic gradient with a fine embossed pattern
    const gr = g.createLinearGradient(0, 0, W, H)
    gr.addColorStop(0, foil)
    gr.addColorStop(0.45, '#eef0f4')
    gr.addColorStop(0.55, foil)
    gr.addColorStop(1, '#8e929b')
    g.fillStyle = gr
    g.fillRect(0, 0, W, H)
    g.fillStyle = 'rgba(255,255,255,.12)'
    for (let y = 0; y < H; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < W; x += 6) g.fillRect(x, y, 1.5, 1.5)
    g.fillStyle = 'rgba(40,40,48,.35)'
    g.font = '700 13px ui-monospace, Menlo, monospace'
    g.textAlign = 'center'
    g.fillText('SCRATCH HERE', W / 2, H / 2 + 5)

    const flakes = []
    let raf = 0
    let last = 0
    let done = false
    let lastPt = null
    let scratched = 0

    const scratchAt = (x, y) => {
      g.globalCompositeOperation = 'destination-out'
      // a coin edge chips out an irregular streak
      for (let k = 0; k < 6; k++) {
        const ang = Math.random() * Math.PI * 2
        const rr = 7 + Math.random() * 9
        g.beginPath()
        g.ellipse(x + Math.cos(ang) * 4, y + Math.sin(ang) * 4, rr, rr * (0.4 + Math.random() * 0.6), ang, 0, Math.PI * 2)
        g.fill()
      }
      g.globalCompositeOperation = 'source-over'
      for (let k = 0; k < 3; k++) flakes.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 80, s: 1 + Math.random() * 2.5, r: Math.random() * 6, w: (Math.random() - 0.5) * 20, life: 1 })
      scratched++
    }
    const stroke = (a, b) => {
      const d = Math.hypot(b.x - a.x, b.y - a.y)
      const n = Math.max(1, Math.ceil(d / 5))
      for (let i = 1; i <= n; i++) scratchAt(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n)
    }
    const check = () => {
      // sample how much foil is left
      const data = g.getImageData(0, 0, c.width, c.height).data
      let left = 0
      let n = 0
      for (let i = 3; i < data.length; i += 4 * 97) {
        n++
        if (data[i] > 20) left++
      }
      if (left / n < 0.45 && !done) {
        done = true
        c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' })
        for (let k = 0; k < 140; k++) flakes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 60, s: 1 + Math.random() * 3, r: Math.random() * 6, w: (Math.random() - 0.5) * 20, life: 1 })
      }
    }

    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      gf.clearRect(0, 0, W, H)
      for (const p of flakes) {
        p.vy += 900 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.r += p.w * dt
        p.life -= dt * 0.6
        gf.save()
        gf.translate(p.x, p.y)
        gf.rotate(p.r)
        gf.globalAlpha = Math.max(0, p.life)
        gf.fillStyle = Math.sin(p.r * 3) > 0 ? '#e9ebef' : foil
        gf.fillRect(-p.s, -p.s * 0.6, p.s * 2, p.s * 1.2)
        gf.restore()
      }
      for (let i = flakes.length - 1; i >= 0; i--) if (flakes[i].life <= 0 || flakes[i].y > H + 20) flakes.splice(i, 1)
      raf = requestAnimationFrame(frame)
    }

    const local = (e) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e) => {
      lastPt = local(e)
      scratchAt(lastPt.x, lastPt.y)
      el.setPointerCapture(e.pointerId)
    }
    const move = (e) => {
      if (!lastPt) return
      const p = local(e)
      stroke(lastPt, p)
      lastPt = p
    }
    const up = () => {
      lastPt = null
      check()
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    raf = requestAnimationFrame(frame)

    // a coin scratches a few zig-zag strokes on its own
    const timers = []
    if (demo) {
      const pts = []
      for (let k = 0; k < 7; k++) pts.push({ x: W * (0.15 + 0.7 * (k % 2)), y: H * (0.3 + k * 0.06) })
      let k = 0
      let t = 0
      const coin = el.querySelector('[data-coin]')
      const go = () => {
        if (k >= pts.length - 1) {
          coin.style.opacity = '0'
          return
        }
        t += 0.08
        const a = pts[k]
        const b = pts[k + 1]
        const p = { x: a.x + (b.x - a.x) * Math.min(1, t), y: a.y + (b.y - a.y) * Math.min(1, t) }
        const q = { x: a.x + (b.x - a.x) * Math.max(0, t - 0.08), y: a.y + (b.y - a.y) * Math.max(0, t - 0.08) }
        stroke(q, p)
        coin.style.opacity = '1'
        coin.style.transform = `translate(${p.x - 18}px, ${p.y - 18}px) rotate(${-30 + t * 20}deg)`
        if (t >= 1) {
          t = 0
          k++
        }
        timers.push(setTimeout(go, 16))
      }
      timers.push(setTimeout(go, 600))
    }
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
  }, [text, foil, demo])

  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #f6efe2, #eadfcb)', ...style }}>
      <div
        ref={box}
        role="img"
        aria-label={`Scratch card: ${text}`}
        style={{ position: 'relative', width: 'min(86%, 520px)', aspectRatio: '2.2', borderRadius: 14, overflow: 'hidden', background: `radial-gradient(circle at 50% 50%, #fffaf0, #f3e3c3)`, boxShadow: '0 12px 28px rgba(0,0,0,.18), 0 0 0 6px #fff, 0 0 0 7px #e2d3b6', touchAction: 'none', cursor: 'crosshair', userSelect: 'none' }}
      >
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: "900 clamp(30px, 6vw, 64px)/1 'Arial Black', Impact, sans-serif", color: prize, letterSpacing: '0.02em', textShadow: '0 2px 0 rgba(0,0,0,.08)' }}>{text}</div>
        <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <canvas ref={fx} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }} />
        <div data-coin aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 36, height: 36, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #fff3c4, #d9a83b 60%, #9a6b12)', boxShadow: '0 3px 6px rgba(0,0,0,.35), inset 0 0 0 3px rgba(150,100,20,.5)', opacity: 0, pointerEvents: 'none' }} />
      </div>
    </div>
  )
}
