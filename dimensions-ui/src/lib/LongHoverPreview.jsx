import { useEffect, useRef, useState } from 'react'

// Long-hover tooltip: resting on a link shows a small tooltip after `delay`;
// staying on it expands the tooltip into a full preview card after
// `expandDelay`, with a ring that fills while you wait. Long-press on touch;
// on keyboard, focus shows the tooltip and Enter or Space expands it.

const LINKS = {
  orbit: { title: 'Orbit controls', body: 'Drag to spin the camera around the model; it eases to a stop and keeps its framing.', tag: '3D', color: '#2a9d8f' },
  presets: { title: 'Presets', body: 'Named sets of control values you can switch between, with a crossfade on change.', tag: 'Controls', color: '#f4a261' },
}

export default function LongHoverPreview({ delay = 450, expandDelay = 1400, accent = '#ff4d1a', style }) {
  const [open, setOpen] = useState(null) // which link
  const [stage, setStage] = useState(0) // 0 hidden, 1 tooltip, 2 preview
  const timers = useRef([])

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const start = (key) => {
    clear()
    setOpen(key)
    setStage(0)
    timers.current.push(setTimeout(() => setStage(1), delay))
    timers.current.push(setTimeout(() => setStage(2), expandDelay))
  }
  const stop = () => { clear(); setStage(0); setOpen(null) }
  useEffect(() => clear, [])

  // a plain render function, not a component, so links keep focus across re-renders
  const link = (k, children) => (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        onPointerEnter={(e) => e.pointerType === 'mouse' && start(k)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && stop()}
        onPointerDown={(e) => e.pointerType !== 'mouse' && start(k)}
        onPointerUp={(e) => e.pointerType !== 'mouse' && stage < 2 && stop()}
        onContextMenu={(e) => e.preventDefault()}
        onFocus={() => { clear(); setOpen(k); setStage(1) }}
        onBlur={stop}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && open === k) { e.preventDefault(); setStage(2) } if (e.key === 'Escape') stop() }}
        aria-describedby={open === k && stage ? `lhp-${k}` : undefined}
        style={{ color: '#1c1a16', textDecoration: 'underline', textDecorationColor: accent, textUnderlineOffset: 4, textDecorationThickness: 2, WebkitTouchCallout: 'none', userSelect: 'none' }}
      >
        {children}
        {open === k && stage < 2 && (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ marginLeft: 4, verticalAlign: '-1px' }}>
            <circle cx="7" cy="7" r="5" fill="none" stroke="#e2ddd2" strokeWidth="2" />
            <circle cx="7" cy="7" r="5" fill="none" stroke={accent} strokeWidth="2" pathLength="1" strokeDasharray="1" transform="rotate(-90 7 7)"
              style={{ strokeDashoffset: 1, animation: `lhp-fill ${expandDelay}ms linear forwards` }} />
          </svg>
        )}
      </a>
      {open === k && stage > 0 && (
        <span
          id={`lhp-${k}`}
          role="tooltip"
          className={stage === 2 ? 'lhp-pop lhp-big' : 'lhp-pop'}
          onPointerEnter={clear}
          onPointerLeave={stop}
        >
          {stage === 1 ? (
            <b>{LINKS[k].title}</b>
          ) : (
            <>
              <span className="lhp-img" style={{ background: LINKS[k].color }}><em>{LINKS[k].tag}</em></span>
              <b>{LINKS[k].title}</b>
              <span className="lhp-body">{LINKS[k].body}</span>
            </>
          )}
        </span>
      )}
    </span>
  )

  return (
    <div style={{ maxWidth: 420, font: '400 17px/1.7 Georgia, serif', color: '#3a372f', ...style }}>
      <style>{`
        @keyframes lhp-fill { to { stroke-dashoffset: 0 } }
        @keyframes lhp-in { from { opacity: 0; transform: translate(-50%, 4px) scale(.96) } }
        .lhp-pop { position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%); z-index: 5; background: #1c1a16; color: #f4f1ea; border-radius: 8px; padding: 7px 10px; white-space: nowrap; font: 600 12px/1.2 system-ui, sans-serif; animation: lhp-in 160ms ease-out; transition: width 240ms, padding 240ms; }
        .lhp-big { width: 230px; white-space: normal; padding: 10px; display: grid; gap: 6px; }
        .lhp-big b { font-size: 14px; }
        .lhp-img { height: 86px; border-radius: 6px; display: grid; place-items: end start; padding: 8px; }
        .lhp-img em { font: 600 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .1em; text-transform: uppercase; color: #1c1a16; background: rgba(255,255,255,.7); padding: 3px 5px; border-radius: 3px; font-style: normal; }
        .lhp-body { font: 400 12px/1.45 system-ui, sans-serif; opacity: .75; }
        @media (prefers-reduced-motion: reduce) { .lhp-pop { animation: none; } }
      `}</style>
      <p style={{ margin: 0 }}>
        Every model ships with {link('orbit', 'orbit controls')} and a set of {link('presets', 'presets')}.
        Rest on a link to see a hint, and keep resting to open the full preview.
      </p>
    </div>
  )
}
