import { useEffect, useRef, useState } from 'react'

// A scrolling ticker of live numbers. Each price moves by a random walk
// scaled to its own volatility (geometric Brownian motion, the textbook
// model for a price), and every tick flashes green when it rises or red when
// it falls. The tape scrolls steadily and pauses while you hover it.
const SYMBOLS = [
  ['RDIM', 182.4, 0.9],
  ['SPRG', 64.12, 1.6],
  ['ORBT', 311.05, 0.7],
  ['LENS', 18.77, 2.4],
  ['GRVT', 97.3, 1.1],
  ['FRCT', 42.86, 1.9],
  ['MASS', 251.6, 0.6],
  ['TILT', 8.42, 3.1],
]

export default function TickerTape({
  speed = 60,
  rate = 1.4,
  up = '#1fbf75',
  down = '#ef4c4c',
  background = '#0f1115',
  style,
}) {
  const [rows, setRows] = useState(() => SYMBOLS.map(([s, p, vol]) => ({ s, p, open: p, vol, dir: 0, n: 0 })))
  const track = useRef()
  const paused = useRef(false)

  // price ticks: a random handful of symbols move each beat
  useEffect(() => {
    const id = setInterval(() => {
      setRows((rs) =>
        rs.map((r) => {
          if (Math.random() > 0.35) return { ...r, dir: 0 }
          // a normal sample from two uniforms (Box-Muller)
          const z = Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random())
          const p = Math.max(0.01, r.p * Math.exp((r.vol / 100) * z))
          return { ...r, p, dir: Math.sign(p - r.p), n: r.n + 1 }
        }),
      )
    }, 1000 / rate)
    return () => clearInterval(id)
  }, [rate])

  useEffect(() => {
    const el = track.current
    let x = 0
    let raf = 0
    let last = 0
    const frame = (now) => {
      last ||= now
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!paused.current) {
        const half = el.scrollWidth / 2
        x = (x + speed * dt) % half
        el.style.transform = `translate3d(${-x.toFixed(2)}px,0,0)`
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [speed])

  const item = (r, copy) => {
    const ch = ((r.p - r.open) / r.open) * 100
    const col = ch >= 0 ? up : down
    return (
      <span key={`${copy}-${r.s}`} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.5em', padding: '0 1.4em', borderRight: '1px solid rgba(255,255,255,.08)' }}>
        <b style={{ color: '#e8eaee', fontWeight: 700 }}>{r.s}</b>
        <span
          key={r.n}
          style={{
            color: '#e8eaee',
            padding: '0.1em 0.3em',
            borderRadius: 4,
            animation: r.dir ? `${r.dir > 0 ? 'rd-tk-up' : 'rd-tk-down'} .9s ease-out` : 'none',
          }}
        >
          {r.p.toFixed(2)}
        </span>
        <span style={{ color: col }}>
          {ch >= 0 ? '▲' : '▼'} {Math.abs(ch).toFixed(2)}%
        </span>
      </span>
    )
  }

  return (
    <div
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
      role="marquee"
      aria-label="Stock ticker"
      style={{ width: '100%', overflow: 'hidden', background, padding: '0.7em 0', font: '500 15px/1 ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums', borderTop: '1px solid rgba(255,255,255,.06)', borderBottom: '1px solid rgba(255,255,255,.06)', ...style }}
    >
      <style>{`@keyframes rd-tk-up { from { background: ${up}; color: #fff } } @keyframes rd-tk-down { from { background: ${down}; color: #fff } }`}</style>
      <div ref={track} style={{ display: 'inline-flex', whiteSpace: 'nowrap', willChange: 'transform' }}>
        {rows.map((r) => item(r, 'a'))}
        {rows.map((r) => item(r, 'b'))}
      </div>
    </div>
  )
}
