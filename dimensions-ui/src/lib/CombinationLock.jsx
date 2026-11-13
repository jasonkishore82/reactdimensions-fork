import { useEffect, useRef, useState } from 'react'

// A letter combination lock (a cryptex): a row of brass rings, each carrying
// the alphabet round its rim. They all spin up, each at its own speed, and
// then stop one at a time from left to right. A ring doesn't stop dead: it
// coasts down and the detent spring clicks it into the nearest letter, with
// a small overshoot. When the last ring lands on the word, the window glows.
// Drag a ring up or down to turn it yourself.
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const N = ABC.length
const STEP = 360 / N

let actx
function tick(vol = 0.05) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (actx.state === 'suspended') actx.resume()
    const o = actx.createOscillator()
    const g = actx.createGain()
    o.frequency.value = 3200
    g.gain.setValueAtTime(vol, actx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.025)
    o.connect(g).connect(actx.destination)
    o.start()
    o.stop(actx.currentTime + 0.03)
  } catch {
    // no audio available
  }
}

export default function CombinationLock({
  text = 'SECRET',
  spin = 1,
  gap = 600,
  metal = '#c9a34f',
  sound = false,
  style,
}) {
  const word = String(text)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 10) || 'A'
  const rings = useRef([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
    // each ring: angle (deg, letter i sits at -i*STEP), velocity, and mode
    const st = [...word].map((ch, i) => ({
      a: Math.random() * 360,
      v: (500 + Math.random() * 500) * spin * (i % 2 ? -1 : 1),
      mode: 'spin',
      stopAt: 900 + i * gap,
      target: ABC.indexOf(ch),
      lastIdx: -1,
      drag: null,
    }))
    let raf = 0
    let t0 = 0
    let last = 0
    const frame = (now) => {
      t0 ||= now
      const dt = Math.min(0.033, (now - (last || now)) / 1000)
      last = now
      const t = now - t0
      let done = 0
      st.forEach((s, i) => {
        if (s.drag) return
        if (s.mode === 'spin' && t >= s.stopAt) s.mode = 'coast'
        if (s.mode === 'coast') {
          // friction slows it; once slow, the detent takes over and pulls to
          // the target letter's notch
          s.v *= Math.exp(-dt * 3.2)
          if (Math.abs(s.v) < 120) {
            s.mode = 'settle'
            let goal = -s.target * STEP
            goal += Math.round((s.a - goal) / 360) * 360
            // keep turning the way it was going
            if (s.v > 0 && goal < s.a) goal += 360
            if (s.v < 0 && goal > s.a) goal -= 360
            s.goal = goal
          }
        }
        if (s.mode === 'settle' || s.mode === 'free') {
          const goal = s.mode === 'free' ? Math.round(s.a / STEP) * STEP : s.goal
          s.v += ((goal - s.a) * 60 - s.v * 9) * dt
          if (Math.abs(goal - s.a) < 0.05 && Math.abs(s.v) < 1) {
            s.a = goal
            s.v = 0
            if (s.mode === 'settle') s.mode = 'done'
          }
        }
        if (s.mode === 'done') done++
        s.a += s.v * dt
        const idx = Math.round(-s.a / STEP)
        if (sound && idx !== s.lastIdx) tick(Math.min(0.06, 0.01 + Math.abs(s.v) / 20000))
        s.lastIdx = idx
        const el = rings.current[i]
        if (el) el.style.transform = `translateZ(-3.3em) rotateX(${s.a}deg)`
      })
      // open when every ring reads the word
      setOpen(st.every((s) => ABC[(((Math.round(-s.a / STEP)) % N) + N) % N] === word[st.indexOf(s)]) && done === st.length)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // drag a ring to turn it by hand
    const cleanup = []
    st.forEach((s, i) => {
      const el = rings.current[i]?.parentElement
      if (!el) return
      const down = (e) => {
        s.drag = { y: e.clientY, a: s.a, t: performance.now(), lastY: e.clientY }
        el.setPointerCapture(e.pointerId)
      }
      const move = (e) => {
        if (!s.drag) return
        const now = performance.now()
        s.v = ((s.drag.lastY - e.clientY) * 1.6) / Math.max(0.001, (now - s.drag.t) / 1000) * 0.5
        s.drag.t = now
        s.drag.lastY = e.clientY
        s.a = s.drag.a + (s.drag.y - e.clientY) * 1.6
        const el2 = rings.current[i]
        if (el2) el2.style.transform = `translateZ(-3.3em) rotateX(${s.a}deg)`
      }
      const up = () => {
        if (!s.drag) return
        s.drag = null
        s.mode = 'free'
      }
      el.addEventListener('pointerdown', down)
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
      cleanup.push(() => {
        el.removeEventListener('pointerdown', down)
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
      })
    })
    return () => {
      cancelAnimationFrame(raf)
      cleanup.forEach((f) => f())
    }
  }, [word, spin, gap, sound])

  // the ring's radius: 26 faces 0.8em tall close into a circle of 0.8 / (2 tan(pi/26))
  const R = 3.3
  return (
    <div role="img" aria-label={`Combination lock reading ${word}`} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 0, padding: '0 0.3em', ...style }}>
      {/* end cap */}
      <div style={{ width: '0.5em', height: '2.6em', borderRadius: '0.25em 0 0 0.25em', background: `linear-gradient(${metal}, #6b5320 50%, ${metal})` }} />
      {[...word].map((_, i) => (
        <div key={i} style={{ position: 'relative', width: '1.1em', height: '2.4em', perspective: '12em', cursor: 'ns-resize', touchAction: 'none', overflow: 'hidden', borderLeft: '0.04em solid rgba(0,0,0,.45)' }}>
          <div ref={(n) => (rings.current[i] = n)} style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 0, transformStyle: 'preserve-3d' }}>
            {[...ABC].map((ch, k) => (
              <div
                key={ch}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '-0.4em',
                  height: '0.8em',
                  lineHeight: '0.8em',
                  textAlign: 'center',
                  color: '#2d2208',
                  background: `linear-gradient(${metal}, color-mix(in srgb, ${metal} 80%, #fff) 40%, ${metal} 60%, color-mix(in srgb, ${metal} 70%, #000))`,
                  backfaceVisibility: 'hidden',
                  transform: `rotateX(${k * STEP}deg) translateZ(${R}em)`,
                }}
              >
                <span style={{ font: "700 0.62em/1.29 Georgia, 'Times New Roman', serif" }}>{ch}</span>
              </div>
            ))}
          </div>
          {/* shading: the ring curves away from you above and below */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(rgba(0,0,0,.75), rgba(0,0,0,0) 32%, rgba(255,255,255,.08) 50%, rgba(0,0,0,0) 68%, rgba(0,0,0,.75))' }} />
        </div>
      ))}
      <div style={{ width: '0.5em', height: '2.6em', borderRadius: '0 0.25em 0.25em 0', background: `linear-gradient(${metal}, #6b5320 50%, ${metal})` }} />
      {/* the reading window */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', pointerEvents: 'none', left: '0.75em', right: '0.75em', top: '50%', height: '0.86em', marginTop: '-0.43em', border: '0.05em solid rgba(40,30,8,.7)', borderRadius: '0.06em', boxShadow: open ? '0 0 0.3em #ffcf5a, inset 0 0 0.2em #ffcf5a' : 'none', transition: 'box-shadow 400ms' }}
      />
    </div>
  )
}
