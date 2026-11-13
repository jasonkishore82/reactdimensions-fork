import { useEffect, useId, useRef } from 'react'

// Letters cut clean through a dark slab, with a light behind it. Light
// pours through the holes and throws the shapes of the letters onto the
// floor below as glowing, stretched patches. Move the pointer to move the
// light: the projections swing the other way and stretch longer the lower
// the light gets, as real shadows (here, lit shapes) do.
export default function CutoutSlab({
  text = 'LIGHT',
  light = '#ffd27a',
  slab = '#1d1c21',
  room = '#0e0d11',
  style,
}) {
  const id = useId().replace(/:/g, '')
  const proj = useRef()
  const glow = useRef()
  const box = useRef()

  useEffect(() => {
    const el = box.current
    const st = { x: 0.5, y: 0.25, tx: 0.5, ty: 0.25, near: false, t: 0, raf: 0, last: 0 }
    const frame = (now) => {
      st.last ||= now
      const dt = Math.min(0.05, (now - st.last) / 1000)
      st.last = now
      st.t += dt
      if (!st.near) {
        st.tx = 0.5 + 0.35 * Math.sin(st.t * 0.4)
        st.ty = 0.3 + 0.15 * Math.sin(st.t * 0.6)
      }
      const k = 1 - Math.exp(-dt * (st.near ? 6 : 1.5))
      st.x += (st.tx - st.x) * k
      st.y += (st.ty - st.y) * k
      // light behind and above: the patches land below the slab, sheared
      // away from the light and stretched more as it drops
      const shear = (0.5 - st.x) * 1.4
      const stretch = 0.9 + (1 - st.y) * 1.3
      // map each letter from the slab (tops at y 110) onto the floor below
      // the slab's foot (y 262), sheared away from the light and stretched
      proj.current?.setAttribute('transform', `translate(500 268) matrix(1 0 ${shear.toFixed(3)} ${stretch.toFixed(3)} 0 0) translate(-500 -110)`)
      glow.current?.setAttribute('cx', (st.x * 1000).toFixed(1))
      glow.current?.setAttribute('cy', (60 + st.y * 200).toFixed(1))
      st.raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      st.near = x >= 0 && x <= 1 && y >= 0 && y <= 1
      if (st.near) {
        st.tx = x
        st.ty = Math.min(0.6, y)
      }
    }
    st.raf = requestAnimationFrame(frame)
    window.addEventListener('pointermove', move)
    return () => {
      cancelAnimationFrame(st.raf)
      window.removeEventListener('pointermove', move)
    }
  }, [])

  const letters = (
    <text x="500" y="215" textAnchor="middle" fontFamily="'Helvetica Neue', Arial, sans-serif" fontWeight="900" fontSize="150" letterSpacing="8">
      {text}
    </text>
  )
  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', background: room, overflow: 'hidden', ...style }}>
      <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
        <defs>
          <radialGradient id={`lamp-${id}`}>
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.3" stopColor={light} />
            <stop offset="1" stopColor={light} stopOpacity="0.25" />
          </radialGradient>
          <clipPath id={`behind-${id}`}>
            <rect x="-1000" y="60" width="3000" height="202" />
          </clipPath>
          <mask id={`holes-${id}`} maskUnits="userSpaceOnUse" x="-1000" y="0" width="3000" height="600">
            <rect x="-1000" y="60" width="3000" height="202" fill="#fff" />
            <g fill="#000">{letters}</g>
          </mask>
          <filter id={`soft-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <linearGradient id={`fade-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={light} stopOpacity="0.95" />
            <stop offset="1" stopColor={light} stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {/* the floor */}
        <rect x="-1000" y="262" width="3000" height="600" fill="#17161c" />
        {/* light through the holes, thrown onto the floor */}
        <g ref={proj} filter={`url(#soft-${id})`} fill={`url(#fade-${id})`} style={{ mixBlendMode: 'screen' }}>
          {letters}
        </g>
        {/* the lamp behind the slab, seen through the holes */}
        {/* the wall behind, lit by the lamp; only seen through the holes */}
        <g clipPath={`url(#behind-${id})`}>
          <rect x="-1000" y="60" width="3000" height="202" fill="#3a2f1c" />
          <circle ref={glow} cx="500" cy="120" r="560" fill={`url(#lamp-${id})`} />
        </g>
        {/* the slab, with the letters cut out of it */}
        <rect x="-1000" y="60" width="3000" height="202" fill={slab} mask={`url(#holes-${id})`} />
        {/* the slab's lit top edge and its foot on the floor */}
        <rect x="-1000" y="58" width="3000" height="3" fill="#3a3940" />
        <rect x="-1000" y="258" width="3000" height="6" fill="#2c2b31" />
      </svg>
    </div>
  )
}
