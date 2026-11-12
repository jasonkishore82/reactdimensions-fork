import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Hold to preview: press and hold a row and, after `holdMs`, an enlarged
// preview card springs up out of the row's position while the rest of the
// list dims. Let go and it springs back into the row. Moving the finger away
// before the preview opens cancels it, so the list still scrolls and taps
// normally. Keyboard: hold Enter or Space on a row to preview, release to
// close; Escape also closes. Under reduced motion the preview simply appears
// and disappears.

const ITEMS = [
  { title: 'Basalt lounge chair', meta: 'Furniture · 4 min read', bg: ['#ff8a5c', '#ff4d1a'], shape: 'arch', body: 'A low chair cut from a single slab of foam and wrapped in felt, with a seat that tips back just enough to read in.' },
  { title: 'Tidal lamp', meta: 'Lighting · 2 min read', bg: ['#5fb3a9', '#1d6b63'], shape: 'circle', body: 'A frosted globe that dims slowly over an hour, following the curve of a falling tide.' },
  { title: 'Dune side table', meta: 'Furniture · 3 min read', bg: ['#f2cc6b', '#c98a2e'], shape: 'stack', body: 'Three stacked discs of oiled oak, each turned a little off-centre so the table looks like drifting sand.' },
  { title: 'Moss rug', meta: 'Textiles · 5 min read', bg: ['#9fcf8a', '#4f8a3c'], shape: 'waves', body: 'Hand-tufted wool in seven greens, cut to different heights so it feels like walking on a forest floor.' },
  { title: 'Dusk vase', meta: 'Objects · 1 min read', bg: ['#a97de0', '#4a1f80'], shape: 'vase', body: 'Glazed stoneware with a gradient that runs from violet at the lip to near black at the foot.' },
]

const art = (shape) => {
  const w = { fill: 'rgba(255,255,255,.85)' }
  switch (shape) {
    case 'arch': return <path {...w} d="M30 90V55a20 20 0 0 1 40 0v35h-10V58a10 10 0 0 0-20 0v32Z" />
    case 'circle': return <><circle cx="50" cy="48" r="22" {...w} /><rect x="47" y="70" width="6" height="20" {...w} /></>
    case 'stack': return <><ellipse cx="50" cy="40" rx="26" ry="7" {...w} /><ellipse cx="46" cy="58" rx="22" ry="6" {...w} opacity=".7" /><ellipse cx="53" cy="74" rx="18" ry="5" {...w} opacity=".5" /></>
    case 'waves': return <path d="M14 46c12-10 24-10 36 0s24 10 36 0M14 62c12-10 24-10 36 0s24 10 36 0M14 78c12-10 24-10 36 0s24 10 36 0" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="5" strokeLinecap="round" />
    default: return <path {...w} d="M42 22h16v8c10 6 14 16 14 28 0 16-10 32-22 32S28 74 28 58c0-12 4-22 14-28Z" />
  }
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function HoldPreview({
  holdMs = 380,
  stiffness = 320,
  damping = 22,
  previewWidth = 260,
  tolerance = 10,
  accent = '#ff4d1a',
  color = '#f4f1ea',
  cardColor = '#ffffff',
  textColor = '#1c1a16',
  style,
}) {
  const [shown, setShown] = useState(null) // item index in the preview card
  const [pressing, setPressing] = useState(null) // item index waiting for the hold
  const area = useRef(null)
  const card = useRef(null)
  const back = useRef(null)
  const rows = useRef([])
  const geo = useRef(null)
  const hold = useRef(null)
  const shownRef = useRef(null)
  const cfg = useRef({ stiffness, damping })
  cfg.current = { stiffness, damping }
  const s = useRef({ t: 0, v: 0, target: 0, raf: 0, last: 0 })

  const apply = () => {
    const { t } = s.current
    const g = geo.current
    if (back.current) back.current.style.opacity = String(Math.max(0, Math.min(1, t)))
    if (!card.current || !g) return
    const k = 1 - t
    card.current.style.transform = `translate(${g.dx * k}px, ${g.dy * k}px) scale(${g.s0 + (1 - g.s0) * t})`
    card.current.style.opacity = String(Math.max(0, Math.min(1, t * 2.4)))
  }

  const settle = () => {
    const p = s.current
    p.t = p.target
    p.v = 0
    apply()
    if (p.target === 0) { shownRef.current = null; setShown(null) }
  }

  const run = () => {
    const p = s.current
    if (reduced()) { cancelAnimationFrame(p.raf); p.raf = 0; settle(); return }
    if (p.raf) return
    p.last = performance.now()
    const tick = (now) => {
      const dt = Math.min((now - p.last) / 1000, 1 / 30)
      p.last = now
      p.v += (-cfg.current.stiffness * (p.t - p.target) - cfg.current.damping * p.v) * dt
      p.t += p.v * dt
      if (Math.abs(p.t - p.target) < 0.001 && Math.abs(p.v) < 0.01) { p.raf = 0; settle(); return }
      apply()
      p.raf = requestAnimationFrame(tick)
    }
    p.raf = requestAnimationFrame(tick)
  }

  const open = (i) => {
    s.current.target = 1
    navigator.vibrate?.(10)
    if (shownRef.current === i) run()
    else { shownRef.current = i; setShown(i) }
  }
  const close = () => {
    if (shownRef.current == null) return
    s.current.target = 0
    run()
  }

  // measure the row and the card, then spring from one to the other
  useLayoutEffect(() => {
    if (shown == null || !card.current || !area.current) return
    const a = area.current.getBoundingClientRect()
    const r = rows.current[shown].getBoundingClientRect()
    const c = card.current
    const cx = c.offsetLeft + c.offsetWidth / 2
    const cy = c.offsetTop + c.offsetHeight / 2
    geo.current = {
      dx: r.left - a.left + r.width / 2 - cx,
      dy: r.top - a.top + r.height / 2 - cy,
      s0: Math.max(0.3, Math.min(0.9, r.height / c.offsetHeight + 0.15)),
    }
    apply()
    run()
  }, [shown]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    cancelAnimationFrame(s.current.raf)
    if (hold.current) clearTimeout(hold.current.timer)
  }, [])

  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer)
    hold.current = null
    setPressing(null)
  }

  const down = (e, i) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    cancelHold()
    setPressing(i)
    const timer = setTimeout(() => { hold.current = { ...hold.current, opened: true }; setPressing(null); open(i) }, holdMs)
    hold.current = { x: e.clientX, y: e.clientY, timer, opened: false }
  }
  const move = (e) => {
    const h = hold.current
    if (h && !h.opened && Math.hypot(e.clientX - h.x, e.clientY - h.y) > tolerance) cancelHold()
  }
  const up = () => { cancelHold(); close() }

  const key = (e, i) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); open(i) }
    if (e.key === 'Escape') close()
  }
  const keyUp = (e) => { if (e.key === 'Enter' || e.key === ' ') close() }

  const item = shown != null ? ITEMS[shown] : null

  return (
    <div ref={area} className="hdp" onContextMenu={(e) => e.preventDefault()} style={{ background: color, color: textColor, '--acc': accent, '--hold': `${holdMs}ms`, ...style }}>
      <style>{`
        .hdp { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: system-ui, sans-serif; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
        .hdp-list { position: absolute; inset: 0; overflow: auto; padding: 14px; box-sizing: border-box; display: grid; align-content: start; gap: 6px; }
        .hdp-head { font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; opacity: .55; padding: 2px 4px 8px; }
        .hdp-row { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px; border: 0; border-radius: 12px; background: transparent; color: inherit; text-align: left; cursor: pointer; outline: none; touch-action: pan-y; overflow: hidden; transition: transform 320ms cubic-bezier(.34,1.56,.64,1), background 200ms, opacity 200ms; }
        .hdp-row:hover { background: rgba(28,26,22,.05); }
        .hdp-row:focus-visible { box-shadow: 0 0 0 3px var(--acc); }
        .hdp-row.hdp-press { transform: scale(.97); background: rgba(28,26,22,.08); transition: transform var(--hold) cubic-bezier(.2,.8,.2,1), background 200ms; }
        .hdp-row.hdp-press::after { content: ''; position: absolute; left: 8px; right: 8px; bottom: 2px; height: 2px; border-radius: 2px; background: var(--acc); transform-origin: 0 50%; animation: hdp-fill var(--hold) linear forwards; }
        .hdp-row.hdp-lifted { opacity: .25; }
        .hdp-thumb { flex: none; width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center; }
        .hdp-text { min-width: 0; display: grid; gap: 4px; }
        .hdp-title { font: 600 14px/1.15 system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hdp-meta { font: 400 12px/1 system-ui, sans-serif; opacity: .6; }
        .hdp-back { position: absolute; inset: 0; background: rgba(28,26,22,.42); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); opacity: 0; pointer-events: none; }
        .hdp-stage { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
        .hdp-card { position: relative; border-radius: 18px; overflow: hidden; box-shadow: 0 30px 60px -20px rgba(20,18,14,.55); opacity: 0; will-change: transform, opacity; }
        .hdp-hero { height: 140px; display: grid; place-items: center; }
        .hdp-body { padding: 14px 16px 16px; display: grid; gap: 6px; }
        .hdp-body b { font: 400 22px/1.05 Georgia, 'Times New Roman', serif; }
        .hdp-body p { margin: 0; font: 400 12.5px/1.5 system-ui, sans-serif; opacity: .72; }
        .hdp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        @keyframes hdp-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        @media (prefers-reduced-motion: reduce) { .hdp-row, .hdp-row.hdp-press { transition: none; transform: none; } }
      `}</style>

      <div className="hdp-list">
        <div className="hdp-head">Hold a row to preview</div>
        {ITEMS.map((it, i) => (
          <button
            key={it.title}
            ref={(n) => (rows.current[i] = n)}
            type="button"
            className={`hdp-row${pressing === i ? ' hdp-press' : ''}${shown === i ? ' hdp-lifted' : ''}`}
            aria-label={`${it.title}. Hold to preview.`}
            onPointerDown={(e) => down(e, i)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') up() }}
            onKeyDown={(e) => key(e, i)}
            onKeyUp={keyUp}
            onBlur={up}
          >
            <span className="hdp-thumb" style={{ background: `linear-gradient(150deg, ${it.bg[0]}, ${it.bg[1]})` }}>
              <svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true">{art(it.shape)}</svg>
            </span>
            <span className="hdp-text">
              <span className="hdp-title">{it.title}</span>
              <span className="hdp-meta">{it.meta}</span>
            </span>
          </button>
        ))}
      </div>

      <div ref={back} className="hdp-back" aria-hidden="true" />
      <div className="hdp-stage" aria-hidden="true">
        {item && (
          <div ref={card} className="hdp-card" style={{ width: `min(${previewWidth}px, calc(100% - 32px))`, background: cardColor }}>
            <div className="hdp-hero" style={{ background: `linear-gradient(150deg, ${item.bg[0]}, ${item.bg[1]})` }}>
              <svg width="96" height="96" viewBox="0 0 100 100">{art(item.shape)}</svg>
            </div>
            <div className="hdp-body">
              <span className="hdp-meta">{item.meta}</span>
              <b>{item.title}</b>
              <p>{item.body}</p>
            </div>
          </div>
        )}
      </div>
      <div className="hdp-sr" aria-live="polite">{item ? `Previewing ${item.title}: ${item.body}` : ''}</div>
    </div>
  )
}
