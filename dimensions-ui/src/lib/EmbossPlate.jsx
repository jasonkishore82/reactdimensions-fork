import { useEffect, useId, useRef } from 'react'

// Lettering pressed into a brushed metal plate: the top line is embossed
// (raised), the bottom line debossed (sunk in). The relief is lit by a point
// light that follows the pointer, so highlights and shadows swap sides as you
// move: that's what tells raised from sunk. With nobody pointing, the light
// slowly circles on its own.
//
// The relief is real lighting, not drawn shadows: each line's shape is
// blurred into a height map and lit with SVG's diffuse and specular lighting.
// A negative surface scale turns the same letters into a recess.
export default function EmbossPlate({
  top = 'EMBOSSED',
  bottom = 'debossed',
  metal = '#b9bcc2',
  depth = 4,
  shine = 0.9,
  style,
}) {
  const id = useId().replace(/:/g, '')
  const svg = useRef()
  const lights = useRef([])

  useEffect(() => {
    const el = svg.current
    const st = { x: 0.3, y: 0.2, tx: 0.3, ty: 0.2, near: false, t: 0, raf: 0, last: 0 }
    const frame = (now) => {
      st.last ||= now
      const dt = Math.min(0.05, (now - st.last) / 1000)
      st.last = now
      st.t += dt
      if (!st.near) {
        st.tx = 0.5 + 0.42 * Math.cos(st.t * 0.6)
        st.ty = 0.5 + 0.42 * Math.sin(st.t * 0.6)
      }
      const k = 1 - Math.exp(-dt * (st.near ? 12 : 3))
      st.x += (st.tx - st.x) * k
      st.y += (st.ty - st.y) * k
      // light positions in the svg's own units (viewBox 1000 x 560)
      for (const l of lights.current) {
        if (!l) continue
        l.setAttribute('x', (st.x * 1000).toFixed(1))
        l.setAttribute('y', (st.y * 560).toFixed(1))
      }
      st.raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      st.near = x > -0.1 && x < 1.1 && y > -0.1 && y < 1.1
      if (st.near) {
        st.tx = x
        st.ty = y
      }
    }
    st.raf = requestAnimationFrame(frame)
    window.addEventListener('pointermove', move)
    return () => {
      cancelAnimationFrame(st.raf)
      window.removeEventListener('pointermove', move)
    }
  }, [])

  // one lighting filter; `scale` > 0 raises the letters, < 0 sinks them
  const relief = (name, scale, li) => (
    <filter id={`${name}-${id}`} x="-5%" y="-20%" width="110%" height="140%" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation={depth * 0.9} result="h" />
      <feDiffuseLighting in="h" surfaceScale={scale * depth} diffuseConstant="1" lightingColor="#fff" result="d">
        <fePointLight ref={(n) => (lights.current[li] = n)} x="300" y="100" z="260" />
      </feDiffuseLighting>
      <feSpecularLighting in="h" surfaceScale={scale * depth} specularConstant={shine} specularExponent="22" lightingColor="#fff" result="s">
        <fePointLight ref={(n) => (lights.current[li + 1] = n)} x="300" y="100" z="260" />
      </feSpecularLighting>
      {/* shade the plate colour by the diffuse light, then add the sheen */}
      <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.25" k2="0" k3="0" k4="0" result="lit" />
      <feComposite in="s" in2="SourceAlpha" operator="in" result="sh" />
      <feComposite in="lit" in2="sh" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="all" />
      <feComposite in="all" in2="SourceAlpha" operator="in" />
    </filter>
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#e9e9ea', ...style }}>
      <svg ref={svg} viewBox="0 0 1000 560" role="img" aria-label={`${top} ${bottom}`} style={{ width: 'min(92%, 760px)', height: 'auto', overflow: 'visible', filter: 'drop-shadow(0 18px 30px rgba(0,0,0,.18))' }}>
        <defs>
          {/* brushed metal: noise stretched along x */}
          <filter id={`brush-${id}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.002 0.9" numOctaves="2" seed="3" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.16 0" result="lines" />
            <feComposite in="lines" in2="SourceGraphic" operator="in" result="ln" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="ln" />
            </feMerge>
          </filter>
          <linearGradient id={`sheen-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".35" />
            <stop offset=".45" stopColor="#fff" stopOpacity="0" />
            <stop offset=".7" stopColor="#000" stopOpacity=".08" />
            <stop offset="1" stopColor="#fff" stopOpacity=".15" />
          </linearGradient>
          {relief('emb', 1, 0)}
          {relief('deb', -1, 2)}
          {/* the bevelled edge of the plate */}
          {relief('edge', 1, 4)}
        </defs>
        <rect x="20" y="20" width="960" height="520" rx="34" fill={metal} filter={`url(#edge-${id})`} />
        <rect x="34" y="34" width="932" height="492" rx="26" fill={metal} filter={`url(#brush-${id})`} />
        <rect x="34" y="34" width="932" height="492" rx="26" fill={`url(#sheen-${id})`} />
        {/* screws */}
        {[
          [80, 80],
          [920, 80],
          [80, 480],
          [920, 480],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="15" fill={metal} filter={`url(#emb-${id})`} />
            <path d={`M${x - 8} ${y - 3}l16 6`} stroke="rgba(0,0,0,.45)" strokeWidth="3" strokeLinecap="round" />
          </g>
        ))}
        <text x="500" y="250" textAnchor="middle" fontFamily="'Helvetica Neue', Arial, sans-serif" fontWeight="800" fontSize="132" letterSpacing="6" fill={metal} filter={`url(#emb-${id})`}>
          {top}
        </text>
        <text x="500" y="430" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontSize="118" fill={metal} filter={`url(#deb-${id})`}>
          {bottom}
        </text>
      </svg>
    </div>
  )
}
