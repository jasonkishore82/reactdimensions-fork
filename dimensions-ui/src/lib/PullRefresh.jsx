import { useEffect, useRef, useState } from 'react'

// Pull to refresh: the list scrolls on its own. When it is already at the top,
// dragging down further stretches it with rubber-band resistance and pulls a
// gooey drop down from the top edge; the drop thins as it stretches. Pull past
// the threshold and it fills in; let go there and it becomes a spinner, the
// list holds open while a short fake load runs, then a new item slides in at
// the top and everything springs back. Let go short of the threshold and it
// simply springs back. With the list focused, press R (or use the Refresh
// button that appears on focus). Under reduced motion it skips the springs.

const DEFAULT_ITEMS = [
  ['Render finished', 'turntable_04.mp4 is ready'],
  ['New comment', '“Love the lighting on this one”'],
  ['Model updated', 'chair_v3.glb · 2.4 MB'],
  ['Scene shared', 'Studio set with 3 people'],
  ['Export queued', 'Poster frames, 12 images'],
  ['Backup complete', 'All scenes saved'],
  ['Texture baked', 'oak_diffuse.png · 4K'],
  ['Review requested', 'Hero shot, second pass'],
]
const FRESH = [
  ['Fresh render', 'turntable_05.mp4 is ready'],
  ['New like', 'Someone liked “Chair study”'],
  ['Sync complete', 'Everything is up to date'],
  ['New follower', 'A studio started following you'],
]

export default function PullRefresh({
  items = DEFAULT_ITEMS,
  maxPull = 140,
  threshold = 70,
  resistance = 1,
  loadTime = 1.2,
  stiffness = 260,
  damping = 26,
  accent = '#ff4d1a',
  color = '#fffdf8',
  textColor = '#1c1a16',
  background = '#f4f1ea',
  onRefresh,
  style,
}) {
  const [rows, setRows] = useState(() => items.map(([t, d], i) => ({ id: `i${i}`, t, d, when: `${(i + 1) * 7}m` })))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const scroller = useRef(null)
  const content = useRef(null)
  const path = useRef(null)
  const drop = useRef(null)
  const spin = useRef(null)
  const arrow = useRef(null)
  const hint = useRef(null)
  const hintText = useRef(null)
  const count = useRef(0)
  const timer = useRef(0)
  const s = useRef({ y: 0, v: 0, pull: false, armed: false, busy: false, sy: 0, sx: 0, base: 0, track: false, id: -1, angle: 0 })

  const R = 14

  useEffect(() => {
    const p = s.current
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const sc = scroller.current
    let raf = 0
    let last = performance.now()
    let prevY = -1
    let prevBusy = null

    // Let the browser handle scrolling, but not a downward pull while at the top.
    const syncTouch = () => { sc.style.touchAction = sc.scrollTop <= 0 ? 'pan-x pan-down' : 'pan-x pan-y' }
    syncTouch()
    sc.addEventListener('scroll', syncTouch, { passive: true })
    // Fallback for browsers without pan-down: block the native pull ourselves.
    let ty = 0
    const tstart = (e) => { ty = e.touches[0].clientY }
    const tmove = (e) => {
      const dy = e.touches[0].clientY - ty
      if (p.pull || (sc.scrollTop <= 0 && dy > 0 && e.cancelable)) e.preventDefault()
    }
    sc.addEventListener('touchstart', tstart, { passive: true })
    sc.addEventListener('touchmove', tmove, { passive: false })

    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      if (!p.pull) {
        const target = p.busy ? threshold * 0.9 : 0
        if (mq?.matches) { p.y = target; p.v = 0 } else {
          p.v += (-stiffness * (p.y - target) - damping * p.v) * dt
          p.y += p.v * dt
          if (Math.abs(p.y - target) < 0.05 && Math.abs(p.v) < 0.5) { p.y = target; p.v = 0 }
        }
      }
      if (p.busy) p.angle = (p.angle + dt * 360 * 1.4) % 360
      const y = Math.max(0, p.y)
      if (y !== prevY || p.busy !== prevBusy || p.busy) {
        prevY = y
        prevBusy = p.busy
        if (content.current) content.current.style.transform = y ? `translate3d(0, ${y.toFixed(2)}px, 0)` : ''
        const t = Math.min(1, y / threshold)
        const w = sc.clientWidth
        const cx = w / 2
        // Gooey drop: a fixed top bulb joined to a bottom bulb that follows the pull.
        const y1 = 4
        const r1 = R * (1 - 0.55 * t)
        const r2 = R * (0.55 + 0.45 * t)
        const y2 = Math.max(y1 + 2, Math.min(y - R - 10, threshold - R - 4) + Math.max(0, y - threshold) * 0.25)
        const neck = Math.min(r1, r2) * (1 - 0.7 * t)
        const mid = (y1 + y2) / 2
        if (path.current) {
          path.current.setAttribute('d',
            `M ${cx - r1} ${y1} A ${r1} ${r1} 0 0 1 ${cx + r1} ${y1} Q ${cx + neck} ${mid} ${cx + r2} ${y2} A ${r2} ${r2} 0 0 1 ${cx - r2} ${y2} Q ${cx - neck} ${mid} ${cx - r1} ${y1} Z`)
          path.current.style.opacity = p.busy ? 0 : Math.min(1, y / 12)
          path.current.style.fill = p.armed ? 'var(--pr-accent)' : '#d8d1c4'
        }
        if (arrow.current) {
          arrow.current.setAttribute('transform', `translate(${cx} ${y2}) rotate(${t * 180}) scale(${Math.max(0.01, r2 / R)})`)
          arrow.current.style.opacity = p.busy ? 0 : Math.min(1, y / 20)
          arrow.current.style.color = p.armed ? '#fff' : '#8e887c'
        }
        if (spin.current) {
          spin.current.style.opacity = p.busy ? 1 : 0
          spin.current.setAttribute('transform', `translate(${cx} ${y / 2}) rotate(${p.angle})`)
        }
        if (hint.current) {
          hint.current.style.opacity = p.pull && !p.busy ? Math.min(1, Math.max(0, (y - 24) / 30)) : 0
          hint.current.style.transform = `translate3d(-50%, ${(y - 22).toFixed(1)}px, 0)`
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer.current)
      sc.removeEventListener('scroll', syncTouch)
      sc.removeEventListener('touchstart', tstart)
      sc.removeEventListener('touchmove', tmove)
    }
  }, [threshold, stiffness, damping])

  const refresh = () => {
    const p = s.current
    if (p.busy) return
    p.busy = true
    p.armed = false
    setBusy(true)
    setMsg('Refreshing')
    scroller.current?.scrollTo({ top: 0 })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const [t, d] = FRESH[count.current % FRESH.length]
      count.current += 1
      setRows((r) => [{ id: `n${count.current}`, t, d, when: 'now', fresh: true }, ...r])
      p.busy = false
      setBusy(false)
      setMsg('Updated. 1 new item')
      onRefresh?.()
    }, loadTime * 1000)
  }

  const rubber = (d) => (1 - 1 / (d / (maxPull * resistance) + 1)) * maxPull

  const down = (e) => {
    const p = s.current
    if (p.busy || (e.pointerType === 'mouse' && e.button !== 0)) return
    const sc = scroller.current
    if (e.clientX - sc.getBoundingClientRect().left > sc.clientWidth) return // on the scrollbar
    p.track = true
    p.id = e.pointerId
    p.sx = e.clientX
    p.sy = e.clientY
  }
  const move = (e) => {
    const p = s.current
    if (!p.track || e.pointerId !== p.id) return
    const sc = scroller.current
    if (!p.pull) {
      const dy = e.clientY - p.sy
      const dx = e.clientX - p.sx
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { p.track = false; return }
      if (dy < -4 || sc.scrollTop > 0) { if (sc.scrollTop > 0 || dy < -10) p.track = false; return }
      if (dy < 6) return
      p.pull = true
      p.base = e.clientY
      p.v = 0
      sc.setPointerCapture(e.pointerId)
      sc.dataset.pulling = 'true'
    }
    p.y = rubber(Math.max(0, e.clientY - p.base))
    const armed = p.y >= threshold
    if (armed !== p.armed) {
      p.armed = armed
      if (armed) navigator.vibrate?.(8)
      if (hintText.current) hintText.current.textContent = armed ? 'Release to refresh' : 'Pull to refresh'
    }
  }
  const up = () => {
    const p = s.current
    p.track = false
    if (!p.pull) return
    p.pull = false
    delete scroller.current.dataset.pulling
    if (p.armed) refresh()
    else p.armed = false
  }
  const key = (e) => {
    if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); refresh() }
  }
  return (
    <div className="pr" style={{ '--pr-accent': accent, '--pr-bg': background, '--pr-item': color, '--pr-ink': textColor, ...style }}>
      <style>{`
        .pr { position: relative; width: 100%; height: 100%; min-height: 240px; overflow: hidden; background: var(--pr-bg); color: var(--pr-ink); user-select: none; -webkit-user-select: none; }
        .pr-goo { position: absolute; left: 0; top: 0; width: 100%; height: ${maxPull + 40}px; pointer-events: none; overflow: visible; }
        .pr-hint { position: absolute; left: 50%; top: 0; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; color: #8e887c; white-space: nowrap; opacity: 0; pointer-events: none; }
        .pr-scroll { position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; outline: none; cursor: grab; }
        .pr-scroll[data-pulling='true'] { cursor: grabbing; }
        .pr-scroll:focus-visible { box-shadow: inset 0 0 0 3px var(--pr-accent); }
        .pr-content { will-change: transform; padding: 12px 12px 16px; display: flex; flex-direction: column; background: var(--pr-bg); min-height: 100%; box-sizing: border-box; }
        .pr-row { display: grid; grid-template-rows: 1fr; }
        .pr-row > div { overflow: hidden; }
        .pr-card { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; padding: 12px 14px; border-radius: 12px; background: var(--pr-item); border: 1px solid rgba(0,0,0,.08); }
        .pr-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #d8d1c4; }
        .pr-new .pr-dot { background: var(--pr-accent); }
        .pr-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .pr-t { font: 400 16px/1.15 Georgia, 'Times New Roman', serif; }
        .pr-d { font: 400 12px/1.3 system-ui, sans-serif; color: #8e887c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pr-when { flex: none; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .1em; color: #8e887c; }
        .pr-new { animation: pr-in 520ms cubic-bezier(.2,.8,.2,1) both; }
        .pr-new .pr-card { animation: pr-fade 520ms cubic-bezier(.2,.8,.2,1) both; }
        @keyframes pr-in { from { grid-template-rows: 0fr; } to { grid-template-rows: 1fr; } }
        @keyframes pr-fade { from { opacity: 0; transform: translateY(-10px) scale(.98); } to { opacity: 1; transform: none; } }
        .pr-btn { position: absolute; right: 10px; top: 10px; z-index: 2; padding: 7px 10px; border-radius: 999px; border: 0; background: var(--pr-ink); color: var(--pr-bg); font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; cursor: pointer; opacity: 0; pointer-events: none; transition: opacity 160ms; }
        .pr:focus-within .pr-btn { opacity: 1; pointer-events: auto; }
        .pr-btn:focus-visible { outline: 3px solid var(--pr-accent); outline-offset: 2px; }
        .pr-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        @media (prefers-reduced-motion: reduce) { .pr-new, .pr-new .pr-card { animation: none; } .pr-btn { transition: none; } }
      `}</style>
      <svg className="pr-goo" aria-hidden="true">
        <path ref={path} style={{ opacity: 0, transition: 'fill 160ms' }} />
        <g ref={arrow} style={{ opacity: 0 }}>
          <path d="M0 -6 V5 M-4.5 1 L0 5.5 L4.5 1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g ref={spin} style={{ opacity: 0 }}>
          <circle r="11" fill="none" stroke="#d8d1c4" strokeWidth="3" />
          <circle r="11" fill="none" stroke="var(--pr-accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="20 60" />
        </g>
      </svg>
      <div ref={hint} className="pr-hint" aria-hidden="true"><span ref={hintText}>Pull to refresh</span></div>
      <div
        ref={scroller}
        className="pr-scroll"
        tabIndex={0}
        role="region"
        aria-label="Activity. Pull down at the top, or press R, to refresh."
        aria-busy={busy}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
        onKeyDown={key}
      >
        <div ref={content} className="pr-content">
          {rows.map((r) => (
            <div key={r.id} className={`pr-row${r.fresh ? ' pr-new' : ''}`}>
              <div>
                <div className="pr-card">
                  <span className="pr-dot" aria-hidden="true" />
                  <span className="pr-text"><span className="pr-t">{r.t}</span><span className="pr-d">{r.d}</span></span>
                  <span className="pr-when">{r.when}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button type="button" className="pr-btn" onClick={refresh} disabled={busy}>{busy ? 'Loading' : 'Refresh'}</button>
      <span className="pr-sr" aria-live="polite">{msg}</span>
    </div>
  )
}
