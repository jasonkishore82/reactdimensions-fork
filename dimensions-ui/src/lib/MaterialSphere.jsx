import { useEffect, useRef } from 'react'

// A pure-CSS shaded sphere. With `followLight`, the highlight tracks the
// cursor, as if a lamp were moving around it.
const MATERIALS = {
  chrome: ['#ffffff', '#cfd3d8', '#6c7177', '#e9ecef', '#3f4348'],
  gold: ['#fff6d8', '#f2c66d', '#b07a2c', '#f0cf86', '#6e4614'],
  copper: ['#ffe6d6', '#e8946a', '#9b4a26', '#e9a37c', '#4f200c'],
  ink: ['#9aa0a8', '#2a2c30', '#0e0f11', '#26282c', '#34373c'],
  signal: ['#fff0e8', '#ff8a5c', '#ff4d1a', '#c63a10', '#5a1604'],
}

export default function MaterialSphere({ material = 'chrome', size = 160, followLight = true, float = true, style }) {
  const el = useRef(null)
  const light = useRef({ x: 32, y: 28, tx: 32, ty: 28 })

  useEffect(() => {
    if (!followLight) return
    let raf
    const onMove = (e) => {
      const r = el.current?.getBoundingClientRect()
      if (!r) return
      const x = ((e.clientX - r.left) / r.width) * 100
      const y = ((e.clientY - r.top) / r.height) * 100
      light.current.tx = Math.max(10, Math.min(90, 50 + (x - 50) * 0.4))
      light.current.ty = Math.max(10, Math.min(90, 50 + (y - 50) * 0.4))
    }
    const step = () => {
      const l = light.current
      l.x += (l.tx - l.x) * 0.12
      l.y += (l.ty - l.y) * 0.12
      el.current?.style.setProperty('--lx', `${l.x}%`)
      el.current?.style.setProperty('--ly', `${l.y}%`)
      raf = requestAnimationFrame(step)
    }
    window.addEventListener('pointermove', onMove)
    raf = requestAnimationFrame(step)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [followLight])

  const [hi, a, b, c, d] = MATERIALS[material] || MATERIALS.chrome
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: size * 0.12, ...style }}>
      <style>{`@keyframes ms-float { 50% { transform: translateY(-8%); } }`}</style>
      <div
        ref={el}
        style={{
          '--lx': '32%',
          '--ly': '28%',
          width: size,
          height: size,
          borderRadius: '50%',
          background: `radial-gradient(circle at var(--lx) var(--ly), ${hi} 0 6%, ${a} 18%, ${b} 52%, ${c} 76%, ${d} 100%)`,
          animation: float ? 'ms-float 4s ease-in-out infinite' : 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          width: size * 0.8,
          height: size * 0.12,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(21,23,26,0.45), transparent)',
          animation: float ? 'ms-shadow 4s ease-in-out infinite' : 'none',
        }}
      />
      <style>{`@keyframes ms-shadow { 50% { transform: scale(0.8); opacity: 0.6; } }`}</style>
    </div>
  )
}
