import { useEffect, useRef } from 'react'

// Gets pulled toward the cursor when it comes within `radius` pixels,
// then springs back. The label moves a little further for parallax.
export default function MagneticButton({
  children,
  strength = 0.4,
  radius = 140,
  stiffness = 160,
  damping = 14,
  className = '',
  style,
}) {
  const el = useRef(null)
  const label = useRef(null)
  const s = useRef({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 })

  useEffect(() => {
    let raf
    let last = performance.now()
    const onMove = (e) => {
      if (!el.current) return
      const r = el.current.getBoundingClientRect()
      const cx = r.left + r.width / 2 - s.current.x
      const cy = r.top + r.height / 2 - s.current.y
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.hypot(dx, dy)
      const reach = radius + Math.max(r.width, r.height) / 2
      const pull = dist < reach ? 1 - dist / reach : 0
      s.current.tx = dx * strength * (0.5 + pull)
      s.current.ty = dy * strength * (0.5 + pull)
      if (!pull) s.current.tx = s.current.ty = 0
    }
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const p = s.current
      p.vx += (-stiffness * (p.x - p.tx) - damping * p.vx) * dt
      p.vy += (-stiffness * (p.y - p.ty) - damping * p.vy) * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (el.current) el.current.style.transform = `translate(${p.x}px, ${p.y}px)`
      if (label.current) label.current.style.transform = `translate(${p.x * 0.35}px, ${p.y * 0.35}px)`
      raf = requestAnimationFrame(step)
    }
    window.addEventListener('pointermove', onMove)
    raf = requestAnimationFrame(step)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [strength, radius, stiffness, damping])

  return (
    <button
      ref={el}
      className={className}
      style={{
        border: '1px solid currentColor',
        borderRadius: 999,
        padding: '22px 36px',
        background: 'transparent',
        color: '#15171a',
        font: '500 16px/1 system-ui, sans-serif',
        cursor: 'pointer',
        willChange: 'transform',
        ...style,
      }}
    >
      <span ref={label} style={{ display: 'inline-block' }}>
        {children}
      </span>
    </button>
  )
}
