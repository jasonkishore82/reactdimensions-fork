import { useEffect, useRef } from 'react'

// A button that physically presses in: it sinks on press and springs
// back with a little overshoot when released. Its shadow tracks the depth.
export default function SpringButton({
  children,
  depth = 6,
  stiffness = 420,
  damping = 14,
  color = '#15171a',
  textColor = '#efece4',
  onClick,
  style,
}) {
  const el = useRef(null)
  const s = useRef({ x: 0, v: 0, target: 0 })
  const raf = useRef(0)

  useEffect(() => {
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const p = s.current
      p.v += (-stiffness * (p.x - p.target) - damping * p.v) * dt
      p.x += p.v * dt
      const d = p.x * depth
      if (el.current) {
        el.current.style.transform = `translateY(${d}px) scale(${1 - p.x * 0.03})`
        const lift = Math.max(depth - d, 0)
        el.current.style.boxShadow = `0 ${lift}px 0 0 rgba(0,0,0,0.35), 0 ${lift * 2 + 4}px ${lift * 3 + 6}px -4px rgba(0,0,0,0.35)`
      }
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [depth, stiffness, damping])

  const press = (on) => () => (s.current.target = on ? 1 : 0)

  return (
    <button
      ref={el}
      onPointerDown={press(true)}
      onPointerUp={press(false)}
      onPointerLeave={press(false)}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && press(true)()}
      onKeyUp={press(false)}
      onClick={onClick}
      style={{
        border: 0,
        borderRadius: 14,
        padding: '18px 30px',
        background: color,
        color: textColor,
        font: '600 16px/1 system-ui, sans-serif',
        letterSpacing: '0.02em',
        cursor: 'pointer',
        touchAction: 'manipulation',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
