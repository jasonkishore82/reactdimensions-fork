import { useEffect, useRef, useState } from 'react'

// Tilt-to-reveal: the card tilts toward the pointer on a spring, and a hidden
// layer shows through from the side that lifts away, more the further it
// tilts. Click (or tap, or press Enter) to open it fully; click again to
// close. Drag on touch. Under reduced motion it reveals without tilting.

export default function TiltReveal({
  maxTilt = 16,
  front = '#1d2b4f',
  hidden = '#ff4d1a',
  title = 'Tilt me',
  secret = 'Hello, you found it',
  stiffness = 170,
  damping = 16,
  style,
}) {
  const card = useRef(null)
  const reveal = useRef(null)
  const s = useRef({ rx: 0, ry: 0, vx: 0, vy: 0, tx: 0, ty: 0, full: 0 })
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  openRef.current = open
  const downAt = useRef(null)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const p = s.current
      p.vx += (-stiffness * (p.rx - p.tx) - damping * p.vx) * dt
      p.vy += (-stiffness * (p.ry - p.ty) - damping * p.vy) * dt
      p.rx += p.vx * dt
      p.ry += p.vy * dt
      if (card.current) card.current.style.transform = reduce ? 'none' : `perspective(900px) rotateX(${p.rx}deg) rotateY(${p.ry}deg)`
      if (reveal.current) {
        // the reveal opens from the edge that tilts away from the viewer
        const k = Math.min(1, Math.hypot(p.rx, p.ry) / maxTilt)
        const cx = 50 - (p.ry / maxTilt) * 50
        const cy = 50 + (p.rx / maxTilt) * 50
        // clicked open: ease the circle out past the far corner (150% covers it)
        const target = openRef.current ? 1 : 0
        p.full = reduce ? target : p.full + (target - p.full) * (1 - Math.exp(-dt / 0.16))
        const r = Math.max(k * 95, p.full * 150)
        reveal.current.style.clipPath = `circle(${r}% at ${cx}% ${cy}%)`
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [stiffness, damping, maxTilt])

  const onMove = (e) => {
    if (e.pointerType !== 'mouse' && !e.buttons) return
    const r = card.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    s.current.ty = Math.max(-1, Math.min(1, x * 2)) * maxTilt
    s.current.tx = -Math.max(-1, Math.min(1, y * 2)) * maxTilt
  }
  const reset = () => { s.current.tx = 0; s.current.ty = 0 }

  return (
    <div
      ref={card}
      onPointerMove={onMove}
      role="button"
      tabIndex={0}
      aria-pressed={open}
      aria-label={open ? `${secret}. Click to hide.` : `${title}. Click to reveal.`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); downAt.current = [e.clientX, e.clientY] }}
      onClick={(e) => {
        // a drag to tilt on touch is not a click
        const d = downAt.current
        if (d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 6) return
        setOpen((o) => !o)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}
      onPointerUp={reset}
      onPointerLeave={reset}
      style={{ position: 'relative', width: 260, height: 340, borderRadius: 18, overflow: 'hidden', touchAction: 'none', willChange: 'transform', cursor: 'pointer', outlineOffset: 4, ...style }}
    >
      <div style={{ position: 'absolute', inset: 0, background: front, color: '#f4f1ea', padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <span style={{ font: '500 10px/1 ui-monospace, Menlo, monospace', letterSpacing: '.14em', opacity: 0.6 }}>LAYER 01</span>
        <span style={{ font: '400 50px/.95 Georgia, serif' }}>{title}</span>
        <span style={{ font: '500 10px/1 ui-monospace, Menlo, monospace', letterSpacing: '.14em', opacity: 0.6 }}>TILT OR CLICK TO REVEAL</span>
      </div>
      <div
        ref={reveal}
        style={{ position: 'absolute', inset: 0, background: hidden, color: '#1c1a16', padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', clipPath: 'circle(0% at 50% 50%)' }}
      >
        <span style={{ font: '500 10px/1 ui-monospace, Menlo, monospace', letterSpacing: '.14em', opacity: 0.6 }}>LAYER 02</span>
        <span style={{ font: '400 40px/1 Georgia, serif' }}>{secret}</span>
        <span style={{ font: '500 10px/1 ui-monospace, Menlo, monospace', letterSpacing: '.14em', opacity: 0.6 }}>CLICK TO HIDE</span>
      </div>
    </div>
  )
}
