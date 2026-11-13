import { useEffect, useRef } from 'react'

// A word standing at the edge of a still pond, mirrored in the water. The
// surface is never quite flat: a slow swell wobbles the reflection, more
// the further it is from the bank. Touch the water and a ring of ripples
// spreads out from that point, travelling outwards, losing height as it
// spreads, and bending the reflection as it passes. The reflection is
// darker than the real thing (water reflects only part of the light) and
// fades with depth.
export default function WaterReflection({
  text = 'STILL WATER',
  ink = '#1d2433',
  water = '#3d6b86',
  calm = 1,
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
    const S = 2 // render the water at half resolution
    const wW = Math.ceil(W / S)
    const horizon = Math.round(H * 0.56)
    const wH = Math.ceil((H - horizon) / S)
    c.width = W
    c.height = H

    // the word on the bank, at full resolution
    const src = document.createElement('canvas')
    src.width = W
    src.height = horizon
    const sg = src.getContext('2d', { willReadFrequently: true })
    const sky = sg.createLinearGradient(0, 0, 0, horizon)
    sky.addColorStop(0, '#f7e9d6')
    sky.addColorStop(1, '#f0d9bd')
    sg.fillStyle = sky
    sg.fillRect(0, 0, W, horizon)
    let size = H * 0.2
    const font = (s) => `800 ${s}px Georgia, 'Times New Roman', serif`
    sg.font = font(size)
    const tw = sg.measureText(text).width
    if (tw > W * 0.86) size *= (W * 0.86) / tw
    sg.font = font(size)
    sg.textAlign = 'center'
    sg.textBaseline = 'alphabetic'
    sg.fillStyle = ink
    sg.fillText(text, W / 2, horizon - 4)
    g.drawImage(src, 0, 0)
    // sample source at half res for the reflection
    const half = document.createElement('canvas')
    half.width = wW
    half.height = Math.ceil(horizon / S)
    const hg = half.getContext('2d', { willReadFrequently: true })
    hg.drawImage(src, 0, 0, wW, half.height)
    const sd = hg.getImageData(0, 0, wW, half.height).data
    const sH = half.height
    const out = g.createImageData(wW, wH)
    const low = document.createElement('canvas')
    low.width = wW
    low.height = wH
    const lg = low.getContext('2d')
    const wc = [1, 3, 5].map((i) => parseInt((/^#[0-9a-f]{6}$/i.test(water) ? water : '#3d6b86').slice(i, i + 2), 16))

    const ripples = []
    let t = 0
    let last = 0
    let raf = 0
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      t += dt
      for (let k = ripples.length - 1; k >= 0; k--) if (t - ripples[k].t0 > 6) ripples.splice(k, 1)
      for (let y = 0; y < wH; y++) {
        const depth = y / wH
        for (let x = 0; x < wW; x++) {
          // surface slope from the swell...
          let dx = Math.sin(y * 0.35 - t * 2.1 + Math.sin(x * 0.02) * 2) * (0.4 + depth * 2.2) * calm
          let dy = Math.cos(y * 0.5 - t * 1.6) * (0.2 + depth) * calm
          // ...and from every ripple ring
          for (const r of ripples) {
            const ex = x - r.x
            const ey = (y - r.y) * 2.2 // seen at a low angle, rings look squashed
            const dist = Math.hypot(ex, ey) + 0.001
            const front = (t - r.t0) * 60
            const ph = dist - front
            if (ph > 0 || ph < -90) continue
            const amp = (8 * Math.exp(ph / 30)) / (1 + front * 0.03)
            const wave = Math.sin(ph * 0.45) * amp
            dx += (ex / dist) * wave
            dy += (ey / dist) * wave * 0.5
          }
          // reflection: mirror the bank about the waterline
          const sx = Math.max(0, Math.min(wW - 1, Math.round(x + dx)))
          const sy = Math.max(0, Math.min(sH - 1, Math.round(sH - 1 - y + dy)))
          const si = (sy * wW + sx) * 4
          const o = (y * wW + x) * 4
          const mix = 0.45 + depth * 0.4
          out.data[o] = sd[si] * (1 - mix) * 0.85 + wc[0] * mix
          out.data[o + 1] = sd[si + 1] * (1 - mix) * 0.85 + wc[1] * mix
          out.data[o + 2] = sd[si + 2] * (1 - mix) * 0.85 + wc[2] * mix
          out.data[o + 3] = 255
        }
      }
      lg.putImageData(out, 0, 0)
      g.imageSmoothingEnabled = true
      g.drawImage(low, 0, horizon, W, H - horizon)
      // a soft bright line at the waterline
      g.fillStyle = 'rgba(255,255,255,.25)'
      g.fillRect(0, horizon, W, 1.5)
      raf = requestAnimationFrame(frame)
    }
    const touch = (e) => {
      const r = el.getBoundingClientRect()
      const y = e.clientY - r.top
      if (y < horizon) return
      ripples.push({ x: (e.clientX - r.left) / S, y: (y - horizon) / S, t0: t })
    }
    el.addEventListener('pointerdown', touch)
    const first = setTimeout(() => ripples.push({ x: wW * 0.42, y: wH * 0.35, t0: t }), 700)
    raf = requestAnimationFrame(frame)
    return () => {
      clearTimeout(first)
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', touch)
    }
  }, [text, ink, water, calm])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f0d9bd', cursor: 'pointer', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
