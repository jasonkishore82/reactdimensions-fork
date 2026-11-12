import { useEffect, useRef, useState } from 'react'

// Tap ripple: pressing the surface starts a ripple at the exact pointer
// position. It grows until it covers the farthest corner, stays while you keep
// pressing, and fades out once you let go (or slide off). Each press gets its
// own ripple, so quick taps layer up. Enter or Space ripple from the centre.
// Under reduced motion the ripple appears at full size and simply fades.

export default function TapRipple({
  label = 'Press anywhere',
  caption = 'TAP · CLICK · ENTER',
  width = 280,
  height = 140,
  radius = 18,
  color = '#1c1a16',
  textColor = '#f4f1ea',
  rippleColor = '#ff4d1a',
  rippleOpacity = 0.4,
  grow = 520,
  fade = 420,
  accent = '#ff4d1a',
  onPress,
  style,
}) {
  const [ripples, setRipples] = useState([])
  const el = useRef(null)
  const active = useRef(new Map()) // pointer id (or 'key') -> ripple id
  const timers = useRef(new Set())
  const uid = useRef(0)

  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear() }, [])

  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.current.delete(t); fn() }, ms)
    timers.current.add(t)
  }

  const end = (key) => {
    const id = active.current.get(key)
    if (id == null) return
    active.current.delete(key)
    const now = performance.now()
    // let a very quick tap grow most of the way before it starts to fade
    setRipples((rs) => rs.map((r) => (r.id === id ? { ...r, out: true, delay: Math.max(0, grow * 0.45 - (now - r.t)) } : r)))
    later(() => setRipples((rs) => rs.filter((r) => r.id !== id)), grow + fade + 60)
  }

  const start = (key, x, y) => {
    const box = el.current.getBoundingClientRect()
    const R = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y))
    end(key)
    const id = ++uid.current
    active.current.set(key, id)
    setRipples((rs) => [...rs, { id, x, y, R, t: performance.now(), out: false, delay: 0 }])
  }

  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const box = el.current.getBoundingClientRect()
    start(e.pointerId, e.clientX - box.left, e.clientY - box.top)
  }
  const up = (e) => end(e.pointerId)

  const keyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      const box = el.current.getBoundingClientRect()
      start('key', box.width / 2, box.height / 2)
    }
  }
  const keyUp = (e) => { if (e.key === 'Enter' || e.key === ' ') end('key') }

  return (
    <button
      ref={el}
      type="button"
      className="trp"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onKeyDown={keyDown}
      onKeyUp={keyUp}
      onBlur={() => end('key')}
      onContextMenu={(e) => e.preventDefault()}
      onClick={onPress}
      style={{ width, height, borderRadius: radius, background: color, color: textColor, ...style }}
    >
      <style>{`
        .trp { position: relative; display: grid; place-items: center; align-content: center; gap: 8px; padding: 0; border: 0; overflow: hidden; isolation: isolate; cursor: pointer; outline: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: transform 260ms cubic-bezier(.34,1.56,.64,1), box-shadow 260ms; box-shadow: 0 10px 24px -14px rgba(20,18,14,.6); }
        .trp:active { transform: scale(.985); }
        .trp:focus-visible { box-shadow: 0 0 0 3px #f4f1ea, 0 0 0 6px ${accent}; }
        .trp-r { position: absolute; border-radius: 50%; pointer-events: none; z-index: 0; animation: trp-grow var(--grow) cubic-bezier(.2,.8,.2,1) forwards; }
        .trp-t { position: relative; z-index: 1; font: 600 20px/1.1 system-ui, sans-serif; letter-spacing: -.01em; }
        .trp-c { position: relative; z-index: 1; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; opacity: .55; }
        @keyframes trp-grow { from { transform: scale(.04) } to { transform: scale(1) } }
        @media (prefers-reduced-motion: reduce) { .trp, .trp:active { transition: none; transform: none; } .trp-r { animation: none; } }
      `}</style>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="trp-r"
          aria-hidden="true"
          style={{
            left: r.x - r.R,
            top: r.y - r.R,
            width: r.R * 2,
            height: r.R * 2,
            background: rippleColor,
            opacity: r.out ? 0 : rippleOpacity,
            transition: `opacity ${fade}ms ease-out ${r.delay}ms`,
            '--grow': `${grow}ms`,
          }}
        />
      ))}
      <span className="trp-t">{label}</span>
      {caption && <span className="trp-c">{caption}</span>}
    </button>
  )
}
