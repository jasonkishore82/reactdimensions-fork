import { useEffect, useRef } from 'react'

// Autumn leaves. A pile of leaves lies on the ground; a gust lifts them and
// they flutter up and settle into the shape of the word, hanging there as
// if held by the wind. Then the next gust scatters them: they tumble off
// downwind, see-sawing as they fall (a falling leaf rocks side to side and
// flips as air spills off its edges), and land back in a pile. Click to
// call the next gust.
const COLORS = ['#c0392b', '#d35400', '#e67e22', '#f39c12', '#b9770e', '#8e3b1f', '#d4a017']

export default function AutumnLeaves({
  text = 'AUTUMN',
  leaves = 520,
  hold = 3,
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

    // target points inside the word
    const m = document.createElement('canvas')
    m.width = W
    m.height = H
    const mg = m.getContext('2d', { willReadFrequently: true })
    let size = H * 0.42
    const font = (s) => `900 ${s}px 'Arial Black', Impact, sans-serif`
    mg.font = font(size)
    const tw = mg.measureText(text).width
    if (tw > W * 0.88) size *= (W * 0.88) / tw
    mg.font = font(size)
    mg.textAlign = 'center'
    mg.textBaseline = 'middle'
    mg.fillText(text, W / 2, H * 0.44)
    const md = mg.getImageData(0, 0, W, H).data
    const targets = []
    for (let tries = 0; targets.length < leaves && tries < leaves * 200; tries++) {
      const x = Math.random() * W
      const y = Math.random() * H
      if (md[((y | 0) * W + (x | 0)) * 4 + 3] > 128) targets.push([x, y])
    }

    // a few leaf sprites
    const sprites = COLORS.map((col) => {
      const k = document.createElement('canvas')
      k.width = 40
      k.height = 40
      const kg = k.getContext('2d')
      kg.translate(20, 20)
      kg.fillStyle = col
      kg.beginPath()
      kg.moveTo(0, -16)
      kg.bezierCurveTo(12, -10, 14, 6, 0, 16)
      kg.bezierCurveTo(-14, 6, -12, -10, 0, -16)
      kg.fill()
      kg.strokeStyle = 'rgba(60,25,10,.45)'
      kg.lineWidth = 1
      kg.beginPath()
      kg.moveTo(0, -14)
      kg.lineTo(0, 18)
      kg.stroke()
      return k
    })

    const ground = () => [W * (0.1 + Math.random() * 0.8), H * (0.8 + Math.random() * 0.15)]
    const L = targets.map((t) => {
      const [gx, gy] = ground()
      return { t, x: gx, y: gy, vx: 0, vy: 0, a: Math.random() * 6, spin: 0, flip: Math.random() * 6, s: 0.38 + Math.random() * 0.3, sp: sprites[(Math.random() * sprites.length) | 0], delay: Math.random() * 0.8, rest: [gx, gy] }
    })
    // phases: pile -> gather -> hold -> scatter -> fall -> pile
    let phase = 'pile'
    let pt = 0
    let raf = 0
    let last = 0
    let time = 0
    const next = () => {
      if (phase === 'pile') phase = 'gather'
      else if (phase === 'gather' || phase === 'hold') {
        phase = 'scatter'
        for (const l of L) {
          l.vx = 300 + Math.random() * 400
          l.vy = -120 - Math.random() * 300
          l.rest = ground()
        }
      }
      pt = 0
    }
    const frame = (now) => {
      const dt = Math.min(0.04, (now - (last || now)) / 1000)
      last = now
      time += dt
      pt += dt
      if (phase === 'pile' && pt > 1.2) next()
      if (phase === 'gather' && pt > 3.2) {
        phase = 'hold'
        pt = 0
      }
      if (phase === 'hold' && pt > hold) next()
      if (phase === 'scatter' && pt > 3.5) {
        phase = 'pile'
        pt = 0
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      for (const l of L) {
        if (phase === 'gather' || phase === 'hold') {
          // carried along by the gust on a curving path, then held
          const k = Math.max(0, Math.min(1, (pt - l.delay) / 1.8))
          if (k > 0) {
            const tx = l.t[0] + Math.sin(time * 2 + l.flip) * (phase === 'hold' ? 1.5 : 0)
            const ty = l.t[1] + Math.cos(time * 1.7 + l.flip) * (phase === 'hold' ? 1.5 : 0)
            const e = 1 - (1 - k) ** 3
            const lift = Math.sin(k * Math.PI) * -H * 0.15
            l.x += (l.rest[0] + (tx - l.rest[0]) * e - l.x) * Math.min(1, dt * 12)
            l.y += (l.rest[1] + (ty - l.rest[1]) * e + lift - l.y) * Math.min(1, dt * 12)
            l.spin = (1 - k) * 8
          }
        } else if (phase === 'scatter') {
          // blown off downwind, then see-saw falling
          l.vx *= Math.exp(-dt * 1.2)
          l.vy += 260 * dt
          l.vy *= Math.exp(-dt * 1.8)
          l.x += (l.vx + Math.sin(time * 4 + l.flip) * 60) * dt
          l.y += l.vy * dt
          l.spin = 5
          if (l.x > W + 30) l.x -= W + 60
          if (l.y > l.rest[1]) {
            l.y = l.rest[1]
            l.vy = 0
            l.vx *= 0.8
          }
        } else {
          l.x += (l.rest[0] - l.x) * Math.min(1, dt * 2)
          l.y += (l.rest[1] - l.y) * Math.min(1, dt * 2)
          l.spin = 0
          // the pile is the new starting point
          if (phase === 'pile') l.rest = [l.x, l.y]
        }
        l.a += l.spin * dt
        l.flip += dt * (1 + l.spin)
        const sz = 40 * l.s
        g.save()
        g.translate(l.x, l.y)
        g.rotate(l.a)
        // the flip: foreshortened as it turns over
        g.scale(Math.max(0.15, Math.abs(Math.cos(l.flip * (l.spin ? 1 : 0.05)))), 1)
        g.drawImage(l.sp, -sz / 2, -sz / 2, sz, sz)
        g.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    el.addEventListener('click', next)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('click', next)
    }
  }, [text, leaves, hold])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(#f6ecd9, #efd9b8 75%, #c9a67a 75%, #b38c5e)', cursor: 'pointer', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
