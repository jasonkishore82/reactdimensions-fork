import { useEffect, useRef } from 'react'

// Glow-in-the-dark paint. The room is dark; the pointer is a torch. Shine it
// over the letters and the phosphor soaks up the light, then glows on its
// own once the torch moves off, fading the way phosphor does: quickly at
// first, then lingering faintly for a long time (the afterglow falls off
// roughly as 1 / t, not exponentially). Each patch of paint keeps its own
// charge, so you can "draw" with the torch over the word.
export default function GlowInDark({
  text = 'AFTERGLOW',
  glow = '#9dff7a',
  decay = 1,
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

    // the paint: the word as a mask
    const mask = document.createElement('canvas')
    mask.width = W
    mask.height = H
    const mg = mask.getContext('2d')
    let size = H * 0.32
    const font = (s) => `900 ${s}px 'Arial Rounded MT Bold', 'Arial Black', sans-serif`
    mg.font = font(size)
    const tw = mg.measureText(text).width
    if (tw > W * 0.88) size *= (W * 0.88) / tw
    mg.font = font(size)
    mg.textAlign = 'center'
    mg.textBaseline = 'middle'
    mg.fillStyle = '#fff'
    mg.fillText(text, W / 2, H / 2)

    // charge per 6px cell; the glow layer is drawn from it, blurred up
    const CS = 6
    const cw = Math.ceil(W / CS)
    const ch = Math.ceil(H / CS)
    const charge = new Float32Array(cw * ch)
    const age = new Float32Array(cw * ch).fill(99)
    const low = document.createElement('canvas')
    low.width = cw
    low.height = ch
    const lg = low.getContext('2d')
    const img = lg.createImageData(cw, ch)
    const layer = document.createElement('canvas')
    layer.width = W
    layer.height = H
    const yg = layer.getContext('2d')
    const rgb = [1, 3, 5].map((i) => parseInt((/^#[0-9a-f]{6}$/i.test(glow) ? glow : '#9dff7a').slice(i, i + 2), 16))

    let torch = null
    let demo = 0
    let raf = 0
    let last = 0
    const R = Math.min(W, H) * 0.16
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      // a demo sweep across the word first
      if (demo < 2.4) {
        demo += dt
        const k = demo / 2.4
        torch = { x: W * (0.1 + 0.8 * k), y: H / 2 + Math.sin(k * 9) * H * 0.08, demo: true }
        if (demo >= 2.4) torch = null
      }
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const i = y * cw + x
          if (torch) {
            const d = Math.hypot(x * CS - torch.x, y * CS - torch.y)
            if (d < R) {
              // charge up toward full, faster near the centre of the beam
              charge[i] += (1 - charge[i]) * Math.min(1, dt * 8 * (1 - d / R))
              age[i] = 0
              continue
            }
          }
          age[i] += dt * decay
          // phosphor afterglow: roughly hyperbolic decay
          charge[i] *= 1 / (1 + dt * decay * (0.9 / (0.6 + age[i])))
        }
      }
      for (let i = 0; i < charge.length; i++) {
        const v = charge[i]
        img.data[i * 4] = rgb[0]
        img.data[i * 4 + 1] = rgb[1]
        img.data[i * 4 + 2] = rgb[2]
        img.data[i * 4 + 3] = Math.min(255, v * 255)
      }
      lg.putImageData(img, 0, 0)
      // upscale the charge smoothly, keep it only on the paint
      yg.globalCompositeOperation = 'source-over'
      yg.clearRect(0, 0, W, H)
      yg.imageSmoothingEnabled = true
      yg.drawImage(low, 0, 0, W, H)
      yg.globalCompositeOperation = 'destination-in'
      yg.drawImage(mask, 0, 0)
      g.clearRect(0, 0, W, H)
      // the unlit paint, faintly visible in the dark
      g.globalAlpha = 0.07
      g.drawImage(mask, 0, 0)
      g.globalAlpha = 1
      // the glow, with a bloom
      g.filter = 'blur(8px)'
      g.drawImage(layer, 0, 0)
      g.filter = 'none'
      g.drawImage(layer, 0, 0)
      // the torch beam
      if (torch) {
        const b = g.createRadialGradient(torch.x, torch.y, 0, torch.x, torch.y, R * 1.2)
        b.addColorStop(0, 'rgba(235,225,255,.35)')
        b.addColorStop(1, 'rgba(235,225,255,0)')
        g.fillStyle = b
        g.fillRect(torch.x - R * 1.2, torch.y - R * 1.2, R * 2.4, R * 2.4)
      }
      raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      torch = { x: e.clientX - r.left, y: e.clientY - r.top }
      demo = 9
    }
    const leave = () => (torch = null)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [text, glow, decay])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#07080a', cursor: 'none', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
