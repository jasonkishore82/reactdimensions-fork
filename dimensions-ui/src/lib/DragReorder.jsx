import { useEffect, useId, useRef, useState } from 'react'

// Drag to reorder: grab a row and it lifts off the list and follows the
// pointer. As it crosses its neighbours they slide out of the way on springs,
// and a dashed ghost marks the slot it will drop into. Let go and it springs
// home. Dragging past the first or last slot meets rubber-band resistance.
// From the keyboard, arrow keys move between rows; Space lifts a row, arrows
// move it and Space drops it (Escape puts it back), or Alt plus an arrow moves
// it in one step. Under reduced motion rows jump straight to their slots.

const DEFAULT_ITEMS = ['Sketch the idea', 'Block out the model', 'Light the scene', 'Render a turntable', 'Ship it']

export default function DragReorder({
  items = DEFAULT_ITEMS,
  itemHeight = 52,
  gap = 8,
  stiffness = 380,
  damping = 32,
  lift = 1.04,
  accent = '#ff4d1a',
  color = '#fffdf8',
  textColor = '#1c1a16',
  background = '#f4f1ea',
  onChange,
  style,
}) {
  const uid = useId()
  const key = items.join('\u0000')
  const [order, setOrder] = useState(() => items.map((_, i) => i))
  const [active, setActive] = useState(0)
  const [grab, setGrab] = useState(null)
  const [msg, setMsg] = useState('')
  const list = useRef(null)
  const ghost = useRef(null)
  const els = useRef([])
  const s = useRef({ order: order, bodies: [], drag: null, grab: null, grabFrom: 0, top: -1, gy: 0, gv: 0, key: '' })
  const pitch = itemHeight + gap
  const n = items.length

  // Reset when the item list itself changes.
  if (s.current.key !== key) {
    const fresh = items.map((_, i) => i)
    s.current.key = key
    s.current.order = fresh
    s.current.bodies = fresh.map((i) => ({ y: i * pitch, vy: 0, sc: 1, vs: 0 }))
    s.current.drag = null
    s.current.grab = null
    if (order.length !== fresh.length || order.some((v, i) => v !== fresh[i])) setOrder(fresh)
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
      p.bodies.forEach((b, id) => {
        const held = p.drag?.id === id
        const lifted = held || p.grab === id
        if (!held) {
          const ty = p.order.indexOf(id) * pitch
          if (reduce) { b.y = ty; b.vy = 0 } else {
            b.vy += (-stiffness * (b.y - ty) - damping * b.vy) * dt
            b.y += b.vy * dt
            if (Math.abs(b.y - ty) < 0.05 && Math.abs(b.vy) < 0.5) { b.y = ty; b.vy = 0 }
          }
        }
        const ts = lifted ? lift : 1
        if (reduce) { b.sc = ts; b.vs = 0 } else {
          b.vs += (-520 * (b.sc - ts) - 28 * b.vs) * dt
          b.sc += b.vs * dt
        }
        const el = els.current[id]
        if (el) {
          el.style.transform = `translate3d(0, ${b.y.toFixed(2)}px, 0) scale(${b.sc.toFixed(4)})`
          el.style.zIndex = lifted ? 3 : id === p.top ? 2 : 1
        }
      })
      const g = ghost.current
      if (g) {
        if (p.drag) {
          const ty = p.order.indexOf(p.drag.id) * pitch
          if (reduce) { p.gy = ty; p.gv = 0 } else {
            p.gv += (-stiffness * 1.4 * (p.gy - ty) - damping * 1.2 * p.gv) * dt
            p.gy += p.gv * dt
          }
          g.style.transform = `translate3d(0, ${p.gy.toFixed(2)}px, 0)`
        }
        g.style.opacity = p.drag ? 1 : 0
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [pitch, stiffness, damping, lift])

  const announce = (id, slot) => setMsg(`${items[id]}, position ${slot + 1} of ${n}`)
  const commit = (next) => {
    s.current.order = next
    setOrder(next)
  }
  const moveTo = (id, slot) => {
    const p = s.current
    const next = p.order.filter((x) => x !== id)
    next.splice(slot, 0, id)
    commit(next)
  }
  const emit = () => onChange?.(s.current.order.map((i) => items[i]))

  const rubber = (d) => {
    const max = itemHeight * 0.6
    return (1 - 1 / (d / max + 1)) * max
  }

  const down = (id) => (e) => {
    if (e.button !== 0 || s.current.grab != null) return
    const p = s.current
    const b = p.bodies[id]
    const r = list.current.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus({ preventScroll: true })
    p.drag = { id, from: p.order.indexOf(id), oy: e.clientY - r.top - b.y, hist: [{ y: e.clientY, t: performance.now() }] }
    p.top = id
    p.gy = b.y
    p.gv = 0
    b.vy = 0
    setActive(id)
    e.currentTarget.classList.add('dr-on')
  }
  const move = (e) => {
    const p = s.current
    const d = p.drag
    if (!d) return
    const r = list.current.getBoundingClientRect()
    const maxY = (n - 1) * pitch
    let y = e.clientY - r.top - d.oy
    if (y < 0) y = -rubber(-y)
    else if (y > maxY) y = maxY + rubber(y - maxY)
    p.bodies[d.id].y = y
    d.hist.push({ y: e.clientY, t: performance.now() })
    if (d.hist.length > 6) d.hist.shift()
    const slot = Math.max(0, Math.min(n - 1, Math.round(y / pitch)))
    if (slot !== p.order.indexOf(d.id)) moveTo(d.id, slot)
  }
  const up = (e) => {
    const p = s.current
    const d = p.drag
    if (!d) return
    p.drag = null
    e.currentTarget.classList.remove('dr-on')
    const a = d.hist[0]
    const c = d.hist[d.hist.length - 1]
    const dt = Math.max(0.016, (c.t - a.t) / 1000)
    p.bodies[d.id].vy = Math.max(-2000, Math.min(2000, (c.y - a.y) / dt))
    const slot = p.order.indexOf(d.id)
    if (slot !== d.from) { announce(d.id, slot); emit() }
  }

  const key_ = (id) => (e) => {
    const p = s.current
    const slot = p.order.indexOf(id)
    const dir = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    const focusId = (fid) => { setActive(fid); els.current[fid]?.focus() }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (p.grab === id) {
        p.grab = null
        setGrab(null)
        setMsg(`Dropped ${items[id]} at position ${slot + 1} of ${n}`)
        if (slot !== p.grabFrom) emit()
      } else if (e.key === ' ') {
        p.grab = id
        p.grabFrom = slot
        p.top = id
        setGrab(id)
        setMsg(`Lifted ${items[id]}, position ${slot + 1} of ${n}. Arrow keys to move, Space to drop, Escape to cancel.`)
      }
      return
    }
    if (e.key === 'Escape' && p.grab === id) {
      e.preventDefault()
      moveTo(id, p.grabFrom)
      p.grab = null
      setGrab(null)
      setMsg(`Cancelled. ${items[id]} back at position ${p.grabFrom + 1} of ${n}`)
      return
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      const to = e.key === 'Home' ? 0 : n - 1
      if (p.grab === id || e.altKey) { moveTo(id, to); p.top = id; announce(id, to); if (p.grab !== id) emit() }
      else focusId(p.order[to])
      return
    }
    if (!dir) return
    e.preventDefault()
    const to = slot + dir
    if (to < 0 || to >= n) {
      // a small nudge against the end of the list
      if ((p.grab === id || e.altKey) && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) p.bodies[id].vy += dir * 260
      return
    }
    if (p.grab === id || e.altKey) {
      p.top = id
      moveTo(id, to)
      announce(id, to)
      if (p.grab !== id) emit()
    } else focusId(p.order[to])
  }

  const tabStop = order.includes(active) ? active : order[0]

  return (
    <div className="dr" style={{ '--dr-accent': accent, '--dr-bg': background, '--dr-item': color, '--dr-ink': textColor, ...style }}>
      <style>{`
        .dr { position: relative; width: 100%; height: 100%; min-height: 200px; background: var(--dr-bg); display: grid; place-items: center; overflow: hidden; user-select: none; -webkit-user-select: none; }
        .dr-list { position: relative; width: min(340px, calc(100% - 32px)); margin: 0; padding: 0; list-style: none; }
        .dr-item { position: absolute; left: 0; right: 0; top: 0; box-sizing: border-box; display: flex; align-items: center; gap: 12px; padding: 0 14px; border-radius: 12px; background: var(--dr-item); color: var(--dr-ink); border: 1px solid rgba(0,0,0,.08); box-shadow: 0 1px 2px rgba(20,18,14,.06); cursor: grab; touch-action: none; will-change: transform; outline: none; transition: box-shadow 220ms cubic-bezier(.2,.8,.2,1); -webkit-tap-highlight-color: transparent; }
        .dr-item.dr-on, .dr-item[data-lifted='true'] { cursor: grabbing; box-shadow: 0 18px 32px -14px rgba(20,18,14,.45), 0 2px 6px rgba(20,18,14,.1); }
        .dr-item:focus-visible { box-shadow: 0 0 0 3px var(--dr-accent), 0 1px 2px rgba(20,18,14,.06); }
        .dr-item[data-lifted='true']:focus-visible { box-shadow: 0 0 0 3px var(--dr-accent), 0 18px 32px -14px rgba(20,18,14,.45); }
        .dr-grip { flex: none; color: #b3ac9f; }
        .dr-item.dr-on .dr-grip, .dr-item[data-lifted='true'] .dr-grip { color: var(--dr-accent); }
        .dr-num { flex: none; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; color: #8e887c; font-variant-numeric: tabular-nums; }
        .dr-label { flex: 1; min-width: 0; font: 400 17px/1.1 Georgia, 'Times New Roman', serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dr-ghost { position: absolute; left: 0; right: 0; top: 0; box-sizing: border-box; border-radius: 12px; border: 1.5px dashed var(--dr-accent); background: color-mix(in srgb, var(--dr-accent) 8%, transparent); opacity: 0; transition: opacity 160ms; pointer-events: none; z-index: 0; }
        .dr-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        @media (prefers-reduced-motion: reduce) { .dr-item, .dr-ghost { transition: none; } }
      `}</style>
      <ul ref={list} className="dr-list" role="list" style={{ height: n * pitch - gap }} onPointerMove={move}>
        <li ref={ghost} className="dr-ghost" aria-hidden="true" style={{ height: itemHeight }} />
        {items.map((label, id) => {
          const slot = order.indexOf(id)
          return (
            <li
              key={id}
              ref={(el) => (els.current[id] = el)}
              className="dr-item"
              tabIndex={id === tabStop ? 0 : -1}
              aria-roledescription="sortable item"
              aria-describedby={`${uid}-hint`}
              aria-posinset={slot + 1}
              aria-setsize={n}
              data-lifted={grab === id}
              onPointerDown={down(id)}
              onPointerUp={up}
              onPointerCancel={up}
              onLostPointerCapture={up}
              onKeyDown={key_(id)}
              onFocus={() => setActive(id)}
              onBlur={() => {
                if (s.current.grab === id) { s.current.grab = null; setGrab(null); if (s.current.order.indexOf(id) !== s.current.grabFrom) emit() }
              }}
              style={{ height: itemHeight }}
            >
              <svg className="dr-grip" width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
                {[2, 8, 14].map((cy) => [2, 8].map((cx) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="1.6" fill="currentColor" />))}
              </svg>
              <span className="dr-num" aria-hidden="true">{String(slot + 1).padStart(2, '0')}</span>
              <span className="dr-label">{label}</span>
            </li>
          )
        })}
      </ul>
      <span id={`${uid}-hint`} className="dr-sr">Arrow keys move between rows. Space lifts a row, arrow keys move it, Space drops it, Escape cancels. Alt plus arrow keys moves a row directly.</span>
      <span className="dr-sr" aria-live="polite">{msg}</span>
    </div>
  )
}
