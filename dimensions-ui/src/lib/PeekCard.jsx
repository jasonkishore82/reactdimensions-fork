import { useState } from 'react'

// Peek: hovering (or focusing, or tapping) the card lifts it and tips it back,
// showing its thick back edge and a deeper shadow underneath.
export default function PeekCard({
  lift = 14,
  tilt = 10,
  thickness = 10,
  color = '#f4f1ea',
  edgeColor = '#c9c2b4',
  accent = '#ff4d1a',
  title = 'Peek',
  label = 'PLATE 01',
  style,
}) {
  const [up, setUp] = useState(false)
  return (
    <div
      tabIndex={0}
      role="button"
      aria-pressed={up}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setUp(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setUp(false)}
      onClick={(e) => e.nativeEvent.pointerType !== 'mouse' && setUp((u) => !u)}
      onFocus={() => setUp(true)}
      onBlur={() => setUp(false)}
      className="pk"
      style={{ '--lift': `${lift}px`, '--tilt': `${tilt}deg`, '--thick': `${thickness}px`, '--edge': edgeColor, ...style }}
    >
      <style>{`
        .pk { position: relative; width: 240px; height: 300px; perspective: 900px; outline: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .pk-shadow { position: absolute; left: 8%; right: 8%; bottom: -6px; height: 22px; border-radius: 50%; background: rgba(20, 18, 14, .28); filter: blur(10px); transition: transform 420ms cubic-bezier(.2,.8,.2,1), opacity 420ms; transform: scale(.85); opacity: .5; }
        .pk-body { position: absolute; inset: 0; transform-style: preserve-3d; transform-origin: 50% 100%; transition: transform 420ms cubic-bezier(.2,.8,.2,1); }
        .pk-edge { position: absolute; left: 0; right: 0; bottom: 0; height: var(--thick); background: var(--edge); transform-origin: 50% 0; transform: translateY(100%) rotateX(-90deg); border-radius: 0 0 6px 6px; }
        .pk-face { position: absolute; inset: 0; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid rgba(0,0,0,.08); }
        .pk-back { transform: translateZ(calc(var(--thick) * -1)); background: var(--edge); }
        .pk-tag, .pk-foot { font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; color: #8e887c; }
        .pk-title { font: 400 54px/.95 Georgia, 'Times New Roman', serif; color: #1c1a16; }
        .pk[aria-pressed='true'] .pk-body { transform: translateY(calc(var(--lift) * -1)) rotateX(var(--tilt)); }
        .pk[aria-pressed='true'] .pk-shadow { transform: scale(1.05); opacity: 1; }
        .pk:focus-visible .pk-face:last-child { box-shadow: 0 0 0 3px ${accent}; }
        @media (prefers-reduced-motion: reduce) { .pk-body, .pk-shadow { transition: none; } }
      `}</style>
      <div className="pk-shadow" aria-hidden="true" />
      <div className="pk-body">
        <div className="pk-face pk-back" aria-hidden="true" />
        <div className="pk-edge" aria-hidden="true" />
        <div className="pk-face" style={{ background: color, transform: 'translateZ(0)' }}>
          <span className="pk-tag">{label}</span>
          <span className="pk-title">{title}<span style={{ color: accent }}>.</span></span>
          <span className="pk-foot">HOVER · FOCUS · TAP</span>
        </div>
      </div>
    </div>
  )
}
