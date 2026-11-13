import { useEffect, useId, useRef } from 'react'

// Letters that melt like wax: drips run down from their bottoms, the strokes
// sag and stretch, and the whole word slumps; then it pulls itself back up
// into shape. A "goo" filter (blur, then a hard threshold on alpha) makes the
// drips merge with the letters as liquid would, and vertical noise
// displacement gives the runs their uneven lengths.
export default function MeltText({
  text = 'Melting',
  color = '#ff4d1a',
  cycle = 4.5,
  amount = 1,
  style,
}) {
  const id = useId().replace(/:/g, '')
  const disp = useRef()
  const spans = useRef([])
  const drips = useRef([])

  useEffect(() => {
    let raf = 0
    let t0 = 0
    const frame = (now) => {
      t0 ||= now
      const t = ((now - t0) / 1000) % cycle
      // melt for 40% of the cycle, hold, then reform quickly
      const p = t < cycle * 0.4 ? t / (cycle * 0.4) : t < cycle * 0.6 ? 1 : Math.max(0, 1 - (t - cycle * 0.6) / (cycle * 0.25))
      const m = p * p * (3 - 2 * p) * amount
      disp.current?.setAttribute('scale', (m * 60).toFixed(2))
      spans.current.forEach((s, i) => {
        if (!s) return
        const lag = 0.6 + 0.4 * Math.sin(i * 2.3)
        s.style.transform = `scaleY(${(1 + m * 0.5 * lag).toFixed(3)}) translateY(${(m * 0.05 * lag).toFixed(3)}em)`
      })
      drips.current.forEach((d, i) => {
        if (!d) return
        const len = m * (0.35 + 0.9 * Math.abs(Math.sin(i * 7.1)))
        d.style.height = `${len.toFixed(3)}em`
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [text, cycle, amount])

  const chars = [...String(text)]
  return (
    <span aria-label={text} role="img" style={{ display: 'inline-block', position: 'relative', padding: '0.1em 0.1em 0.9em', ...style }}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id={`melt-${id}`} x="-10%" y="-10%" width="120%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.004" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap ref={disp} in="SourceGraphic" in2="n" scale="0" xChannelSelector="A" yChannelSelector="R" result="d" />
          <feGaussianBlur in="d" stdDeviation="4" result="b" />
          <feColorMatrix in="b" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
        </filter>
      </svg>
      <span aria-hidden="true" style={{ display: 'inline-block', color, filter: `url(#melt-${id})`, whiteSpace: 'pre' }}>
        {chars.map((c, i) => (
          <span key={`${i}-${c}`} style={{ position: 'relative', display: 'inline-block' }}>
            <span ref={(n) => (spans.current[i] = n)} style={{ display: 'inline-block', transformOrigin: '50% 15%' }}>
              {c}
            </span>
            {c.trim() && (
              <span
                ref={(n) => (drips.current[i] = n)}
                style={{ position: 'absolute', left: `${30 + ((i * 37) % 40)}%`, top: '78%', width: '0.11em', height: 0, borderRadius: '0 0 0.06em 0.06em', background: color }}
              />
            )}
          </span>
        ))}
      </span>
    </span>
  )
}
