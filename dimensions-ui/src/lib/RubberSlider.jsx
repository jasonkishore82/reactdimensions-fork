import { useEffect, useRef, useState } from 'react'

// Rubber slider: an ordinary slider until you drag past either end. Then the
// track stretches after your finger with growing resistance, thinning a little
// as it pulls, and the thumb rides along on the stretched end. Let go and it
// springs back with a small wobble. Arrow keys step the value (Page Up/Down in
// bigger steps, Home/End to the ends); pressing on past an end gives a little
// bump. Under reduced motion the track never stretches.

export default function RubberSlider({
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue = 40,
  onChange,
  width = 280,
  stretch = 36,
  resistance = 1,
  stiffness = 420,
  damping = 18,
  label = 'Volume',
  showValue = true,
  accent = '#ff4d1a',
  trackColor = '#d8d1c4',
  thumbColor = '#fffdf8',
  textColor = '#1c1a16',
  style,
}) {
  const [inner, setInner] = useState(defaultValue)
  const [held, setHeld] = useState(false)
  const v = Math.max(min, Math.min(max, value ?? inner))
  const track = useRef(null)
  const fill = useRef(null)
  const thumb = useRef(null)
  const s = useRef({ x: 0, vx: 0, drag: false, ratio: 0 })
  s.current.ratio = max > min ? (v - min) / (max - min) : 0

  useEffect(() => {
    const p = s.current
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let raf = 0
    let last = performance.now()
    const step_ = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      if (!p.drag) {
        if (mq?.matches) { p.x = 0; p.vx = 0 } else {
          p.vx += (-stiffness * p.x - damping * p.vx) * dt
          p.x += p.vx * dt
          if (Math.abs(p.x) < 0.02 && Math.abs(p.vx) < 0.5) { p.x = 0; p.vx = 0 }
        }
      }
      const o = p.x
      const k = Math.min(1, Math.abs(o) / stretch)
      if (track.current) {
        track.current.style.transformOrigin = o < 0 ? '100% 50%' : '0 50%'
        track.current.style.transform = `scale(${((width + Math.abs(o)) / width).toFixed(4)}, ${(1 - 0.35 * k).toFixed(4)})`
      }
      if (fill.current) fill.current.style.transform = `scaleX(${p.ratio.toFixed(4)})`
      if (thumb.current) {
        // the stretch only ever happens at an end, so the thumb rides the stretched edge
        const x = p.ratio * width + o
        thumb.current.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) scale(${(1 + 0.14 * k).toFixed(4)}, ${(1 - 0.1 * k).toFixed(4)})`
      }
      raf = requestAnimationFrame(step_)
    }
    raf = requestAnimationFrame(step_)
    return () => cancelAnimationFrame(raf)
  }, [width, stretch, stiffness, damping])

  const set = (next) => {
    const snapped = Math.max(min, Math.min(max, Math.round((next - min) / step) * step + min))
    const clean = Number(snapped.toFixed(6))
    if (clean === v) return
    s.current.ratio = max > min ? (clean - min) / (max - min) : 0
    if (value === undefined) setInner(clean)
    onChange?.(clean)
  }
  const rubber = (d) => (1 - 1 / (d / (stretch * resistance) + 1)) * stretch

  const fromPointer = (e) => {
    const p = s.current
    const r = track.current.parentNode.getBoundingClientRect()
    const raw = (e.clientX - r.left) / width
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (raw < 0) p.x = reduce ? 0 : -rubber(-raw * width)
    else if (raw > 1) p.x = reduce ? 0 : rubber((raw - 1) * width)
    else p.x = 0
    set(min + Math.max(0, Math.min(1, raw)) * (max - min))
  }
  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus({ preventScroll: true })
    s.current.drag = true
    s.current.vx = 0
    setHeld(true)
    fromPointer(e)
  }
  const move = (e) => { if (s.current.drag) fromPointer(e) }
  const up = () => {
    if (!s.current.drag) return
    s.current.drag = false
    setHeld(false)
  }
  const key = (e) => {
    const big = Math.max(step, (max - min) / 10)
    const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, PageDown: -big, PageUp: big }[e.key]
    if (e.key === 'Home') { e.preventDefault(); return set(min) }
    if (e.key === 'End') { e.preventDefault(); return set(max) }
    if (d === undefined) return
    e.preventDefault()
    const atEnd = (d < 0 && v <= min) || (d > 0 && v >= max)
    if (atEnd) {
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) s.current.vx += Math.sign(d) * 260
    } else set(v + d)
  }

  return (
    <div className="rs" data-held={held} style={{ '--rs-accent': accent, '--rs-track': trackColor, '--rs-thumb': thumbColor, '--rs-ink': textColor, width, ...style }}>
      <style>{`
        .rs { position: relative; display: inline-flex; flex-direction: column; gap: 14px; user-select: none; -webkit-user-select: none; color: var(--rs-ink); }
        .rs-head { display: flex; justify-content: space-between; align-items: baseline; }
        .rs-label { font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; color: #8e887c; }
        .rs-val { font: 400 28px/1 Georgia, 'Times New Roman', serif; font-variant-numeric: tabular-nums; }
        .rs-hit { position: relative; height: 36px; cursor: pointer; touch-action: none; outline: none; -webkit-tap-highlight-color: transparent; }
        .rs-track { position: absolute; left: 0; right: 0; top: 50%; height: 8px; margin-top: -4px; border-radius: 99px; background: var(--rs-track); overflow: hidden; will-change: transform; }
        .rs-fill { position: absolute; inset: 0; background: var(--rs-accent); transform-origin: 0 50%; will-change: transform; }
        .rs-thumb { position: absolute; left: -13px; top: 50%; width: 26px; height: 26px; margin-top: -13px; border-radius: 50%; background: var(--rs-thumb); border: 1px solid rgba(0,0,0,.1); box-shadow: 0 4px 10px -3px rgba(20,18,14,.4); will-change: transform; pointer-events: none; }
        .rs-thumb::after { content: ''; position: absolute; inset: 8px; border-radius: 50%; background: var(--rs-accent); transform: scale(.6); transition: transform 220ms cubic-bezier(.2,.8,.2,1); }
        .rs[data-held='true'] .rs-thumb::after { transform: scale(1); }
        .rs[data-held='true'] .rs-hit { cursor: grabbing; }
        .rs-hit:focus-visible .rs-thumb { box-shadow: 0 0 0 3px var(--rs-accent), 0 4px 10px -3px rgba(20,18,14,.4); }
        @media (prefers-reduced-motion: reduce) { .rs-thumb::after { transition: none; } }
      `}</style>
      {showValue && (
        <div className="rs-head" aria-hidden="true">
          <span className="rs-label">{label}</span>
          <span className="rs-val">{v}</span>
        </div>
      )}
      <div
        className="rs-hit"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={v}
        aria-orientation="horizontal"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
        onKeyDown={key}
      >
        <div ref={track} className="rs-track"><div ref={fill} className="rs-fill" /></div>
        <div ref={thumb} className="rs-thumb" />
      </div>
    </div>
  )
}
