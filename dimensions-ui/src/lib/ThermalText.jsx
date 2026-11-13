import { useEffect, useRef } from 'react'

// A thermal camera pointed at a panel with the word inlaid in metal. At room
// temperature everything reads the same, so the word is invisible. Run the
// pointer over it like a hand and you warm it: the heat spreads out through
// the panel (a real diffusion simulation), and the metal letters hold their
// heat longer than the panel around them, so after you pass they stand out
// glowing and slowly fade as the heat bleeds away. The picture uses the
// "ironbow" palette thermal cameras use, with a spot-temperature readout.
const STOPS = [
  [0, [0, 0, 10]],
  [0.15, [40, 0, 90]],
  [0.35, [140, 0, 140]],
  [0.55, [220, 50, 40]],
  [0.75, [255, 150, 0]],
  [0.9, [255, 230, 80]],
  [1, [255, 255, 240]],
]
const ironbow = (v) => {
  v = Math.max(0, Math.min(1, v))
  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1]
      const [b, cb] = STOPS[i]
      const k = (v - a) / (b - a)
      return ca.map((x, j) => x + (cb[j] - x) * k)
    }
  }
  return STOPS[STOPS.length - 1][1]
}

export default function ThermalText({
  text = 'WARM',
  spread = 1,
  hold = 1,
  style,
}) {
  const box = useRef()
  const cv = useRef()
  const readout = useRef()

  useEffect(() => {
    const el = box.current
    const c = cv.current
    const g = c.getContext('2d')
    const W = el.clientWidth
    const H = el.clientHeight
    const CS = 5
    const cw = Math.ceil(W / CS)
    const ch = Math.ceil(H / CS)
    c.width = cw
    c.height = ch

    const m = document.createElement('canvas')
    m.width = cw
    m.height = ch
    const mg = m.getContext('2d', { willReadFrequently: true })
    let size = ch * 0.5
    const font = (s) => `900 ${s}px 'Arial Black', Impact, sans-serif`
    mg.font = font(size)
    const tw = mg.measureText(text).width
    if (tw > cw * 0.84) size *= (cw * 0.84) / tw
    mg.font = font(size)
    mg.textAlign = 'center'
    mg.textBaseline = 'middle'
    mg.fillText(text, cw / 2, ch / 2)
    const md = mg.getImageData(0, 0, cw, ch).data
    const metal = new Float32Array(cw * ch)
    for (let i = 0; i < cw * ch; i++) metal[i] = md[i * 4 + 3] / 255
    // thermal conductivity of each cell: metal 1, the panel 1/20 of that
    const K = new Float32Array(cw * ch)
    for (let i = 0; i < cw * ch; i++) K[i] = 0.05 + 0.95 * metal[i]

    let T = new Float32Array(cw * ch)
    let N = new Float32Array(cw * ch)
    const img = g.createImageData(cw, ch)
    let hand = null
    let demo = 0
    let raf = 0
    let last = 0
    const frame = (now) => {
      const dt = Math.min(0.033, (now - (last || now)) / 1000)
      last = now
      // a demo: a hand rubbed back and forth over the whole panel, so the
      // word warms up and then shows as the panel cools around it
      if (demo < 5) {
        demo += dt
        const k = demo / 5
        hand = { x: cw * (0.06 + 0.88 * k), y: ch * (0.5 + 0.34 * Math.sin(k * Math.PI * 10)) }
        if (demo >= 5) hand = null
      }
      // heat in from the hand
      if (hand) {
        const R = 7
        for (let y = Math.max(0, (hand.y - R) | 0); y < Math.min(ch, hand.y + R); y++) {
          for (let x = Math.max(0, (hand.x - R) | 0); x < Math.min(cw, hand.x + R); x++) {
            const d = Math.hypot(x - hand.x, y - hand.y)
            // the metal inlay takes up heat from the hand faster than the panel
            if (d < R) T[y * cw + x] += (1 - d / R) * dt * 14 * (1 + metal[y * cw + x] * 0.9)
          }
        }
      }
      // conduction, per second: each pair of neighbouring cells exchanges
      // heat in proportion to their temperature difference and to the
      // conductance of the joint between them (the harmonic mean of the two
      // materials' conductivities). Metal conducts well and the panel
      // poorly, so heat races through a letter but leaks only slowly from
      // the letter into the panel. Both lose heat to the room, the panel
      // fast, the polished metal slowly (it radiates poorly).
      const D = 9 * spread
      const SUB = Math.max(1, Math.ceil((dt * D * 4) / 0.8))
      const h = dt / SUB
      for (let s = 0; s < SUB; s++) {
        for (let y = 1; y < ch - 1; y++) {
          for (let x = 1; x < cw - 1; x++) {
            const i = y * cw + x
            const ki = K[i]
            let flux = 0
            for (const j of [i - 1, i + 1, i - cw, i + cw]) {
              const kj = K[j]
              flux += ((2 * ki * kj) / (ki + kj)) * (T[j] - T[i])
            }
            const cool = metal[i] > 0.5 ? 0.07 / hold : 0.9
            N[i] = Math.max(0, T[i] + D * h * flux - T[i] * cool * h)
          }
        }
        const t = T
        T = N
        N = t
      }
      for (let i = 0; i < cw * ch; i++) {
        // the camera reads a little noise, as real sensors do
        const v = 0.07 + T[i] * 1.4 + (Math.random() - 0.5) * 0.012
        const [r, gg, b] = ironbow(v)
        img.data[i * 4] = r
        img.data[i * 4 + 1] = gg
        img.data[i * 4 + 2] = b
        img.data[i * 4 + 3] = 255
      }
      g.putImageData(img, 0, 0)
      if (readout.current) {
        const p = hand || { x: cw / 2, y: ch / 2 }
        const v = T[(p.y | 0) * cw + (p.x | 0)] || 0
        readout.current.textContent = `${(21.4 + v * 18).toFixed(1)}°C`
      }
      raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      hand = { x: (e.clientX - r.left) / CS, y: (e.clientY - r.top) / CS }
      demo = 9
    }
    const leave = () => (hand = null)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [text, spread, hold])

  const hud = { position: 'absolute', font: '600 11px/1 ui-monospace, Menlo, monospace', color: 'rgba(255,255,255,.85)', letterSpacing: '0.06em', textShadow: '0 1px 2px #000' }
  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000', cursor: 'crosshair', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'auto', filter: 'blur(1.5px)' }} />
      {/* camera overlay */}
      <div style={{ ...hud, left: 14, top: 12 }}>IR · IRONBOW</div>
      <div ref={readout} style={{ ...hud, right: 14, top: 12, fontSize: 14 }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 22, height: 22, margin: -11, border: '1px solid rgba(255,255,255,.7)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 14, top: 36, bottom: 36, width: 8, borderRadius: 4, background: `linear-gradient(to top, ${STOPS.map(([k, c]) => `rgb(${c.join(',')}) ${k * 100}%`).join(', ')})` }} />
    </div>
  )
}
