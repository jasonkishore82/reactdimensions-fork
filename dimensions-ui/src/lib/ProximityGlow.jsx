import { useEffect, useRef } from 'react'

// Proximity glow: card borders light up where the pointer is near them, with
// the glow fading out over `radius` pixels, even from outside a card. Each
// card tracks the pointer relative to itself, so neighbouring borders share
// the light. Static (no glow) under reduced motion.

const ITEMS = [
  ['Orbit', 'Drag to spin the model'],
  ['Inspect', 'Tap a part to isolate it'],
  ['Compare', 'Slide between two presets'],
  ['Assemble', 'Scroll to build it up'],
  ['Annotate', 'Hotspots open notes'],
  ['Replay', 'Record and play back'],
]

export default function ProximityGlow({
  radius = 180,
  color = '#ff4d1a',
  borderWidth = 2,
  columns = 3,
  dark = true,
  style,
}) {
  const wrap = useRef(null)
  const cards = useRef([])
  const pos = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const tick = () => {
      const { x, y } = pos.current
      cards.current.forEach((el) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        el.style.setProperty('--gx', `${x - r.left}px`)
        el.style.setProperty('--gy', `${y - r.top}px`)
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const move = (e) => { pos.current = { x: e.clientX, y: e.clientY } }
  const leave = () => { pos.current = { x: -9999, y: -9999 } }

  const bg = dark ? '#16151a' : '#f4f1ea'
  const card = dark ? '#1f1e25' : '#ffffff'
  const ink = dark ? '#f4f1ea' : '#1c1a16'
  const base = dark ? '#2e2c36' : '#dcd6ca'

  return (
    <div
      ref={wrap}
      className="pg"
      onPointerMove={move}
      onPointerDown={move}
      onPointerLeave={leave}
      style={{ width: '100%', height: '100%', background: bg, padding: 24, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 14, alignContent: 'center', ...style }}
    >
      <style>{`
        .pg-card { position: relative; border-radius: 14px; padding: ${borderWidth}px; background: ${base}; isolation: isolate; }
        .pg-card::before { content: ''; position: absolute; inset: 0; border-radius: inherit; z-index: -1;
          background: radial-gradient(${radius}px circle at var(--gx, -999px) var(--gy, -999px), ${color}, transparent 70%); }
        .pg-in { border-radius: ${14 - borderWidth}px; background: ${card}; padding: 16px 16px 18px; height: 100%; box-sizing: border-box; }
        .pg-in b { display: block; font: 600 15px/1.2 system-ui, sans-serif; color: ${ink}; margin-bottom: 6px; }
        .pg-in span { font: 400 12px/1.4 system-ui, sans-serif; color: ${ink}; opacity: .6; }
      `}</style>
      {ITEMS.map(([t, d], i) => (
        <div key={t} className="pg-card" ref={(el) => (cards.current[i] = el)}>
          <div className="pg-in"><b>{t}</b><span>{d}</span></div>
        </div>
      ))}
    </div>
  )
}
