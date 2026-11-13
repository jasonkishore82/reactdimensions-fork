import { useEffect, useRef } from 'react'

// A neon sign on a dark wall. Switch it on and each tube strikes the way real
// ones do: a few stuttering flashes before the gas catches and holds. Once
// lit, the glow spills onto the wall, the tubes cast a faint shadow behind
// them, and every so often a worn tube flickers. Click to switch it off and on.
let actx
function hum(on) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (actx.state === 'suspended') actx.resume()
    if (!hum.g) {
      const o = actx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = 120 // mains hum, twice the 60 Hz supply
      const f = actx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 500
      hum.g = actx.createGain()
      hum.g.gain.value = 0
      o.connect(f).connect(hum.g).connect(actx.destination)
      o.start()
    }
    hum.g.gain.setTargetAtTime(on ? 0.018 : 0, actx.currentTime, 0.05)
  } catch {
    // no audio
  }
}

export default function NeonText({
  text = 'Open late',
  color = '#ff3d7f',
  wall = '#17141a',
  flicker = 0.5,
  sound = false,
  style,
}) {
  const letters = useRef([])
  const glow = useRef()
  const st = useRef({ on: true, timers: [] })

  const set = (i, level) => {
    const el = letters.current[i]
    if (!el) return
    el.style.opacity = String(0.18 + 0.82 * level)
    el.style.textShadow =
      level > 0.5
        ? `0 0 0.02em #fff, 0 0 0.06em ${color}, 0 0 0.16em ${color}, 0 0 0.36em ${color}, 0 0 0.8em ${color}aa`
        : `0 0 0.02em ${color}33`
    el.style.color = level > 0.5 ? '#fff4f8' : `${color}55`
    el.dataset.lit = level > 0.5 ? '1' : ''
  }
  const updateGlow = () => {
    const n = letters.current.filter(Boolean)
    const lit = n.filter((e) => e.dataset.lit).length / Math.max(1, n.length)
    if (glow.current) glow.current.style.opacity = String(lit)
    if (sound) hum(lit > 0)
  }

  const later = (ms, fn) => st.current.timers.push(setTimeout(fn, ms))
  const clear = () => {
    st.current.timers.forEach(clearTimeout)
    st.current.timers = []
  }

  const strike = () => {
    clear()
    const n = letters.current.length
    for (let i = 0; i < n; i++) {
      set(i, 0)
      // each tube catches at its own moment, after a few stutters
      let t = 150 + Math.random() * 500
      const flashes = 1 + Math.floor(Math.random() * 4)
      for (let k = 0; k < flashes; k++) {
        later(t, () => (set(i, 1), updateGlow()))
        t += 40 + Math.random() * 70
        later(t, () => (set(i, 0), updateGlow()))
        t += 60 + Math.random() * 220
      }
      later(t, () => (set(i, 1), updateGlow()))
    }
    // the occasional worn tube
    const worn = () => {
      if (!st.current.on) return
      if (flicker > 0 && n) {
        const i = Math.floor(Math.random() * n)
        if (letters.current[i]?.textContent.trim()) {
          let t = 0
          for (let k = 0; k < 2 + Math.random() * 4; k++) {
            later(t, () => (set(i, 0), updateGlow()))
            t += 30 + Math.random() * 60
            later(t, () => (set(i, 1), updateGlow()))
            t += 40 + Math.random() * 90
          }
        }
      }
      later((2500 + Math.random() * 5000) / Math.max(0.2, flicker), worn)
    }
    later(2500, worn)
  }

  const off = () => {
    clear()
    letters.current.forEach((_, i) => set(i, 0))
    updateGlow()
  }

  useEffect(() => {
    st.current.on = true
    strike()
    return () => {
      clear()
      if (sound) hum(false)
    }
  }, [text, color, flicker, sound])

  const toggle = () => {
    st.current.on = !st.current.on
    if (st.current.on) strike()
    else off()
  }

  return (
    <div
      role="img"
      aria-label={`Neon sign: ${text}`}
      onClick={toggle}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        // a painted brick wall, done with gradients
        background: `linear-gradient(rgba(0,0,0,.35) 1px, transparent 1px) 0 0 / 64px 26px, linear-gradient(90deg, rgba(0,0,0,.35) 1px, transparent 1px) 0 0 / 64px 52px, linear-gradient(90deg, rgba(0,0,0,.35) 1px, transparent 1px) 32px 26px / 64px 52px, ${wall}`,
        ...style,
      }}
    >
      {/* light spilling onto the wall */}
      <div ref={glow} aria-hidden="true" style={{ position: 'absolute', inset: '-20%', background: `radial-gradient(ellipse 45% 35% at 50% 50%, ${color}55, transparent 70%)`, opacity: 0, transition: 'opacity .08s', pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'relative', whiteSpace: 'pre' }}>
        {/* the tubes stand off the wall, so they cast a soft shadow */}
        <div style={{ position: 'absolute', inset: 0, transform: 'translate(0.05em, 0.08em)', color: 'rgba(0,0,0,.6)', filter: 'blur(0.03em)' }}>{text}</div>
        <div style={{ position: 'relative' }}>
          {[...String(text)].map((c, i) => (
            <span key={`${i}-${c}`} ref={(n) => (letters.current[i] = n)} style={{ transition: 'opacity .04s' }}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
