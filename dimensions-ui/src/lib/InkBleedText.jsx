import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

// Text that soaks into the page like drops of ink on paper. Drops land along
// the line one after another and wick outward through the fibres. Spreading
// by capillary action slows as it goes (Washburn: the radius grows with the
// square root of time), and the edge is ragged because paper fibres are
// uneven, which a turbulence displacement on the mask stands in for.
export default function InkBleedText({
  text = 'Ink on paper',
  color = '#1d2b4f',
  drops = 12,
  stagger = 130,
  soak = 1600,
  roughness = 0.25,
  trigger = 'mount',
  style,
}) {
  const id = useId().replace(/:/g, '')
  const textRef = useRef()
  const circles = useRef([])
  const raf = useRef(0)
  const [box, setBox] = useState(null)
  const seeds = useRef([])

  // measure the text so the svg fits it exactly
  useLayoutEffect(() => {
    const b = textRef.current?.getBBox()
    if (b) setBox({ x: b.x, y: b.y, w: b.width, h: b.height })
  }, [text, style?.font, style?.fontSize])

  const play = () => {
    cancelAnimationFrame(raf.current)
    if (!box) return
    const n = Math.max(1, Math.round(drops))
    // drops land roughly left to right, a little out of order and off-centre
    const order = [...Array(n).keys()].map((k) => [k, k + Math.random() * 2.2]).sort((a, b) => a[1] - b[1]).map((a) => a[0])
    seeds.current = order.map((k, i) => ({
      x: box.x + ((k + 0.5) / n) * box.w + (Math.random() - 0.5) * (box.w / n) * 0.5,
      y: box.y + box.h * (0.4 + Math.random() * 0.2),
      start: i * stagger,
      // just big enough that neighbours overlap and cover the full height
      R: Math.max(box.h * 0.62, (box.w / n) * 0.8),
    }))
    let t0 = 0
    const frame = (now) => {
      t0 ||= now
      const t = now - t0
      let busy = false
      seeds.current.forEach((s, i) => {
        const c = circles.current[i]
        if (!c) return
        const u = Math.max(0, (t - s.start) / soak)
        if (u < 1) busy = true
        c.setAttribute('cx', s.x)
        c.setAttribute('cy', s.y)
        c.setAttribute('r', s.R * Math.sqrt(Math.min(1, u)))
      })
      if (busy) raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
  }

  useEffect(() => {
    if (!box) return
    if (trigger === 'mount') play()
    else {
      seeds.current = []
      circles.current.forEach((c) => c?.setAttribute('r', 0))
    }
    return () => cancelAnimationFrame(raf.current)
  }, [box, drops, stagger, soak, trigger])

  const pad = box ? box.h * 0.3 : 0
  const n = Math.max(1, Math.round(drops))
  return (
    <span aria-label={text} onPointerEnter={trigger === 'hover' ? play : undefined} style={{ display: 'inline-block', lineHeight: 0, ...style }}>
      <svg
        aria-hidden="true"
        width={box ? box.w + pad * 2 : 0}
        height={box ? box.h + pad * 2 : 0}
        viewBox={box ? `${box.x - pad} ${box.y - pad} ${box.w + pad * 2} ${box.h + pad * 2}` : '0 0 1 1'}
        style={{ overflow: 'visible', font: 'inherit' }}
      >
        <defs>
          <filter id={`ink-edge-${id}`} x="-20%" y="-50%" width="140%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency={box ? 2.2 / box.h : 0.05} numOctaves="3" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale={box ? box.h * roughness : 0} xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation={box ? box.h * 0.01 : 0} />
          </filter>
          <mask id={`ink-mask-${id}`} maskUnits="userSpaceOnUse" x={box ? box.x - pad : 0} y={box ? box.y - pad : 0} width={box ? box.w + pad * 2 : 1} height={box ? box.h + pad * 2 : 1}>
            <g filter={`url(#ink-edge-${id})`}>
              {[...Array(n)].map((_, i) => (
                <circle key={i} ref={(el) => (circles.current[i] = el)} r="0" fill="#fff" />
              ))}
            </g>
          </mask>
        </defs>
        <text ref={textRef} x="0" y="0" dominantBaseline="text-before-edge" fill={color} mask={box ? `url(#ink-mask-${id})` : undefined} style={{ whiteSpace: 'pre' }}>
          {text}
        </text>
      </svg>
    </span>
  )
}
