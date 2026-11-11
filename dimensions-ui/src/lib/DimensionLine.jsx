// Wraps any element with a CAD-style dimension line and label.
// position: 'top' | 'bottom' | 'left' | 'right'
export default function DimensionLine({
  children,
  label = '120 mm',
  position = 'top',
  color = '#ff4d1a',
  offset = 18,
  animate = true,
  style,
}) {
  const vertical = position === 'left' || position === 'right'
  const tick = { position: 'absolute', background: color }
  const ease = 'cubic-bezier(0.2, 0.7, 0.1, 1)'

  const wrap = {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    ...(vertical
      ? { top: 0, bottom: 0, width: 14, [position]: -offset - 7 }
      : { left: 0, right: 0, height: 14, [position]: -offset - 7 }),
  }
  const line = {
    position: 'absolute',
    background: color,
    ...(vertical ? { top: 0, bottom: 0, left: 7, width: 1 } : { left: 0, right: 0, top: 7, height: 1 }),
    animation: animate ? `${vertical ? 'dl-y' : 'dl-x'} 1s ${ease} both` : 'none',
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <style>{`
        @keyframes dl-x { from { transform: scaleX(0); } }
        @keyframes dl-y { from { transform: scaleY(0); } }
        @keyframes dl-f { from { opacity: 0; } }
      `}</style>
      {children}
      <div aria-hidden="true" style={wrap}>
        <span style={line} />
        {vertical ? (
          <>
            <span style={{ ...tick, top: 0, left: 1, width: 13, height: 1 }} />
            <span style={{ ...tick, bottom: 0, left: 1, width: 13, height: 1 }} />
          </>
        ) : (
          <>
            <span style={{ ...tick, left: 0, top: 1, width: 1, height: 13 }} />
            <span style={{ ...tick, right: 0, top: 1, width: 1, height: 13 }} />
          </>
        )}
        <span
          style={{
            position: 'relative',
            padding: '2px 8px',
            background: 'var(--dim-bg, #efece4)',
            color,
            font: '500 11px/1 ui-monospace, Menlo, monospace',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            transform: vertical ? 'rotate(-90deg)' : 'none',
            animation: animate ? 'dl-f 0.5s ease 0.7s both' : 'none',
          }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
