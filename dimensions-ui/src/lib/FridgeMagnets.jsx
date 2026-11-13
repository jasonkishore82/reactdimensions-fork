import { useEffect, useRef } from 'react'

// Word magnets on a fridge door. Drag a word to pick it up: it lifts off the
// door (bigger shadow), and as you slide it, it shoves any word in its way,
// which skids and stops quickly because a magnet drags on the steel. Let go
// and it clacks back onto the door, its row snapping gently to the nearest
// line so you can compose in neat rows, still a touch crooked like real ones.
const FRICTION = 14 // how fast a shoved magnet stops, per second

let actx
function clack() {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (actx.state === 'suspended') actx.resume()
    const len = Math.floor(actx.sampleRate * 0.03)
    const buf = actx.createBuffer(1, len, actx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 6
    const src = actx.createBufferSource()
    src.buffer = buf
    const lp = actx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1500
    const g = actx.createGain()
    g.gain.value = 0.35
    src.connect(lp).connect(g).connect(actx.destination)
    src.start()
  } catch {
    // no audio available
  }
}

export default function FridgeMagnets({
  words = 'the, slow, light, of, morning, falls, across, a, quiet, kitchen, and, you, are, still, here, humming, softly, sweet, dream',
  door = '#e7eaee',
  tile = '#fbfaf6',
  ink = '#1d1d1f',
  snap = true,
  sound = false,
  style,
}) {
  const box = useRef()
  const els = useRef([])

  useEffect(() => {
    const el = box.current
    const list = String(words)
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean)
    let W = el.clientWidth
    let H = el.clientHeight
    let raf = 0
    let last = 0
    let drag = null
    const bodies = list.map((w, i) => {
      const n = els.current[i]
      return { n, w: n.offsetWidth, h: n.offsetHeight, x: 0, y: 0, vx: 0, vy: 0, rot: (Math.random() - 0.5) * 6, ty: null, lift: 0 }
    })
    const rowH = () => (bodies[0]?.h || 30) * 1.45

    // scatter them in loose rows, shuffled, a little off-grid
    const order = [...bodies].sort(() => Math.random() - 0.5)
    let x = W * 0.08
    let row = 0
    const top = H * 0.16
    for (const b of order) {
      if (x + b.w > W * 0.92) {
        x = W * 0.08
        row++
      }
      b.x = x + b.w / 2 + (Math.random() - 0.5) * 10
      b.y = top + row * rowH() * 1.25 + b.h / 2 + (Math.random() - 0.5) * 10
      x += b.w + 14 + Math.random() * 22
    }

    const nearestRow = (y) => top + Math.round((y - top - bodies[0].h / 2) / rowH()) * rowH() + bodies[0].h / 2

    const separate = () => {
      // push overlapping magnets apart along the shallow axis; the one in
      // the hand never gives way
      for (let it = 0; it < 4; it++) {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const A = bodies[i]
            const B = bodies[j]
            const ox = (A.w + B.w) / 2 + 3 - Math.abs(A.x - B.x)
            const oy = (A.h + B.h) / 2 + 3 - Math.abs(A.y - B.y)
            if (ox <= 0 || oy <= 0) continue
            const aFix = drag?.b === A
            const bFix = drag?.b === B
            const sa = aFix ? 0 : bFix ? 1 : 0.5
            const sb = 1 - sa
            if (ox < oy) {
              const s = Math.sign(B.x - A.x) || 1
              A.x -= s * ox * sa
              B.x += s * ox * sb
              // a shove gives the struck magnet some speed of its own
              const v = drag ? drag.vx : 0
              if (aFix) B.vx += (v * 0.5 + s * 60) * 0.25
              if (bFix) A.vx += (v * 0.5 - s * 60) * 0.25
            } else {
              const s = Math.sign(B.y - A.y) || 1
              A.y -= s * oy * sa
              B.y += s * oy * sb
              const v = drag ? drag.vy : 0
              if (aFix) B.vy += (v * 0.5 + s * 60) * 0.25
              if (bFix) A.vy += (v * 0.5 - s * 60) * 0.25
              // whatever got knocked off its row looks for a new one
              if (!aFix) A.ty = null
              if (!bFix) B.ty = null
            }
          }
        }
      }
    }

    const frame = (now) => {
      last ||= now
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      W = el.clientWidth
      H = el.clientHeight
      for (const b of bodies) {
        if (drag?.b === b) {
          b.lift += (1 - b.lift) * Math.min(1, dt * 18)
          continue
        }
        b.lift += (0 - b.lift) * Math.min(1, dt * 22)
        b.x += b.vx * dt
        b.y += b.vy * dt
        const k = Math.exp(-FRICTION * dt)
        b.vx *= k
        b.vy *= k
        // once it has stopped skidding, ease it onto its row
        if (snap && Math.hypot(b.vx, b.vy) < 20) {
          if (b.ty === null) b.ty = nearestRow(b.y)
          b.y += (b.ty - b.y) * Math.min(1, dt * 10)
        }
        // the door's edges
        b.x = Math.max(b.w / 2 + 6, Math.min(W - b.w / 2 - 6, b.x))
        b.y = Math.max(b.h / 2 + 6, Math.min(H - b.h / 2 - 6, b.y))
      }
      separate()
      for (const b of bodies) {
        const s = 1 + b.lift * 0.06
        b.n.style.transform = `translate(${(b.x - b.w / 2).toFixed(1)}px, ${(b.y - b.h / 2).toFixed(1)}px) rotate(${(b.rot * (1 - b.lift * 0.4)).toFixed(2)}deg) scale(${s.toFixed(3)})`
        b.n.style.boxShadow = `0 ${(1 + b.lift * 10).toFixed(1)}px ${(2 + b.lift * 16).toFixed(1)}px rgba(0,0,0,${(0.22 - b.lift * 0.06).toFixed(3)})`
        b.n.style.zIndex = drag?.b === b ? 2 : 1
      }
      raf = requestAnimationFrame(frame)
    }

    const local = (e) => {
      const r = el.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }
    const down = (e) => {
      const i = els.current.indexOf(e.target.closest?.('[data-magnet]'))
      if (i < 0) return
      const b = bodies[i]
      const [px, py] = local(e)
      drag = { b, dx: b.x - px, dy: b.y - py, vx: 0, vy: 0, lx: px, ly: py, lt: performance.now() }
      b.vx = b.vy = 0
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
    }
    const move = (e) => {
      if (!drag) return
      const [px, py] = local(e)
      const t = performance.now()
      const dt = Math.max(1, t - drag.lt) / 1000
      drag.vx = drag.vx * 0.6 + ((px - drag.lx) / dt) * 0.4
      drag.vy = drag.vy * 0.6 + ((py - drag.ly) / dt) * 0.4
      drag.lx = px
      drag.ly = py
      drag.lt = t
      drag.b.x = px + drag.dx
      drag.b.y = py + drag.dy
    }
    const up = () => {
      if (!drag) return
      const b = drag.b
      b.ty = null
      // a slightly different tilt each time it lands
      b.rot = (Math.random() - 0.5) * 6
      drag = null
      el.style.cursor = ''
      if (sound) clack()
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [words, snap, sound])

  const list = String(words)
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)
  return (
    <div
      ref={box}
      aria-label={`Word magnets: ${list.join(' ')}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        // brushed enamel door with a soft reflection
        background: `linear-gradient(100deg, rgba(255,255,255,.55), rgba(255,255,255,0) 35%, rgba(255,255,255,.25) 60%, rgba(255,255,255,0) 80%), ${door}`,
        ...style,
      }}
    >
      {/* the door handle */}
      <div aria-hidden="true" style={{ position: 'absolute', right: 18, top: '18%', bottom: '18%', width: 10, borderRadius: 6, background: 'linear-gradient(90deg, #b9bec5, #f2f4f6 45%, #9aa0a8)', boxShadow: '-3px 4px 8px rgba(0,0,0,.18)' }} />
      {list.map((w, i) => (
        <span
          key={`${i}-${w}`}
          data-magnet
          ref={(n) => (els.current[i] = n)}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            padding: '0.28em 0.5em 0.3em',
            background: tile,
            color: ink,
            font: "400 clamp(17px, 2.3vw, 24px)/1 'Times New Roman', Georgia, serif",
            whiteSpace: 'nowrap',
            cursor: 'grab',
            willChange: 'transform',
            // a die-cut edge: very slightly uneven
            borderRadius: '1px 2px 1px 2px',
          }}
        >
          {w}
        </span>
      ))}
    </div>
  )
}
