import { useEffect, useRef } from 'react'

// The letters stand on edge as a row of dominoes. Tip one and it falls,
// pivoting on its bottom corner under gravity, until its top edge strikes
// the next one and passes the push along. A struck domino doesn't drop away:
// it comes to rest leaning on its neighbour, so the row behind the wave lies
// in a neat slanted stack, and the last one falls flat. Click any domino to
// tip it; dominoes before it stay standing.
//
// Each falling domino is a rigid slab rotating about its front corner:
// angular acceleration = g * (lever arm of its centre of mass) / I, with
// I = m (w^2 + h^2) / 3 about the corner. A leaning domino's angle is solved
// from the geometry of its top corner resting on the next one's face.
const G = 2400 // px/s^2

let actx
function tick(v) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (actx.state === 'suspended') actx.resume()
    const len = Math.floor(actx.sampleRate * 0.02)
    const buf = actx.createBuffer(1, len, actx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 5
    const src = actx.createBufferSource()
    src.buffer = buf
    const bp = actx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2000 + Math.random() * 800
    bp.Q.value = 3
    const g = actx.createGain()
    g.gain.value = Math.min(0.25, 0.05 + v * 0.02)
    src.connect(bp).connect(g).connect(actx.destination)
    src.start()
  } catch {
    // no audio available
  }
}

export default function DominoText({
  text = 'DOMINOES',
  spacing = 0.55,
  trigger = 'mount',
  tile = '#16161a',
  ink = '#f5f1e8',
  accent = '#ff4d1a',
  sound = false,
  style,
}) {
  const box = useRef()
  const tiles = useRef([])

  useEffect(() => {
    const el = box.current
    const chars = [...String(text)]
    let raf = 0
    let last = 0
    let L = 100 // domino height
    let w = 40 // domino face width
    let base = 0
    let x0 = 0
    const ds = chars.map((c, i) => ({ c, i, th: 0, om: 0, state: 'up', el: tiles.current[i] }))
    // pivot (front bottom corner) of domino i, in px, y downwards
    const px = (i) => x0 + i * (w + gap()) + w
    const gap = () => L * spacing

    const layout = () => {
      const W = el.clientWidth
      const H = el.clientHeight
      const n = ds.length
      // fit the row: n faces plus n-1 gaps, plus room for the last to fall flat
      L = Math.min(H * 0.42, (W * 0.86) / (n * 0.36 + (n - 1) * spacing + 1))
      w = L * 0.36
      const total = n * w + (n - 1) * gap() + L
      x0 = (W - total) / 2
      base = H * 0.66
      for (const d of ds) {
        if (!d.el) continue
        d.el.style.width = `${w}px`
        d.el.style.height = `${L}px`
        d.el.style.fontSize = `${w * 0.78}px`
        d.el.style.left = `${px(d.i) - w}px`
        d.el.style.top = `${base - L}px`
      }
    }

    // angle at which domino i's top corner rests on domino i+1's face
    // (domino i+1 at angle ph). Rotation is clockwise about each pivot.
    const restAngle = (i, ph) => {
      const g = gap()
      // next domino's back face: bottom-back corner and its upward direction
      const bx = px(i + 1) - px(i) - w * Math.cos(ph)
      const by = w * Math.sin(ph)
      const ux = Math.sin(ph)
      const uy = Math.cos(ph)
      // find th where the top corner (L sin th, L cos th) lies on that line
      const f = (th) => (L * Math.sin(th) - bx) * uy - (L * Math.cos(th) - by) * ux
      let lo = Math.asin(Math.min(1, g / L)) * 0.5
      let hi = Math.PI / 2
      if (f(lo) > 0) return lo
      for (let k = 0; k < 30; k++) {
        const m = (lo + hi) / 2
        if (f(m) > 0) hi = m
        else lo = m
      }
      return lo
    }
    // first contact, when the next one is still upright
    const hitAngle = () => Math.asin(Math.min(1, gap() / L))

    const alpha = (th) => {
      // lever arm of the centre of mass about the pivot (positive = falling)
      const arm = (-w / 2) * Math.cos(th) + (L / 2) * Math.sin(th)
      return (G * arm) / ((w * w + L * L) / 3)
    }

    const tip = (i, push = 3.6) => {
      const d = ds[i]
      if (!d || d.state !== 'up') return
      d.state = 'fall'
      d.om = push
    }

    const step = (h) => {
      for (let i = 0; i < ds.length; i++) {
        const d = ds[i]
        if (d.state !== 'fall') continue
        // the dominoes leaning on this one keep pushing with their own weight
        let lean = 0
        for (let j = i - 1, k = 0; j >= 0 && ds[j].state === 'lean' && k < 3; j--, k++) lean += Math.max(0, alpha(ds[j].th)) * 0.8
        d.om += (alpha(d.th) + lean) * h
        d.om *= 0.999
        d.th += d.om * h
        if (d.th <= 0) {
          // not pushed hard enough to get over its corner: it rocks back upright
          d.th = 0
          d.om = 0
          d.state = 'up'
          continue
        }
        const next = ds[i + 1]
        if (next && d.th >= (next.state === 'up' ? hitAngle() : restAngle(i, next.th))) {
          // strike: pass the push on, then rest against it
          if (sound) tick(d.om)
          if (next.state === 'up') {
            next.state = 'fall'
            next.om = Math.max(next.om, d.om * 0.95)
          } else if (next.state === 'fall') next.om = Math.max(next.om, d.om * 0.5)
          d.state = 'lean'
          d.om = 0
        } else if (!next && d.th >= Math.PI / 2) {
          // the last one hits the table
          if (sound && d.om > 1) tick(d.om * 1.5)
          d.th = Math.PI / 2
          d.om = -d.om * 0.18
          if (Math.abs(d.om) < 0.4) {
            d.om = 0
            d.state = 'flat'
          }
        }
      }
      // the leaners follow the one they rest on, back to front
      for (let i = ds.length - 2; i >= 0; i--) {
        if (ds[i].state === 'lean') ds[i].th = restAngle(i, ds[i + 1].th)
      }
    }

    const draw = () => {
      for (const d of ds) {
        if (!d.el) continue
        d.el.style.transform = d.th ? `rotate(${d.th}rad)` : ''
        // a face turned away from the overhead light reads a little darker
        d.el.style.filter = d.th ? `brightness(${(1 - 0.28 * Math.sin(d.th)).toFixed(3)})` : ''
      }
    }

    const frame = (now) => {
      last ||= now
      const dt = Math.min(1 / 30, (now - last) / 1000)
      last = now
      for (let s = 0; s < 6; s++) step(dt / 6)
      draw()
      raf = requestAnimationFrame(frame)
    }

    const down = (e) => {
      const t = e.target.closest?.('[data-domino]')
      if (t) tip(+t.dataset.domino)
    }

    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(el)
    el.addEventListener('pointerdown', down)
    raf = requestAnimationFrame(frame)
    const auto = trigger === 'mount' ? setTimeout(() => tip(0), 700) : 0
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(auto)
      ro.disconnect()
      el.removeEventListener('pointerdown', down)
    }
  }, [text, spacing, trigger, sound])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(#f4f2ee 66%, #e2ddd3 66%, #d9d3c8)', userSelect: 'none', ...style }}>
      {[...String(text)].map((c, i) => (
        <div
          key={`${i}-${c}`}
          data-domino={i}
          ref={(n) => (tiles.current[i] = n)}
          aria-hidden="true"
          style={{
            position: 'absolute',
            boxSizing: 'border-box',
            transformOrigin: '100% 100%',
            borderRadius: '0.12em',
            background: `linear-gradient(100deg, color-mix(in srgb, ${tile} 82%, #fff) 0%, ${tile} 18%, ${tile} 82%, color-mix(in srgb, ${tile} 70%, #000) 100%)`,
            boxShadow: '0 0.06em 0.12em rgba(0,0,0,.28), inset 0 0.03em 0 rgba(255,255,255,.18)',
            color: i % 4 === 1 ? accent : ink,
            display: 'grid',
            placeItems: 'center',
            font: "800 1em/1 var(--sans, 'Helvetica Neue', Arial, sans-serif)",
            cursor: 'pointer',
            willChange: 'transform',
          }}
        >
          {/* the dividing bar and a pip, like a real domino */}
          <span style={{ position: 'absolute', left: '18%', right: '18%', top: '50%', height: '0.04em', background: 'currentColor', opacity: 0.18 }} />
          <span style={{ position: 'relative', top: c === ' ' ? 0 : '-0.02em' }}>{c === ' ' ? '' : c}</span>
          <span style={{ position: 'absolute', left: '50%', bottom: '0.22em', width: '0.12em', height: '0.12em', marginLeft: '-0.06em', borderRadius: '50%', background: 'currentColor', opacity: 0.55 }} />
        </div>
      ))}
    </div>
  )
}
