import { useEffect, useRef } from 'react'

// Spray paint through a card stencil. The can sweeps across in passes and
// the paint builds up as a speckle of droplets: where the card has a hole it
// reaches the wall, everywhere else it lands on the card. A stencil never
// sits perfectly flat, so a little mist creeps under its edges and the
// letters come out with a soft overspray halo. Where the paint goes on too
// thick it runs in drips. Then the card peels away. Hold the pointer down on
// the stencil to spray it yourself.
export default function StencilSpray({
  text = 'SPRAY',
  paint = '#ff4d1a',
  wall = '#e9e6df',
  card = '#c9a46a',
  drips = true,
  style,
}) {
  const box = useRef()
  const wallCv = useRef()
  const cardEl = useRef()
  const cardCv = useRef()

  useEffect(() => {
    const el = box.current
    const W = el.clientWidth
    const H = el.clientHeight
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const setup = (cv) => {
      cv.width = W * dpr
      cv.height = H * dpr
      const g = cv.getContext('2d')
      g.scale(dpr, dpr)
      return g
    }
    const gw = setup(wallCv.current)
    const gc = setup(cardCv.current)

    // the letter holes, and a blurred copy: how far mist reaches under the card
    const mk = (blur) => {
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const g = c.getContext('2d', { willReadFrequently: true })
      g.filter = blur ? `blur(${blur}px)` : 'none'
      g.fillStyle = '#000'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      let size = H * 0.42
      g.font = `900 ${size}px 'Arial Black', Impact, sans-serif`
      const w = g.measureText(text).width
      if (w > W * 0.82) size *= (W * 0.82) / w
      g.font = `900 ${size}px 'Arial Black', Impact, sans-serif`
      g.fillText(text, W / 2, H / 2)
      return g.getImageData(0, 0, W, H).data
    }
    const hole = mk(0)
    const mist = mk(3)
    const alphaAt = (d, x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[((y | 0) * W + (x | 0)) * 4 + 3] / 255)

    // the card: punch the letters out of it
    const cardImg = document.createElement('canvas')
    cardImg.width = W
    cardImg.height = H
    {
      const g = cardImg.getContext('2d')
      g.fillStyle = card
      g.fillRect(W * 0.04, H * 0.14, W * 0.92, H * 0.72)
      const id = g.getImageData(0, 0, W, H)
      for (let i = 0; i < hole.length; i += 4) if (hole[i + 3] > 128) id.data[i + 3] = 0
      g.putImageData(id, 0, 0)
    }
    gc.drawImage(cardImg, 0, 0, W, H)

    // paint load per 4px cell, for drips
    const CS = 4
    const load = new Float32Array(Math.ceil(W / CS) * Math.ceil(H / CS))
    const runs = []
    let lifted = false

    const spray = (x, y, r, n) => {
      for (let i = 0; i < n; i++) {
        // droplets fall off like a gaussian round the nozzle
        const a = Math.random() * Math.PI * 2
        const d = Math.sqrt(-2 * Math.log(Math.random() + 1e-6)) * r * 0.45
        const px = x + Math.cos(a) * d
        const py = y + Math.sin(a) * d
        const s = Math.random() * 1.3 + 0.3
        const onCard = !lifted && px > W * 0.04 && px < W * 0.96 && py > H * 0.14 && py < H * 0.86
        const through = alphaAt(hole, px, py) > 0.5
        if (!onCard || through) {
          gw.fillStyle = paint
          gw.globalAlpha = 0.5
          gw.fillRect(px, py, s, s)
          const k = ((py / CS) | 0) * Math.ceil(W / CS) + ((px / CS) | 0)
          load[k] += 0.02
          if (drips && load[k] > 1.6 && runs.length < 40 && Math.random() < 0.02) {
            runs.push({ x: px, y: py, len: 20 + Math.random() * 60, v: 30 + Math.random() * 30, w: 1.5 + Math.random() * 1.5, done: 0 })
            load[k] = 0
          }
        } else if (Math.random() < alphaAt(mist, px, py) * 0.5) {
          // mist creeping under the card's edge
          gw.fillStyle = paint
          gw.globalAlpha = 0.25
          gw.fillRect(px, py, s * 0.7, s * 0.7)
        } else {
          gc.fillStyle = paint
          gc.globalAlpha = 0.5
          gc.fillRect(px, py, s, s)
        }
      }
      gw.globalAlpha = gc.globalAlpha = 1
    }

    // the automatic passes: a zig-zag across the stencil
    const passes = 5
    const passMs = 900
    let t0 = 0
    let last = 0
    let raf = 0
    let liftAt = 0
    let user = null
    const frame = (now) => {
      t0 ||= now
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      const t = now - t0
      if (t < passes * passMs && !user) {
        const p = t / passMs
        const k = Math.floor(p)
        const f = p - k
        const x = W * (0.06 + 0.88 * (k % 2 ? 1 - f : f))
        const y = H * (0.28 + (0.44 * (k + f * 0.6)) / passes)
        spray(x, y, H * 0.16, 260)
      } else if (!liftAt && !user && t > passes * passMs + 500) {
        liftAt = now
        lifted = true
        cardEl.current.animate(
          [
            { transform: 'none', opacity: 1 },
            { transform: 'translate(-2%, -4%) rotate(-3deg) perspective(800px) rotateX(18deg)', opacity: 1, offset: 0.4 },
            { transform: 'translate(-30%, -120%) rotate(-14deg) perspective(800px) rotateX(40deg)', opacity: 0 },
          ],
          { duration: 1100, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' },
        )
      }
      if (user) spray(user.x, user.y, H * 0.12, 160)
      // drips run down and slow as the paint thins
      for (const r of runs) {
        if (r.done >= r.len) continue
        const step = Math.min(r.len - r.done, r.v * dt * (1 - r.done / r.len) + 0.1)
        gw.fillStyle = paint
        gw.globalAlpha = 0.8
        gw.fillRect(r.x - r.w / 2, r.y + r.done, r.w, step + 0.5)
        r.done += step
        if (r.done >= r.len - 0.2) {
          gw.beginPath()
          gw.arc(r.x, r.y + r.done, r.w * 0.9, 0, Math.PI * 2)
          gw.fill()
        }
        gw.globalAlpha = 1
      }
      raf = requestAnimationFrame(frame)
    }
    const local = (e) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e) => {
      if (lifted) return
      user = local(e)
      el.setPointerCapture(e.pointerId)
    }
    const move = (e) => user && (user = local(e))
    const up = () => (user = null)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
  }, [text, paint, wall, card, drips])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: wall, touchAction: 'none', cursor: 'crosshair', ...style }}>
      {/* concrete texture */}
      <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35, mixBlendMode: 'multiply' }}>
        <filter id="rd-stencil-wall">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="2" />
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.48  0 0 0 0 0.45  0 0 0 -1 0.7" />
        </filter>
        <rect width="100%" height="100%" filter="url(#rd-stencil-wall)" />
      </svg>
      <canvas ref={wallCv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div ref={cardEl} style={{ position: 'absolute', inset: 0, transformOrigin: '50% 20%', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.25))' }}>
        <canvas ref={cardCv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}
