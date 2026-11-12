import { useEffect, useRef, useState } from 'react'

// Double-tap to like, single tap to open: a quick double tap on the photo pops
// a heart with a particle burst exactly where you tapped and toggles the like.
// A single tap waits out the double-tap window, then slides the details sheet
// up (tap again to close). The heart button in the sheet header likes too.
// Keyboard: Enter or Space opens, L likes, Escape closes. Under reduced motion
// the heart just fades in and out with no burst.

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const HEART = 'M12 21.2 10.6 20C5.4 15.4 2 12.4 2 8.6 2 5.5 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.5 22 8.6c0 3.8-3.4 6.8-8.6 11.4L12 21.2Z'

export default function DoubleTapLike({
  title = 'Low sun, Ridge 4',
  body = 'Shot at the last light of the day, when the far ridge turns flat and blue. Double tap the photo to like it; tap once to open or close this sheet.',
  likes = 128,
  doubleTapMs = 280,
  heartSize = 96,
  particles = 14,
  accent = '#ff4d1a',
  burstColor = '#ffd166',
  skyColor = '#f6c9a8',
  hillColor = '#2a3d45',
  sheetColor = '#f4f1ea',
  style,
}) {
  const [open, setOpen] = useState(false)
  const [liked, setLiked] = useState(false)
  const [bursts, setBursts] = useState([])
  const el = useRef(null)
  const likedRef = useRef(false)
  const press = useRef(null)
  const lastTap = useRef(null)
  const single = useRef(0)
  const timers = useRef(new Set())
  const uid = useRef(0)

  useEffect(() => () => {
    clearTimeout(single.current)
    timers.current.forEach(clearTimeout)
    timers.current.clear()
  }, [])

  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.current.delete(t); fn() }, ms)
    timers.current.add(t)
  }

  const toggleLike = (x, y) => {
    const next = !likedRef.current
    likedRef.current = next
    setLiked(next)
    const id = ++uid.current
    const parts = next && !reduced()
      ? Array.from({ length: particles }, (_, i) => {
          const a = (i / particles) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
          const d = heartSize * (0.55 + Math.random() * 0.45)
          return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, s: 5 + Math.random() * 5, c: i % 3 === 0 ? burstColor : accent }
        })
      : []
    setBursts((b) => [...b, { id, x, y, like: next, parts }])
    later(() => setBursts((b) => b.filter((p) => p.id !== id)), 1000)
  }

  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    press.current = { x: e.clientX, y: e.clientY, t: performance.now() }
  }
  const up = (e) => {
    const p = press.current
    press.current = null
    if (!p) return
    const now = performance.now()
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10 || now - p.t > 500) return
    const box = el.current.getBoundingClientRect()
    const x = e.clientX - box.left
    const y = e.clientY - box.top
    const last = lastTap.current
    if (last && now - last.t < doubleTapMs && Math.hypot(x - last.x, y - last.y) < 40) {
      clearTimeout(single.current)
      lastTap.current = null
      toggleLike(x, y)
    } else {
      lastTap.current = { t: now, x, y }
      clearTimeout(single.current)
      single.current = setTimeout(() => { lastTap.current = null; setOpen((o) => !o) }, doubleTapMs)
    }
  }

  const key = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) }
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'l' || e.key === 'L') {
      const box = el.current.getBoundingClientRect()
      toggleLike(box.width / 2, box.height / 2)
    }
  }

  const likeButton = (e) => {
    const box = el.current.getBoundingClientRect()
    const b = e.currentTarget.getBoundingClientRect()
    toggleLike(b.left - box.left + b.width / 2, b.top - box.top + b.height / 2)
  }

  return (
    <div ref={el} className="dtl" style={{ '--acc': accent, '--hs': `${heartSize}px`, background: skyColor, ...style }} onContextMenu={(e) => e.preventDefault()}>
      <style>{`
        .dtl { position: relative; width: 100%; height: 100%; min-height: 260px; overflow: hidden; isolation: isolate; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; font-family: system-ui, sans-serif; }
        .dtl-photo { position: absolute; inset: 0; cursor: pointer; outline: none; touch-action: manipulation; transition: transform 520ms cubic-bezier(.2,.8,.2,1), filter 520ms; }
        .dtl-photo:focus-visible { box-shadow: inset 0 0 0 3px var(--acc); }
        .dtl-open .dtl-photo { transform: scale(1.06) translateY(-4%); filter: saturate(.85); }
        .dtl-sun { position: absolute; left: 58%; top: 18%; width: 26%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, #fff6e8 0 40%, #ffd9a8 70%, rgba(255,217,168,0) 71%); }
        .dtl-hill { position: absolute; left: -5%; right: -5%; bottom: 0; }
        .dtl-sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 62%; border-radius: 18px 18px 0 0; box-shadow: 0 -10px 30px -16px rgba(20,18,14,.5); transform: translateY(calc(100% - 56px)); transition: transform 560ms cubic-bezier(.32,1.28,.6,1); z-index: 2; display: flex; flex-direction: column; color: #1c1a16; }
        .dtl-open .dtl-sheet { transform: translateY(0); }
        .dtl-bar { height: 56px; flex: none; display: flex; align-items: center; gap: 8px; padding: 0 10px 0 8px; }
        .dtl-btn { border: 0; background: none; padding: 8px; border-radius: 10px; cursor: pointer; color: inherit; display: grid; place-items: center; outline: none; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .dtl-btn:focus-visible { box-shadow: 0 0 0 3px var(--acc); }
        .dtl-btn svg { transition: transform 420ms cubic-bezier(.34,1.8,.5,1); }
        .dtl-btn[aria-pressed='true'] svg { transform: scale(1.12); }
        .dtl-count { font: 600 14px/1 system-ui, sans-serif; font-variant-numeric: tabular-nums; }
        .dtl-title { flex: 1; text-align: right; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; opacity: .55; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dtl-chev { transition: transform 420ms cubic-bezier(.34,1.56,.64,1); }
        .dtl-open .dtl-chev { transform: rotate(180deg); }
        .dtl-body { padding: 4px 18px 18px; overflow: auto; }
        .dtl-body h3 { margin: 0 0 8px; font: 400 26px/1.05 Georgia, 'Times New Roman', serif; }
        .dtl-body p { margin: 0; font: 400 13px/1.55 system-ui, sans-serif; opacity: .75; }
        .dtl-fx { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
        .dtl-burst { position: absolute; width: 0; height: 0; }
        .dtl-heart { position: absolute; left: calc(var(--hs) / -2); top: calc(var(--hs) / -2); width: var(--hs); height: var(--hs); filter: drop-shadow(0 6px 14px rgba(20,18,14,.35)); animation: dtl-pop 860ms cubic-bezier(.2,.8,.2,1) forwards; }
        .dtl-heart.dtl-un { animation: dtl-unpop 520ms ease-in forwards; }
        .dtl-ring { position: absolute; left: calc(var(--hs) / -2); top: calc(var(--hs) / -2); width: var(--hs); height: var(--hs); border-radius: 50%; border: 3px solid var(--acc); animation: dtl-ring 520ms cubic-bezier(.2,.8,.2,1) forwards; }
        .dtl-p { position: absolute; border-radius: 50%; animation: dtl-fly 680ms cubic-bezier(.12,.7,.3,1) 40ms both; }
        @keyframes dtl-pop { 0% { transform: scale(0); opacity: 0 } 14% { transform: scale(1.22); opacity: 1 } 28% { transform: scale(.92) } 42% { transform: scale(1.05) } 70% { transform: scale(1); opacity: 1 } 100% { transform: translateY(-18px) scale(1.06); opacity: 0 } }
        @keyframes dtl-unpop { from { transform: scale(1); opacity: .95 } to { transform: scale(.4); opacity: 0 } }
        @keyframes dtl-ring { from { transform: scale(.3); opacity: .9 } to { transform: scale(1.6); opacity: 0; border-width: 0 } }
        @keyframes dtl-fly { from { transform: translate(0, 0) scale(1); opacity: 1 } to { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0 } }
        @keyframes dtl-fade { 0% { opacity: 0 } 20%, 70% { opacity: 1 } 100% { opacity: 0 } }
        @media (prefers-reduced-motion: reduce) {
          .dtl-photo, .dtl-sheet, .dtl-btn svg, .dtl-chev { transition: none; }
          .dtl-open .dtl-photo { transform: none; }
          .dtl-heart, .dtl-heart.dtl-un { animation: dtl-fade 700ms linear forwards; }
          .dtl-ring, .dtl-p { display: none; }
        }
      `}</style>
      <div className={open ? 'dtl-open' : undefined} style={{ position: 'absolute', inset: 0 }}>
        <div
          className="dtl-photo"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={`${title}. Enter to ${open ? 'close' : 'open'} details, L to ${liked ? 'unlike' : 'like'}.`}
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={() => { press.current = null }}
          onKeyDown={key}
          style={{ background: `linear-gradient(180deg, ${skyColor} 0%, #f7e3c8 62%)` }}
        >
          <span className="dtl-sun" />
          <svg className="dtl-hill" viewBox="0 0 400 220" preserveAspectRatio="none" style={{ height: '62%' }} aria-hidden="true">
            <path d="M0 120 L70 70 L130 105 L210 40 L290 100 L340 72 L400 98 V220 H0Z" fill={hillColor} opacity=".35" />
            <path d="M0 160 L90 108 L160 140 L240 92 L320 150 L400 120 V220 H0Z" fill={hillColor} opacity=".65" />
            <path d="M0 196 L110 150 L200 178 L300 140 L400 172 V220 H0Z" fill={hillColor} />
          </svg>
        </div>

        <div className="dtl-sheet" style={{ background: sheetColor }}>
          <div className="dtl-bar">
            <button type="button" className="dtl-btn" aria-pressed={liked} aria-label={liked ? 'Unlike' : 'Like'} onClick={likeButton}>
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path d={HEART} fill={liked ? accent : 'none'} stroke={liked ? accent : 'currentColor'} strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="dtl-count" aria-live="polite">{(likes + (liked ? 1 : 0)).toLocaleString()}</span>
            <span className="dtl-title">{title}</span>
            <button type="button" className="dtl-btn" aria-expanded={open} aria-label={open ? 'Close details' : 'Open details'} onClick={() => setOpen((o) => !o)}>
              <svg className="dtl-chev" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M4 11 9 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="dtl-body" aria-hidden={!open}>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        </div>
      </div>

      <div className="dtl-fx" aria-hidden="true">
        {bursts.map((b) => (
          <div key={b.id} className="dtl-burst" style={{ left: b.x, top: b.y }}>
            {b.like && <span className="dtl-ring" />}
            {b.parts.map((p, i) => (
              <span key={i} className="dtl-p" style={{ left: -p.s / 2, top: -p.s / 2, width: p.s, height: p.s, background: p.c, '--dx': `${p.dx}px`, '--dy': `${p.dy}px` }} />
            ))}
            <svg className={b.like ? 'dtl-heart' : 'dtl-heart dtl-un'} viewBox="0 0 24 24">
              <path d={HEART} fill={b.like ? accent : 'none'} stroke={b.like ? 'none' : '#fff'} strokeWidth="1.6" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}
