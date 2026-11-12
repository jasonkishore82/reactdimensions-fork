import { useEffect, useRef, useState } from 'react'

// Hold button, in three stages. Press and the button squeezes in while a fill
// sweeps across it; let go early and the fill drains away and nothing happens.
// Hold until the fill is full and the button pops up, armed. Release then to
// commit; it confirms with a tick and resets after a moment. Slide off the
// button while armed and releasing cancels instead. From the keyboard, hold
// Space or Enter; Escape cancels. Under reduced motion there is no squeeze or
// pop and the fill drops straight back, but the timed fill still shows.

export default function HoldButton({
  label = 'Hold to delete',
  holdLabel = 'Keep holding',
  armedLabel = 'Release to confirm',
  cancelLabel = 'Release to cancel',
  doneLabel = 'Deleted',
  holdTime = 1.2,
  resetAfter = 1.8,
  squeeze = 0.94,
  pop = 1.05,
  stiffness = 600,
  damping = 22,
  accent = '#ff4d1a',
  color = '#1c1a16',
  textColor = '#f4f1ea',
  onCommit,
  style,
}) {
  const [phase, setPhase] = useState('idle')
  const [outside, setOutside] = useState(false)
  const btn = useRef(null)
  const fill = useRef(null)
  const s = useRef({ phase: 'idle', pr: 0, shown: 0, sc: 1, vs: 0, pointer: -1, key: false })
  const timer = useRef(0)

  const go = (next) => {
    s.current.phase = next
    setPhase(next)
  }

  useEffect(() => {
    const p = s.current
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let raf = 0
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const reduce = mq?.matches
      if (p.phase === 'hold') {
        p.pr = Math.min(1, p.pr + dt / Math.max(0.05, holdTime))
        if (p.pr >= 1) {
          go('armed')
          navigator.vibrate?.(12)
        }
      } else if (p.phase === 'armed' || p.phase === 'done') p.pr = 1
      else p.pr = 0
      // what the fill shows: an eased sweep while holding, a smooth drain after
      if (p.phase === 'hold') p.shown = 1 - (1 - p.pr) * (1 - p.pr) * (1 - 0.4 * p.pr)
      else if (p.phase === 'idle') p.shown = reduce || p.shown < 0.001 ? 0 : p.shown * Math.exp(-9 * dt)
      else p.shown = 1
      const ts = p.phase === 'hold' ? squeeze - (1 - squeeze) * 0.5 * p.pr : p.phase === 'armed' ? pop : 1
      if (reduce) { p.sc = 1; p.vs = 0 } else {
        p.vs += (-stiffness * (p.sc - ts) - damping * p.vs) * dt
        p.sc += p.vs * dt
      }
      if (btn.current) btn.current.style.transform = `scale(${p.sc.toFixed(4)})`
      if (fill.current) fill.current.style.transform = `scaleX(${p.shown.toFixed(4)})`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer.current)
    }
  }, [holdTime, squeeze, pop, stiffness, damping])

  const start = () => {
    const p = s.current
    if (p.phase !== 'idle') return false
    setOutside(false)
    go('hold')
    return true
  }
  const release = (commit) => {
    const p = s.current
    if (p.phase === 'armed' && commit) {
      go('done')
      onCommit?.()
      clearTimeout(timer.current)
      timer.current = setTimeout(() => go('idle'), resetAfter * 1000)
    } else if (p.phase === 'hold' || p.phase === 'armed') go('idle')
    setOutside(false)
  }

  const inside = (e) => {
    const r = btn.current.getBoundingClientRect()
    const m = 16
    return e.clientX > r.left - m && e.clientX < r.right + m && e.clientY > r.top - m && e.clientY < r.bottom + m
  }
  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!start()) return
    s.current.pointer = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e) => {
    if (e.pointerId !== s.current.pointer || s.current.phase === 'idle' || s.current.phase === 'done') return
    const out = !inside(e)
    if (out !== outside) setOutside(out)
    if (out && s.current.phase === 'hold') release(false)
  }
  const up = (e) => {
    if (e.pointerId !== s.current.pointer) return
    s.current.pointer = -1
    release(e.type === 'pointerup' && inside(e))
  }
  const keyDown = (e) => {
    if (e.key === 'Escape') { if (s.current.phase !== 'done') release(false); return }
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (e.repeat || s.current.key) return
    if (start()) s.current.key = true
  }
  const keyUp = (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (!s.current.key) return
    s.current.key = false
    release(true)
  }
  const blur = () => {
    s.current.key = false
    if (s.current.phase !== 'done') release(false)
  }

  const text = phase === 'hold' ? holdLabel : phase === 'armed' ? (outside ? cancelLabel : armedLabel) : phase === 'done' ? doneLabel : label

  return (
    <>
      <style>{`
        .hb { position: relative; display: inline-flex; align-items: center; justify-content: center; min-width: 240px; height: 56px; padding: 0 26px; border: 0; border-radius: 999px; background: var(--hb-bg); color: var(--hb-ink); cursor: pointer; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; will-change: transform; outline: none; isolation: isolate; box-shadow: 0 10px 24px -14px rgba(20,18,14,.6); }
        .hb:focus-visible { box-shadow: 0 0 0 3px var(--hb-bg), 0 0 0 6px var(--hb-accent); }
        .hb-fill { position: absolute; inset: 0; background: var(--hb-accent); transform-origin: 0 50%; transform: scaleX(0); z-index: -1; }
        .hb[data-phase='armed'] { animation: hb-pulse 900ms ease-out infinite; }
        .hb[data-phase='armed']:focus-visible { animation: none; }
        @keyframes hb-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--hb-accent) 55%, transparent); } 100% { box-shadow: 0 0 0 14px transparent; } }
        .hb-label { position: relative; display: inline-flex; align-items: center; gap: 10px; font: 500 12px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; animation: hb-in 240ms cubic-bezier(.2,.8,.2,1); }
        @keyframes hb-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .hb-tick path { stroke-dasharray: 20; stroke-dashoffset: 20; animation: hb-draw 360ms 80ms cubic-bezier(.2,.8,.2,1) forwards; }
        @keyframes hb-draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) { .hb, .hb-label, .hb-tick path { animation: none !important; } .hb-tick path { stroke-dashoffset: 0; } }
        `}</style>
      <button
        ref={btn}
        type="button"
        className="hb"
        data-phase={phase}
        aria-disabled={phase === 'done'}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={(e) => { if (e.pointerId === s.current.pointer) up(e) }}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        onBlur={blur}
        onContextMenu={(e) => e.preventDefault()}
        style={{ '--hb-accent': accent, '--hb-bg': color, '--hb-ink': textColor, ...style }}
      >
        <span ref={fill} className="hb-fill" aria-hidden="true" />
        <span key={text} className="hb-label">
          {phase === 'done' && (
            <svg className="hb-tick" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {text}
        </span>
        <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          {phase === 'armed' ? armedLabel : phase === 'done' ? doneLabel : ''}
        </span>
      </button>
    </>
  )
}
