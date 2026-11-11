import { useEffect, useRef } from 'react'

// A card that tilts toward the pointer in 3D, with a moving glare.
// Motion runs on a damped spring, so it overshoots slightly and settles.
export default function TiltCard({
  children,
  maxTilt = 14,
  perspective = 900,
  scale = 1.04,
  glare = true,
  glareOpacity = 0.45,
  stiffness = 170,
  damping = 16,
  className = '',
  style,
}) {
  const el = useRef(null)
  const glareEl = useRef(null)
  const s = useRef({ rx: 0, ry: 0, sc: 1, vx: 0, vy: 0, vs: 0, tx: 0, ty: 0, ts: 1, gx: 50, gy: 50, go: 0 })
  const raf = useRef(0)

  useEffect(() => {
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const p = s.current
      p.vx += (-stiffness * (p.rx - p.tx) - damping * p.vx) * dt
      p.vy += (-stiffness * (p.ry - p.ty) - damping * p.vy) * dt
      p.vs += (-stiffness * (p.sc - p.ts) - damping * p.vs) * dt
      p.rx += p.vx * dt
      p.ry += p.vy * dt
      p.sc += p.vs * dt
      if (el.current) {
        el.current.style.transform = `perspective(${perspective}px) rotateX(${p.rx}deg) rotateY(${p.ry}deg) scale(${p.sc})`
      }
      if (glareEl.current) {
        glareEl.current.style.background = `radial-gradient(circle at ${p.gx}% ${p.gy}%, rgba(255,255,255,${glareOpacity * p.go}), transparent 55%)`
      }
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [stiffness, damping, perspective, glareOpacity])

  const onMove = (e) => {
    const r = el.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    const p = s.current
    p.ty = (x - 0.5) * 2 * maxTilt
    p.tx = -(y - 0.5) * 2 * maxTilt
    p.ts = scale
    p.gx = x * 100
    p.gy = y * 100
    p.go = 1
  }
  const onLeave = () => {
    const p = s.current
    p.tx = p.ty = 0
    p.ts = 1
    p.go = 0
  }

  return (
    <div
      ref={el}
      className={className}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ position: 'relative', transformStyle: 'preserve-3d', willChange: 'transform', touchAction: 'none', ...style }}
    >
      {children}
      {glare && (
        <div
          ref={glareEl}
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', mixBlendMode: 'overlay' }}
        />
      )}
    </div>
  )
}
