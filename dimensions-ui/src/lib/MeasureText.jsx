import { useLayoutEffect, useRef, useState } from 'react'

// Letters rise in one by one, then a dimension line draws underneath
// labelled with the text's rendered width.
export default function MeasureText({
  text = 'Measured.',
  stagger = 45,
  duration = 900,
  color = '#15171a',
  lineColor = '#ff4d1a',
  showDimension = true,
  unit = 'px',
  style,
}) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (ref.current) setWidth(Math.round(ref.current.getBoundingClientRect().width))
  }, [text, style])

  const chars = [...text]
  const total = chars.length * stagger + duration
  const ease = 'cubic-bezier(0.2, 0.7, 0.1, 1)'

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', ...style }}>
      <style>{`
        @keyframes mt-rise { from { opacity: 0; transform: translateY(0.6em) rotate(6deg); filter: blur(6px); } }
        @keyframes mt-draw { from { transform: scaleX(0); } }
        @keyframes mt-fade { from { opacity: 0; } }
      `}</style>
      <span ref={ref} aria-label={text} style={{ color, whiteSpace: 'pre', display: 'inline-block' }}>
        {chars.map((c, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              display: 'inline-block',
              animation: `mt-rise ${duration}ms ${ease} both`,
              animationDelay: `${i * stagger}ms`,
            }}
          >
            {c}
          </span>
        ))}
      </span>
      {showDimension && (
        <span style={{ position: 'relative', height: 18, marginTop: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <span
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              height: 1,
              background: lineColor,
              animation: `mt-draw 900ms ${ease} both`,
              animationDelay: `${total * 0.6}ms`,
            }}
          />
          <span style={{ position: 'absolute', left: 0, top: 3, width: 1, height: 13, background: lineColor }} />
          <span style={{ position: 'absolute', right: 0, top: 3, width: 1, height: 13, background: lineColor }} />
          <span
            style={{
              position: 'relative',
              padding: '0 8px',
              background: 'var(--dim-bg, #efece4)',
              color: lineColor,
              font: '500 11px/1 ui-monospace, Menlo, monospace',
              letterSpacing: '0.06em',
              animation: `mt-fade 500ms ease both`,
              animationDelay: `${total * 0.6 + 500}ms`,
            }}
          >
            {width} {unit}
          </span>
        </span>
      )}
    </span>
  )
}
