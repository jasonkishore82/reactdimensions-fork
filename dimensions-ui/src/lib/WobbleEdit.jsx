import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Long-press to edit: press and hold any tile and a ring fills around it; once
// it completes (after `holdMs`) every tile starts to wobble, each with its own
// small random phase, and delete badges pop in. Tap a badge to remove a tile;
// the rest slide into the gap. Done, Escape or a tap on empty space leaves
// edit mode. Keyboard: hold Enter or Space on a tile to enter edit mode, then
// Delete or Backspace removes the focused tile. Under reduced motion the tiles
// stay still and changes happen instantly.

const APPS = [
  { name: 'Orbit', bg: ['#ff8a5c', '#ff4d1a'], g: 'orbit' },
  { name: 'Grid', bg: ['#5fb3a9', '#2a9d8f'], g: 'grid' },
  { name: 'Wave', bg: ['#6d8bd6', '#3a56a8'], g: 'wave' },
  { name: 'Prism', bg: ['#f2cc6b', '#e0a43a'], g: 'tri' },
  { name: 'Focus', bg: ['#a97de0', '#7b2cbf'], g: 'target' },
  { name: 'Stats', bg: ['#7fbf6a', '#4f8a3c'], g: 'bars' },
  { name: 'Cube', bg: ['#5a6474', '#2b2d42'], g: 'cube' },
  { name: 'Spark', bg: ['#f58fa8', '#ef476f'], g: 'plus' },
  { name: 'Night', bg: ['#4b5d9e', '#1d2a5c'], g: 'moon' },
  { name: 'Drop', bg: ['#6cc8e0', '#1f8fb0'], g: 'drop' },
  { name: 'Halo', bg: ['#d9b48a', '#a8784a'], g: 'ring' },
  { name: 'Leaf', bg: ['#9fcf8a', '#5a9a4a'], g: 'leaf' },
]

const glyph = (g) => {
  const p = { fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (g) {
    case 'orbit': return <><circle cx="12" cy="12" r="3" fill="#fff" /><ellipse {...p} cx="12" cy="12" rx="9" ry="4" transform="rotate(-25 12 12)" /></>
    case 'grid': return <><rect {...p} x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect {...p} x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect {...p} x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" fill="#fff" /></>
    case 'wave': return <path {...p} d="M3 14c3-5 6-5 9 0s6 5 9 0M3 9c3-5 6-5 9 0s6 5 9 0" />
    case 'tri': return <path {...p} d="M12 4 21 19H3Z" />
    case 'target': return <><circle {...p} cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="#fff" /></>
    case 'bars': return <path {...p} d="M5 20V12M10 20V6M15 20v-9M20 20V9" />
    case 'cube': return <path {...p} d="M12 3 20 7.5v9L12 21l-8-4.5v-9ZM12 12l8-4.5M12 12 4 7.5M12 12v9" />
    case 'plus': return <path {...p} d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11" strokeWidth="1.6" />
    case 'moon': return <path d="M15.5 3.5A8.5 8.5 0 1 0 20.5 16 7 7 0 0 1 15.5 3.5Z" fill="#fff" />
    case 'drop': return <path {...p} d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" />
    case 'ring': return <><circle {...p} cx="12" cy="12" r="7.5" strokeWidth="3" /><circle cx="17.3" cy="6.7" r="2" fill="#fff" /></>
    default: return <path {...p} d="M5 19C5 10 11 5 20 4c-1 9-6 15-15 15ZM5 19l8-8" />
  }
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function WobbleEdit({
  count = 9,
  holdMs = 500,
  wobble = 2,
  tile = 56,
  tileRadius = 14,
  accent = '#ff4d1a',
  color = '#f4f1ea',
  textColor = '#1c1a16',
  title = 'Home',
  style,
}) {
  const n = Math.max(1, Math.min(APPS.length, Math.round(count)))
  const make = () => Array.from({ length: n }, (_, i) => ({ id: `${i}-${Math.random().toString(36).slice(2, 7)}`, app: i }))
  const [tiles, setTiles] = useState(make)
  const [editing, setEditing] = useState(false)
  const [holding, setHolding] = useState(null)
  const [removing, setRemoving] = useState(() => new Set())
  const hold = useRef(null)
  const cells = useRef(new Map())
  const buttons = useRef(new Map())
  const phases = useRef(new Map())
  const flip = useRef(null)
  const focusNext = useRef(null)
  const timers = useRef(new Set())
  const done = useRef(null)

  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.current.delete(t); fn() }, ms)
    timers.current.add(t)
    return t
  }
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear() }, [])

  // reset when the tile count control changes
  const lastN = useRef(n)
  useEffect(() => {
    if (lastN.current === n) return
    lastN.current = n
    setTiles(make())
    setEditing(false)
  }, [n]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editing) return
    const onKey = (e) => { if (e.key === 'Escape') setEditing(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  useEffect(() => { if (editing && tiles.length === 0) setEditing(false) }, [editing, tiles.length])

  // slide the remaining tiles into place after one is removed
  useLayoutEffect(() => {
    const from = flip.current
    flip.current = null
    if (from) {
      cells.current.forEach((node, id) => {
        const a = from.get(id)
        if (!a) return
        const b = node.getBoundingClientRect()
        const dx = a.left - b.left
        const dy = a.top - b.top
        if (!dx && !dy) return
        node.style.transition = 'none'
        node.style.transform = `translate(${dx}px, ${dy}px)`
        node.getBoundingClientRect() // commit the inverted position
        node.style.transition = 'transform 420ms cubic-bezier(.34,1.3,.64,1)'
        node.style.transform = ''
      })
    }
    if (focusNext.current) {
      const target = focusNext.current === 'done' ? done.current : buttons.current.get(focusNext.current)
      focusNext.current = null
      target?.focus()
    }
  }, [tiles])

  const phase = (id) => {
    if (!phases.current.has(id)) phases.current.set(id, { dur: 0.22 + Math.random() * 0.08, delay: -Math.random() * 0.3, dir: Math.random() < 0.5 ? 1 : -1 })
    return phases.current.get(id)
  }

  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer)
    hold.current = null
    setHolding(null)
  }
  const beginHold = (id, x, y) => {
    cancelHold()
    setHolding(id)
    const timer = later(() => {
      hold.current = null
      setHolding(null)
      setEditing(true)
      navigator.vibrate?.(12)
    }, holdMs)
    hold.current = { id, x, y, timer }
  }

  const remove = (id, viaKey) => {
    const i = tiles.findIndex((t) => t.id === id)
    if (viaKey) focusNext.current = tiles[i + 1]?.id ?? tiles[i - 1]?.id ?? 'done'
    const commit = () => {
      const rects = new Map()
      cells.current.forEach((node, k) => rects.set(k, node.getBoundingClientRect()))
      flip.current = reduced() ? null : rects
      setTiles((ts) => ts.filter((t) => t.id !== id))
      setRemoving((s) => { const nx = new Set(s); nx.delete(id); return nx })
    }
    if (reduced()) { commit(); return }
    setRemoving((s) => new Set(s).add(id))
    later(commit, 200)
  }

  const reset = () => { setTiles(make()); setEditing(false) }

  return (
    <div
      className={editing ? 'wbe wbe-editing' : 'wbe'}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => { if (editing && e.target === e.currentTarget) setEditing(false) }}
      style={{ background: color, color: textColor, '--acc': accent, '--tile': `${tile}px`, '--rad': `${tileRadius}px`, '--wob': `${wobble}deg`, ...style }}
    >
      <style>{`
        .wbe { position: relative; width: 100%; height: 100%; overflow: auto; padding: 14px 16px 18px; box-sizing: border-box; font-family: system-ui, sans-serif; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
        .wbe-head { display: flex; align-items: center; gap: 10px; min-height: 32px; margin-bottom: 14px; pointer-events: none; }
        .wbe-head > * { pointer-events: auto; }
        .wbe-title { font: 400 24px/1 Georgia, 'Times New Roman', serif; margin-right: auto; pointer-events: none; }
        .wbe-hint { font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; opacity: .55; pointer-events: none; }
        .wbe-act { border: 0; border-radius: 999px; padding: 8px 14px; font: 600 13px/1 system-ui, sans-serif; cursor: pointer; outline: none; animation: wbe-pop 360ms cubic-bezier(.34,1.56,.64,1); }
        .wbe-act:focus-visible, .wbe-btn:focus-visible .wbe-icon, .wbe-x:focus-visible { box-shadow: 0 0 0 3px #f4f1ea, 0 0 0 6px var(--acc); }
        .wbe-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--tile) + 18px), 1fr)); gap: 16px 8px; pointer-events: none; }
        .wbe-cell { display: grid; justify-items: center; pointer-events: auto; }
        .wbe-out { transition: transform 200ms ease-in, opacity 200ms ease-in; }
        .wbe-out.wbe-gone { transform: scale(.2); opacity: 0; }
        .wbe-wob { position: relative; display: grid; justify-items: center; gap: 6px; transform-origin: 50% 40%; }
        .wbe-editing .wbe-wob { animation: wbe-wobble var(--d) ease-in-out var(--delay) infinite alternate; }
        .wbe-btn { border: 0; padding: 0; background: none; color: inherit; cursor: pointer; outline: none; display: grid; justify-items: center; gap: 6px; touch-action: manipulation; }
        .wbe-icon { position: relative; width: var(--tile); height: var(--tile); border-radius: var(--rad); display: grid; place-items: center; box-shadow: 0 6px 14px -8px rgba(20,18,14,.6), inset 0 1px 0 rgba(255,255,255,.25); transition: transform 300ms cubic-bezier(.34,1.56,.64,1); animation: wbe-pop 420ms cubic-bezier(.34,1.56,.64,1) backwards; }
        .wbe-holding .wbe-icon { transform: scale(.9); transition: transform var(--hold) cubic-bezier(.2,.8,.2,1); }
        .wbe-ring { position: absolute; inset: -5px; overflow: visible; pointer-events: none; }
        .wbe-ring rect { fill: none; stroke: var(--acc); stroke-width: 3; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: wbe-fill var(--hold) linear forwards; }
        .wbe-label { font: 500 11px/1.1 system-ui, sans-serif; opacity: .8; max-width: calc(var(--tile) + 16px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wbe-x { position: absolute; left: -7px; top: -7px; z-index: 1; width: 22px; height: 22px; border-radius: 50%; border: 0; padding: 0; background: #3a372f; color: #fff; display: grid; place-items: center; cursor: pointer; outline: none; box-shadow: 0 2px 6px rgba(0,0,0,.3); touch-action: manipulation; animation: wbe-pop 340ms cubic-bezier(.34,1.8,.5,1) backwards; }
        .wbe-x::after { content: ''; position: absolute; inset: -8px; }
        .wbe-empty { grid-column: 1 / -1; padding: 30px 0; text-align: center; font: 500 12px/1.4 system-ui, sans-serif; opacity: .55; }
        @keyframes wbe-wobble { from { transform: rotate(calc(var(--wob) * var(--dir) * -1)) translateY(-.5px) } to { transform: rotate(calc(var(--wob) * var(--dir))) translateY(.5px) } }
        @keyframes wbe-pop { from { transform: scale(.3); opacity: 0 } }
        @keyframes wbe-fill { to { stroke-dashoffset: 0 } }
        @media (prefers-reduced-motion: reduce) {
          .wbe-editing .wbe-wob, .wbe-icon, .wbe-x, .wbe-act { animation: none; }
          .wbe-out, .wbe-icon, .wbe-holding .wbe-icon { transition: none; }
          .wbe-holding .wbe-icon { transform: none; }
        }
      `}</style>

      <div className="wbe-head">
        <span className="wbe-title">{title}</span>
        {editing ? (
          <button ref={done} type="button" className="wbe-act" onClick={() => setEditing(false)} style={{ background: accent, color: '#fff' }}>Done</button>
        ) : tiles.length < n ? (
          <button ref={done} type="button" className="wbe-act" onClick={reset} style={{ background: 'rgba(28,26,22,.08)', color: textColor }}>Reset</button>
        ) : (
          <span className="wbe-hint">Hold a tile</span>
        )}
      </div>

      <div className="wbe-grid" role="list" aria-label={editing ? `${title}, editing` : title}>
        {tiles.map((t) => {
          const app = APPS[t.app]
          const ph = phase(t.id)
          const isHolding = holding === t.id
          return (
            <div key={t.id} role="listitem" className="wbe-cell" ref={(node) => (node ? cells.current.set(t.id, node) : cells.current.delete(t.id))}>
              <div className={removing.has(t.id) ? 'wbe-out wbe-gone' : 'wbe-out'}>
                <div className={isHolding ? 'wbe-wob wbe-holding' : 'wbe-wob'} style={{ '--d': `${ph.dur}s`, '--delay': `${ph.delay}s`, '--dir': ph.dir, '--hold': `${holdMs}ms` }}>
                  {editing && (
                    <button type="button" className="wbe-x" aria-label={`Remove ${app.name}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => remove(t.id, e.detail === 0)}>
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    </button>
                  )}
                  <button
                    ref={(node) => (node ? buttons.current.set(t.id, node) : buttons.current.delete(t.id))}
                    type="button"
                    className="wbe-btn"
                    aria-label={editing ? `${app.name}. Delete to remove.` : `${app.name}. Press and hold to edit.`}
                    onPointerDown={(e) => {
                      if (editing || (e.pointerType === 'mouse' && e.button !== 0)) return
                      beginHold(t.id, e.clientX, e.clientY)
                    }}
                    onPointerMove={(e) => {
                      const h = hold.current
                      if (h && h.x != null && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 8) cancelHold()
                    }}
                    onPointerUp={cancelHold}
                    onPointerCancel={cancelHold}
                    onPointerLeave={cancelHold}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !editing) { e.preventDefault(); if (!e.repeat) beginHold(t.id, null, null) }
                      if ((e.key === 'Delete' || e.key === 'Backspace') && editing) { e.preventDefault(); remove(t.id, true) }
                    }}
                    onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') cancelHold() }}
                    onBlur={cancelHold}
                  >
                    <span className="wbe-icon" style={{ background: `linear-gradient(160deg, ${app.bg[0]}, ${app.bg[1]})` }}>
                      <svg width={tile * 0.46} height={tile * 0.46} viewBox="0 0 24 24" aria-hidden="true">{glyph(app.g)}</svg>
                      {isHolding && (
                        <svg className="wbe-ring" width={tile + 10} height={tile + 10} aria-hidden="true">
                          <rect x="1.5" y="1.5" width={tile + 7} height={tile + 7} rx={tileRadius + 4} pathLength="1" />
                        </svg>
                      )}
                    </span>
                    <span className="wbe-label">{app.name}</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {tiles.length === 0 && <div className="wbe-empty">All tiles removed.</div>}
      </div>
    </div>
  )
}
