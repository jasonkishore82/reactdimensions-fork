import { useEffect, useId, useRef, useState } from 'react'

// Nixie tubes: glass bulbs full of neon with ten wire cathodes, one shaped
// like each digit, stacked one behind another. The lit cathode glows orange
// in its own cloud of plasma; the other nine stay visible as dull grey wire,
// and the ones stacked in front of the lit digit cross over it, just as in a
// real tube. A hexagonal anode mesh sits over the front. When a digit changes
// the old glow dies and the new one strikes with a little flicker, and with
// "cycle" on each tube runs through all ten cathodes first, the way nixie
// clocks do to keep unused cathodes from fouling.
const STACK = ['1', '6', '2', '7', '5', '0', '4', '9', '8', '3'] // front to back, as in an IN-14

const pad = (n) => String(n).padStart(2, '0')

function Tube({ ch, color, cycle, id }) {
  const [shown, setShown] = useState(ch)
  const [strike, setStrike] = useState(0)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    let alive = true
    const timers = []
    if (cycle && ch !== ' ') {
      STACK.forEach((d, i) => timers.push(setTimeout(() => alive && setShown(d), i * 38)))
      timers.push(setTimeout(() => alive && (setShown(ch), setStrike((s) => s + 1)), STACK.length * 38))
    } else {
      setShown(ch)
      setStrike((s) => s + 1)
    }
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
  }, [ch, cycle])

  const stack = STACK.includes(shown) || shown === ' ' ? STACK : [...STACK, shown]
  const litIdx = stack.indexOf(shown)
  const glyph = (d, extra) => (
    <text x="50" y="118" textAnchor="middle" fontSize="112" fontFamily="'Century Gothic', 'Avenir Next', Futura, 'Trebuchet MS', sans-serif" fontWeight="400" fill="none" strokeLinejoin="round" {...extra}>
      {d}
    </text>
  )
  return (
    <svg viewBox="0 0 100 190" style={{ width: '1em', height: '1.9em', overflow: 'visible' }} aria-hidden="true">
      {/* the glass envelope */}
      <rect x="4" y="2" width="92" height="160" rx="40" fill={`url(#glass-${id})`} stroke="rgba(255,255,255,.18)" strokeWidth="1.2" />
      {/* the unlit cathodes, back to front, behind the lit one */}
      {stack.map((d, i) => (i > litIdx ? <g key={d}>{glyph(d, { stroke: '#7c6b5e', strokeWidth: 2.2, opacity: 0.2 + (stack.length - i) * 0.015 })}</g> : null))}
      {litIdx >= 0 && (
        <g key={`${shown}-${strike}`} style={{ animation: 'rd-nx-strike 260ms steps(1) both' }}>
          {glyph(shown, { stroke: color, strokeWidth: 14, opacity: 0.6, filter: `url(#halo-${id})` })}
          {glyph(shown, { stroke: color, strokeWidth: 5.5, filter: `url(#core-${id})` })}
          {glyph(shown, { stroke: '#ffe3b8', strokeWidth: 1.6 })}
        </g>
      )}
      {/* the cathodes stacked in front of the lit one cross over it */}
      {stack.map((d, i) => (i < litIdx ? <g key={d}>{glyph(d, { stroke: '#8a7766', strokeWidth: 2.2, opacity: 0.3 })}</g> : null))}
      {/* anode mesh */}
      <rect x="8" y="8" width="84" height="148" rx="36" fill={`url(#mesh-${id})`} opacity="0.55" />
      {/* reflections on the glass */}
      <path d="M18 30 Q14 80 18 140" stroke="rgba(255,255,255,.28)" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M80 26 Q84 50 82 70" stroke="rgba(255,255,255,.12)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* base and pins */}
      <rect x="10" y="156" width="80" height="18" rx="4" fill="#1a1716" />
      <rect x="10" y="156" width="80" height="4" fill="#2c2724" />
      {[22, 36, 50, 64, 78].map((x) => (
        <rect key={x} x={x - 1.2} y="174" width="2.4" height="14" fill="#a8a29a" />
      ))}
    </svg>
  )
}

export default function NixieTubes({
  mode = 'clock',
  text = '2026',
  color = '#ff7a1f',
  cycle = true,
  flicker = true,
  style,
}) {
  const id = useId().replace(/:/g, '')
  const [now, setNow] = useState(() => Date.now())
  const [count, setCount] = useState(0)
  const glow = useRef()

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    const c = mode === 'counter' ? setInterval(() => setCount((n) => n + 1), 900) : 0
    return () => {
      clearInterval(t)
      clearInterval(c)
    }
  }, [mode])

  // neon never burns perfectly steady: a faint shimmer on the whole display
  useEffect(() => {
    if (!flicker) return
    let raf = 0
    const frame = (t) => {
      const v = 0.94 + 0.04 * Math.sin(t / 37) + 0.03 * Math.sin(t / 13.3) + (Math.random() < 0.006 ? -0.25 : 0)
      if (glow.current) glow.current.style.opacity = v.toFixed(3)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      if (glow.current) glow.current.style.opacity = '1'
    }
  }, [flicker])

  let chars
  let sep = new Set()
  const d = new Date(now)
  if (mode === 'clock') {
    chars = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    sep = new Set([1, 3])
  } else if (mode === 'counter') {
    chars = String(count).padStart(6, '0').slice(-6)
  } else {
    chars = String(text).slice(0, 10) || ' '
  }
  const blink = mode === 'clock' ? d.getMilliseconds() < 500 : true

  return (
    <div
      role="timer"
      aria-label={mode === 'text' ? text : chars}
      style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '0.08em', padding: '0.3em 0.36em 0.2em', borderRadius: '0.12em', background: 'linear-gradient(#2a211c, #17110e)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 0.1em 0.35em rgba(0,0,0,.35)', ...style }}
    >
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={`glass-${id}`} cx="50%" cy="40%" r="70%">
            <stop offset="0" stopColor="#3a2a22" stopOpacity=".55" />
            <stop offset="1" stopColor="#0d0907" stopOpacity=".9" />
          </radialGradient>
          <pattern id={`mesh-${id}`} width="6" height="10.4" patternUnits="userSpaceOnUse">
            <path d="M3 0 L6 1.7 L6 5.2 L3 6.9 L0 5.2 L0 1.7 Z M0 5.2 L0 10.4 M6 5.2 L6 10.4" fill="none" stroke="#2b2420" strokeWidth="0.6" />
          </pattern>
          <filter id={`halo-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id={`core-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <style>{'@keyframes rd-nx-strike { 0% { opacity: .2 } 18% { opacity: .9 } 30% { opacity: .45 } 46% { opacity: 1 } 100% { opacity: 1 } }'}</style>
      <span ref={glow} style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '0.08em' }}>
        {[...chars].map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Tube ch={c} color={color} cycle={cycle} id={id} />
            {sep.has(i) && (
              // a small neon lamp for the colon
              <svg viewBox="0 0 30 190" style={{ width: '0.3em', height: '1.9em' }} aria-hidden="true">
                {[62, 108].map((y) => (
                  <g key={y}>
                    <circle cx="15" cy={y} r="7" fill="#2a1d16" stroke="rgba(255,255,255,.15)" />
                    {blink && <circle cx="15" cy={y} r="4" fill={color} filter={`url(#core-${id})`} />}
                    {blink && <circle cx="15" cy={y} r="9" fill={color} opacity=".25" filter={`url(#halo-${id})`} />}
                  </g>
                ))}
              </svg>
            )}
          </span>
        ))}
      </span>
    </div>
  )
}
