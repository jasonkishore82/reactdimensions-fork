import { useEffect, useRef, useState } from 'react'

// Follow drawer: a sheet that peeks in from the edge and tracks your finger
// one-to-one while you drag it. Let go and it looks at where you were heading
// and how fast: a flick settles it open or closed on a spring that carries
// your release speed, a slow drag settles to whichever side is nearer.
// Dragging past fully open meets rubber-band resistance. The page behind dims
// as it opens. Tap the peek to open, the handle or the dimmed page to close.
// The handle is a button: Enter or Space toggles, Escape closes, arrow keys
// open and close. Under reduced motion it jumps to open or closed.

const DEFAULT_ROWS = ['Materials', 'Lighting', 'Camera', 'Export']

export default function FollowDrawer({
  side = 'bottom',
  size = 0.7,
  peek = 64,
  stiffness = 320,
  damping = 30,
  dim = 0.35,
  defaultOpen = false,
  title = 'Scene settings',
  rows = DEFAULT_ROWS,
  accent = '#ff4d1a',
  color = '#fffdf8',
  textColor = '#1c1a16',
  background = '#f4f1ea',
  onOpenChange,
  style,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const area = useRef(null)
  const sheet = useRef(null)
  const shade = useRef(null)
  const s = useRef({ o: defaultOpen ? 1 : 0, v: 0, target: defaultOpen ? 1 : 0, drag: null, range: 1 })
  const bottom = side !== 'right'

  useEffect(() => {
    const p = s.current
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let raf = 0
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const a = area.current
      if (a) {
        const full = bottom ? a.clientHeight : a.clientWidth
        p.range = Math.max(1, full * size - peek)
      }
      if (!p.drag) {
        if (mq?.matches) { p.o = p.target; p.v = 0 } else {
          p.v += (-stiffness * (p.o - p.target) - damping * p.v) * dt
          p.o += p.v * dt
          if (Math.abs(p.o - p.target) < 0.0005 && Math.abs(p.v) < 0.005) { p.o = p.target; p.v = 0 }
        }
      }
      const t = (1 - p.o) * p.range
      if (sheet.current) sheet.current.style.transform = bottom ? `translate3d(0, ${t.toFixed(2)}px, 0)` : `translate3d(${t.toFixed(2)}px, 0, 0)`
      if (shade.current) {
        const k = Math.max(0, Math.min(1, p.o))
        shade.current.style.opacity = (k * dim).toFixed(3)
        shade.current.style.pointerEvents = p.target === 1 ? 'auto' : 'none'
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [bottom, size, peek, stiffness, damping, dim])

  const settle = (target, v = 0) => {
    const p = s.current
    const was = p.target === 1
    p.target = target
    p.v = v
    setOpen(target === 1)
    if (was !== (target === 1)) onOpenChange?.(target === 1)
  }
  const toggle = () => settle(s.current.target === 1 ? 0 : 1)

  const rubber = (d) => {
    const max = peek * 0.9
    return (1 - 1 / (d / max + 1)) * max
  }
  const pos = (e) => (bottom ? e.clientY : e.clientX)

  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const p = s.current
    e.currentTarget.setPointerCapture(e.pointerId)
    p.drag = { start: pos(e), from: p.o, moved: false, onHandle: !!e.target.closest?.('.fd-handle'), hist: [{ x: pos(e), t: performance.now() }] }
    p.v = 0
    sheet.current.dataset.dragging = 'true'
  }
  const move = (e) => {
    const p = s.current
    const d = p.drag
    if (!d) return
    const delta = pos(e) - d.start
    if (Math.abs(delta) > 4) d.moved = true
    const raw = d.from - delta / p.range
    if (raw > 1) p.o = 1 + rubber((raw - 1) * p.range) / p.range
    else if (raw < 0) p.o = -rubber(-raw * p.range) / p.range
    else p.o = raw
    d.hist.push({ x: pos(e), t: performance.now() })
    if (d.hist.length > 6) d.hist.shift()
  }
  const up = () => {
    const p = s.current
    const d = p.drag
    if (!d) return
    p.drag = null
    delete sheet.current.dataset.dragging
    if (!d.moved) {
      // a tap: the peek opens, the handle closes
      if (p.target === 0) settle(1)
      else if (d.onHandle) settle(0)
      else settle(p.target)
      return
    }
    const a = d.hist[0]
    const c = d.hist[d.hist.length - 1]
    const dt = Math.max(0.016, (c.t - a.t) / 1000)
    const px = (c.x - a.x) / dt
    const vo = Math.max(-8, Math.min(8, -px / p.range))
    let target
    if (Math.abs(px) > 400) target = px < 0 ? 1 : 0
    else target = p.o + vo * 0.2 > 0.5 ? 1 : 0
    settle(target, vo)
  }
  const key = (e) => {
    const openKey = bottom ? 'ArrowUp' : 'ArrowLeft'
    const closeKey = bottom ? 'ArrowDown' : 'ArrowRight'
    if (e.key === openKey) { e.preventDefault(); settle(1) }
    else if (e.key === closeKey || (e.key === 'Escape' && s.current.target === 1)) { e.preventDefault(); settle(0) }
  }

  return (
    <div
      ref={area}
      className={`fd fd-${bottom ? 'b' : 'r'}`}
      data-open={open}
      onKeyDown={key}
      style={{ '--fd-accent': accent, '--fd-sheet': color, '--fd-ink': textColor, '--fd-bg': background, '--fd-size': `${size * 100}%`, ...style }}
    >
      <style>{`
        .fd { position: relative; width: 100%; height: 100%; min-height: 260px; overflow: hidden; background: var(--fd-bg); color: var(--fd-ink); user-select: none; -webkit-user-select: none; }
        .fd-page { position: absolute; inset: 0; padding: 22px; display: flex; flex-direction: column; gap: 12px; }
        .fd-kicker { font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; color: #8e887c; }
        .fd-h { font: 400 34px/1 Georgia, 'Times New Roman', serif; }
        .fd-blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
        .fd-block { height: 64px; border-radius: 10px; background: #e8e3d8; }
        .fd-shade { position: absolute; inset: 0; background: #14120e; opacity: 0; }
        .fd-sheet { position: absolute; background: var(--fd-sheet); box-shadow: 0 -12px 40px -18px rgba(20,18,14,.5); border: 1px solid rgba(0,0,0,.08); touch-action: none; will-change: transform; cursor: grab; display: flex; }
        .fd-sheet[data-dragging='true'] { cursor: grabbing; }
        .fd-sheet::after { content: ''; position: absolute; background: var(--fd-sheet); }
        .fd-b .fd-sheet { left: 0; right: 0; bottom: 0; height: var(--fd-size); border-radius: 18px 18px 0 0; flex-direction: column; }
        .fd-b .fd-sheet::after { left: -1px; right: -1px; top: 100%; height: 200px; }
        .fd-r .fd-sheet { top: 0; bottom: 0; right: 0; width: var(--fd-size); border-radius: 18px 0 0 18px; flex-direction: row; box-shadow: -12px 0 40px -18px rgba(20,18,14,.5); }
        .fd-r .fd-sheet::after { top: -1px; bottom: -1px; left: 100%; width: 200px; }
        .fd-handle { flex: none; display: flex; align-items: center; gap: 12px; border: 0; background: none; color: inherit; cursor: inherit; text-align: left; font: inherit; outline: none; border-radius: 14px; -webkit-tap-highlight-color: transparent; }
        .fd-b .fd-handle { flex-direction: column; align-items: stretch; padding: 10px 20px 14px; height: ${peek}px; box-sizing: border-box; }
        .fd-r .fd-handle { flex-direction: row; padding: 0 10px; width: ${peek}px; box-sizing: border-box; justify-content: center; }
        .fd-handle:focus-visible { box-shadow: inset 0 0 0 3px var(--fd-accent); }
        .fd-bar { flex: none; border-radius: 99px; background: #cfc8ba; align-self: center; }
        .fd-b .fd-bar { width: 40px; height: 5px; }
        .fd-r .fd-bar { width: 5px; height: 40px; }
        .fd[data-open='true'] .fd-bar { background: var(--fd-accent); }
        .fd-title { display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px; gap: 8px; }
        .fd-r .fd-title { display: none; }
        .fd-t { font: 400 20px/1 Georgia, 'Times New Roman', serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fd-s { font: 500 9px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; color: #8e887c; white-space: nowrap; }
        .fd-body { flex: 1; min-width: 0; min-height: 0; overflow: hidden; padding: 4px 20px 20px; display: flex; flex-direction: column; gap: 8px; }
        .fd-r .fd-body { padding: 22px 20px 20px 4px; }
        .fd-r .fd-body .fd-t { margin-bottom: 8px; }
        .fd-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,.07); font: 400 15px/1 system-ui, sans-serif; }
        .fd-row::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #d8d1c4; }
        .fd-row:first-of-type::after { background: var(--fd-accent); }
      `}</style>
      <div className="fd-page" aria-hidden={open}>
        <span className="fd-kicker">LIBRARY</span>
        <span className="fd-h">Studio<span style={{ color: accent }}>.</span></span>
        <div className="fd-blocks">{[0, 1, 2, 3].map((i) => <div key={i} className="fd-block" />)}</div>
      </div>
      <div ref={shade} className="fd-shade" aria-hidden="true" onClick={() => settle(0)} />
      <div
        ref={sheet}
        className="fd-sheet"
        role="region"
        aria-label={title}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
      >
        <button
          type="button"
          className="fd-handle"
          aria-expanded={open}
          aria-label={`${title}. ${open ? 'Close' : 'Open'} drawer`}
          onClick={(e) => { if (e.detail === 0) toggle() }}
        >
          <span className="fd-bar" aria-hidden="true" />
          <span className="fd-title" aria-hidden="true"><span className="fd-t">{title}</span><span className="fd-s">{open ? 'DRAG DOWN' : 'DRAG UP'}</span></span>
        </button>
        <div className="fd-body" aria-hidden={!open}>
          {!bottom && <span className="fd-t">{title}</span>}
          {rows.map((r) => <div key={r} className="fd-row">{r}</div>)}
        </div>
      </div>
    </div>
  )
}
