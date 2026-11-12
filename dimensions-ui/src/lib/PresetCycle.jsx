import { useEffect, useRef, useState } from 'react'

// Preset cycle: tapping the swatch steps to the next preset. A ring of arc
// segments around it shows how many presets there are and which one is
// current, and a small dot springs round the ring to the new position (always
// forwards, so it keeps circling rather than snapping back). The swatch
// crossfades between palettes. Shift-click or the left/down arrows step back.
// Under reduced motion the dot jumps and the swatch switches without the pop.

const PRESETS = [
  { name: 'Ember', colors: ['#ff4d1a', '#ffb199', '#1c1a16'] },
  { name: 'Tide', colors: ['#2a9d8f', '#a8dadc', '#1d3557'] },
  { name: 'Dune', colors: ['#e9c46a', '#f4a261', '#6b4f2a'] },
  { name: 'Moss', colors: ['#6a994e', '#a7c957', '#283618'] },
  { name: 'Dusk', colors: ['#7b2cbf', '#f72585', '#240046'] },
  { name: 'Slate', colors: ['#8d99ae', '#edf2f4', '#2b2d42'] },
  { name: 'Coral', colors: ['#ef476f', '#ffd166', '#073b4c'] },
  { name: 'Frost', colors: ['#90e0ef', '#caf0f8', '#03045e'] },
]

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function PresetCycle({
  count = 5,
  size = 112,
  gap = 10,
  stiffness = 200,
  damping = 18,
  accent = '#ff4d1a',
  trackColor = '#d9d3c7',
  textColor = '#1c1a16',
  onChange,
  style,
}) {
  const n = Math.max(2, Math.min(PRESETS.length, Math.round(count)))
  const [step, setStep] = useState(0) // cumulative, so the dot always travels the short way forward
  const idx = ((step % n) + n) % n
  const preset = PRESETS[idx]
  const dot = useRef(null)
  const chip = useRef(null)
  const ang = useRef({ a: 0, v: 0 })

  const R = size / 2 + 12
  const S = Math.ceil((R + 8) * 2)
  const c = S / 2
  const seg = 360 / n

  const apply = () => dot.current?.setAttribute('transform', `rotate(${ang.current.a} ${c} ${c})`)

  useEffect(() => {
    const target = step * seg
    const s = ang.current
    if (reduced()) { s.a = target; s.v = 0; apply(); return }
    let raf = 0
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      s.v += (-stiffness * (s.a - target) - damping * s.v) * dt
      s.a += s.v * dt
      if (Math.abs(s.a - target) < 0.02 && Math.abs(s.v) < 0.05) { s.a = target; s.v = 0; apply(); return }
      apply()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [step, seg, stiffness, damping, c])

  useEffect(() => { onChange?.(PRESETS[idx], idx) }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (d) => {
    setStep((s) => s + d)
    if (!reduced()) chip.current?.animate?.(
      [{ transform: 'scale(.9)' }, { transform: 'scale(1)' }],
      { duration: 460, easing: 'cubic-bezier(.34,1.56,.64,1)' },
    )
  }

  const key = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); go(1) }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); go(-1) }
  }

  // arc from a0 to a1 degrees, clockwise from 12 o'clock
  const arc = (a0, a1) => {
    const p = (a) => [c + R * Math.sin((a * Math.PI) / 180), c - R * Math.cos((a * Math.PI) / 180)]
    const [x0, y0] = p(a0)
    const [x1, y1] = p(a1)
    return `M ${x0} ${y0} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
  }

  return (
    <div className="pcy" style={{ color: textColor, ...style }}>
      <style>{`
        .pcy { display: inline-flex; flex-direction: column; align-items: center; gap: 10px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
        .pcy-wrap { position: relative; display: grid; place-items: center; }
        .pcy-ring { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
        .pcy-ring path { fill: none; stroke-linecap: round; transition: stroke 260ms, stroke-width 260ms cubic-bezier(.34,1.56,.64,1); }
        .pcy-chip { position: relative; border: 0; padding: 0; border-radius: 50%; cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation; box-shadow: 0 10px 22px -12px rgba(20,18,14,.55), inset 0 0 0 1px rgba(0,0,0,.08); background: #fff; }
        .pcy-chip:focus-visible { box-shadow: 0 0 0 3px #f4f1ea, 0 0 0 6px ${accent}; }
        .pcy-layer { position: absolute; inset: 0; border-radius: 50%; transition: opacity 340ms ease; }
        .pcy-name { font: 600 16px/1 system-ui, sans-serif; letter-spacing: -.01em; }
        .pcy-pos { font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; opacity: .55; margin-top: 5px; text-align: center; }
        @media (prefers-reduced-motion: reduce) { .pcy-layer, .pcy-ring path { transition: none; } }
      `}</style>
      <div className="pcy-wrap" style={{ width: S, height: S }}>
        <svg className="pcy-ring" width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
          {Array.from({ length: n }, (_, i) => (
            <path
              key={i}
              d={arc((i - 0.5) * seg + gap / 2, (i + 0.5) * seg - gap / 2)}
              stroke={i === idx ? accent : trackColor}
              strokeWidth={i === idx ? 5 : 3}
            />
          ))}
          <g ref={dot}>
            <circle cx={c} cy={c - R} r="6" fill="#fff" stroke={accent} strokeWidth="2.5" />
          </g>
        </svg>
        <button
          ref={chip}
          type="button"
          className="pcy-chip"
          onClick={(e) => go(e.shiftKey ? -1 : 1)}
          onKeyDown={key}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`Preset ${preset.name}, ${idx + 1} of ${n}. Activate for next preset.`}
          style={{ width: size, height: size }}
        >
          {PRESETS.slice(0, n).map((p, i) => (
            <span
              key={p.name}
              className="pcy-layer"
              aria-hidden="true"
              style={{
                opacity: i === idx ? 1 : 0,
                background: `radial-gradient(circle at 32% 30%, ${p.colors[1]} 0 21%, transparent 22%), linear-gradient(135deg, ${p.colors[0]} 0 52%, ${p.colors[2]} 52% 100%)`,
              }}
            />
          ))}
        </button>
      </div>
      <div aria-live="polite">
        <div className="pcy-name">{preset.name}</div>
        <div className="pcy-pos">{String(idx + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</div>
      </div>
    </div>
  )
}
