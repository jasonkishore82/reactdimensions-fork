import { useEffect, useId, useRef } from 'react'

// Letterpress: type pressed into thick cotton paper. The platen comes down
// when it mounts and the letters bite into the sheet. The dent is lit like
// a real surface (a height map under a low light), so the top inside edge of
// each letter falls into shadow, the bottom edge catches the light, and the
// paper just round each letter slopes visibly down into it. The paper has a
// fibrous tooth from a noise filter.
export default function LetterpressText({
  text = 'Pressed',
  ink = '#2b3a67',
  paper = '#f4efe4',
  depth = 1,
  trigger = 'mount',
  style,
}) {
  const id = useId().replace(/:/g, '')
  const off = useRef()
  const svg = useRef()
  const raf = useRef(0)

  const press = () => {
    cancelAnimationFrame(raf.current)
    let t0 = 0
    const frame = (now) => {
      t0 ||= now
      const t = Math.min(1, (now - t0) / 700)
      // squeeze in fast, ease off a touch as the platen lifts
      const p = t < 0.55 ? 1 - (1 - t / 0.55) ** 3 : 1 - 0.12 * Math.sin(((t - 0.55) / 0.45) * Math.PI) * (1 - t)
      off.current?.setAttribute('surfaceScale', (-6 * depth * p).toFixed(2))
      if (svg.current) svg.current.style.opacity = String(Math.min(1, t * 4))
      if (t < 1) raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
  }

  useEffect(() => {
    if (trigger === 'mount') press()
    else off.current?.setAttribute('surfaceScale', -6 * depth)
    return () => cancelAnimationFrame(raf.current)
  }, [text, depth, trigger])

  return (
    <div
      onPointerEnter={trigger === 'hover' ? press : undefined}
      style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: paper, overflow: 'hidden', ...style }}
    >
      {/* paper tooth */}
      <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5, mixBlendMode: 'multiply' }}>
        <filter id={`tooth-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="4" />
          <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0 0.42  0 0 0 -0.9 0.62" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#tooth-${id})`} />
      </svg>
      <svg ref={svg} viewBox="0 0 1000 300" role="img" aria-label={text} style={{ position: 'relative', width: 'min(92%, 900px)', height: 'auto', overflow: 'visible', opacity: 0 }}>
        <defs>
          <filter id={`press-${id}`} x="-10%" y="-30%" width="120%" height="160%" colorInterpolationFilters="sRGB">
            {/* the impression as a height map: the letters are a recess, and
                the paper just round them slopes down into it */}
            <feGaussianBlur in="SourceAlpha" stdDeviation={1.2 + depth} result="h" />
            <feDiffuseLighting ref={off} in="h" surfaceScale="0" diffuseConstant="1" lightingColor="#fff" result="light">
              <feDistantLight azimuth="235" elevation="50" />
            </feDiffuseLighting>
            {/* the dented paper ring round each letter, lit */}
            <feMorphology in="SourceAlpha" operator="dilate" radius={2 + depth * 3} result="wide" />
            <feFlood floodColor={paper} result="paperC" />
            <feComposite in="paperC" in2="wide" operator="in" result="ring" />
            <feComposite in="ring" in2="light" operator="arithmetic" k1="1.3" k2="0" k3="0" k4="0" result="ringLit" />
            {/* the ink, lit the same way (1.3 undoes the light's elevation,
                so flat paper keeps its true colour) */}
            <feComposite in="SourceGraphic" in2="light" operator="arithmetic" k1="1.3" k2="0" k3="0" k4="0" result="inkLit" />
            <feComposite in="inkLit" in2="SourceAlpha" operator="in" result="ink" />
            {/* ink soaks unevenly into the fibres */}
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="9" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.22 0" result="mottle" />
            <feComposite in="mottle" in2="SourceAlpha" operator="in" result="mottleIn" />
            <feMerge>
              <feMergeNode in="ringLit" />
              <feMergeNode in="ink" />
              <feMergeNode in="mottleIn" />
            </feMerge>
          </filter>
        </defs>
        <text x="500" y="200" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="200" fontWeight="700" fill={ink} filter={`url(#press-${id})`}>
          {text}
        </text>
      </svg>
    </div>
  )
}
