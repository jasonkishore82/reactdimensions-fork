import { useEffect, useRef } from 'react'

// A pin-art toy: a bed of loose steel pins in a frame, pushed out from
// behind so the shape stands out in relief. The word presses out from the
// middle as a wave, each pin sliding out with a little overshoot, and you see
// each one in perspective: the further it sticks out, the more of its shaft
// shows and the bigger and brighter its head. Press and drag on the bed to
// push pins out with your hand from behind; they slide back slowly.
export default function PinArt({
  text = 'PRESS',
  pitch = 11,
  depth = 1,
  metal = '#c8ccd2',
  style,
}) {
  const box = useRef()
  const cv = useRef()

  useEffect(() => {
    const el = box.current
    const c = cv.current
    const g = c.getContext('2d')
    let W = 0
    let H = 0
    let cols = 0
    let rows = 0
    let pins = []
    let raf = 0
    let t0 = 0
    let last = 0
    let hand = null
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    // one pre-lit pin head, drawn once and stamped for every pin
    const sprite = (stops) => {
      const k = document.createElement('canvas')
      k.width = k.height = 64
      const kg = k.getContext('2d')
      const gr = kg.createRadialGradient(20, 18, 2, 32, 32, 32)
      stops.forEach(([o, col]) => gr.addColorStop(o, col))
      kg.fillStyle = gr
      kg.beginPath()
      kg.arc(32, 32, 31, 0, Math.PI * 2)
      kg.fill()
      return k
    }
    const head = sprite([[0, '#ffffff'], [0.35, metal], [1, '#2a2c31']])
    const glint = sprite([[0, '#ffffff'], [0.5, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']])

    const build = () => {
      W = el.clientWidth
      H = el.clientHeight
      c.width = W * dpr
      c.height = H * dpr
      cols = Math.floor(W / pitch)
      rows = Math.floor(H / pitch)
      // rasterise the word at one sample per pin, slightly blurred so the
      // relief has a rounded shoulder rather than a cliff
      const m = document.createElement('canvas')
      m.width = cols
      m.height = rows
      const mg = m.getContext('2d', { willReadFrequently: true })
      let size = rows * 0.62
      mg.font = `900 ${size}px 'Arial Black', Impact, sans-serif`
      const tw = mg.measureText(text).width
      if (tw > cols * 0.86) size *= (cols * 0.86) / tw
      mg.filter = 'blur(0.6px)'
      mg.font = `900 ${size}px 'Arial Black', Impact, sans-serif`
      mg.textAlign = 'center'
      mg.textBaseline = 'middle'
      mg.fillText(text, cols / 2, rows / 2 + size * 0.04)
      const d = mg.getImageData(0, 0, cols, rows).data
      pins = []
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const target = d[(y * cols + x) * 4 + 3] / 255
          const dist = Math.hypot(x - cols / 2, (y - rows / 2) * 1.2)
          pins.push({ x: (x + 0.5) * (W / cols), y: (y + 0.5) * (H / rows), target, e: 0, v: 0, at: dist * 22, push: 0 })
        }
      }
      t0 = 0
    }

    const frame = (now) => {
      t0 ||= now
      const dt = Math.min(0.033, (now - (last || now)) / 1000)
      last = now
      const t = now - t0
      const R = pitch * 4.2
      for (const p of pins) {
        let goal = t > p.at ? p.target : 0
        if (hand) {
          const d = Math.hypot(p.x - hand.x, p.y - hand.y)
          if (d < R) p.push = Math.max(p.push, Math.cos((d / R) * (Math.PI / 2)) ** 1.5)
        }
        // pins pushed by hand slide back slowly under their own friction
        p.push = Math.max(0, p.push - dt * 0.35)
        goal = Math.max(goal, p.push)
        // a stiff spring with light damping: they shoot out and settle
        p.v += ((goal - p.e) * 260 - p.v * 18) * dt
        p.e += p.v * dt
      }
      // draw, top-left to bottom-right so nearer heads overlap
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = '#17181b'
      g.fillRect(0, 0, W, H)
      const r = pitch * 0.32
      const L = pitch * 2.6 * depth
      for (const p of pins) {
        const e = Math.max(0, p.e)
        // the eye is above and to the left, so a pin sticking out shows its
        // shaft running down-right to the head
        const hx = p.x + e * L * 0.35
        const hy = p.y + e * L * 0.55
        if (e > 0.02) {
          g.strokeStyle = 'rgba(160,166,175,.55)'
          g.lineWidth = r * 0.45
          g.beginPath()
          g.moveTo(p.x, p.y)
          g.lineTo(hx, hy)
          g.stroke()
        }
        const s = r * (1 + e * 0.35)
        g.drawImage(head, hx - s, hy - s, s * 2, s * 2)
        // pins further out catch more of the light
        if (e > 0.05) {
          g.globalAlpha = Math.min(0.5, e * 0.4)
          g.drawImage(glint, hx - s, hy - s, s * 2, s * 2)
          g.globalAlpha = 1
        }
      }
      raf = requestAnimationFrame(frame)
    }
    const local = (e) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e) => {
      hand = local(e)
      el.setPointerCapture(e.pointerId)
    }
    const move = (e) => hand && (hand = local(e))
    const up = () => (hand = null)
    build()
    const ro = new ResizeObserver(build)
    ro.observe(el)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
  }, [text, pitch, depth, metal])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#17181b', touchAction: 'none', cursor: 'grab', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
