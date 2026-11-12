import { useEffect, useRef } from 'react'

// Scroll velocity drives skew and blur. Scroll the list of big type and it
// leans into the motion and smears slightly, by an amount proportional to how
// fast you scroll (smoothed and clamped). Stop and it springs back upright and
// sharp, with a small overshoot. `effect` picks skew, blur or both. A meter in
// the corner shows the velocity. The list scrolls inside the component; under
// reduced motion nothing skews or blurs and the type stays still.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export default function ScrollSkew({
  effect = 'both',
  maxSkew = 8,
  maxBlur = 3,
  sensitivity = 1,
  stiffness = 170,
  damping = 16,
  words = 'Momentum, Velocity, Inertia, Drift, Friction, Settle, Motion, Rest',
  accent = '#ff4d1a',
  background = '#f4f1ea',
  ink = '#1c1a16',
  muted = '#8e887c',
  style,
}) {
  const scroller = useRef(null)
  const content = useRef(null)
  const meter = useRef(null)

  const list = String(words).split(',').map((w) => w.trim()).filter(Boolean)
  const base = list.length ? list : ['Motion']
  const rows = []
  while (rows.length < Math.max(14, base.length * 2)) rows.push(base[rows.length % base.length])

  useEffect(() => {
    const el = scroller.current
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const useSkew = effect === 'skew' || effect === 'both'
    const useBlur = effect === 'blur' || effect === 'both'
    const st = { top: el.scrollTop, prev: el.scrollTop, v: 0, a: 0, av: 0, raf: 0, last: 0, idle: 0 }

    const reset = () => {
      if (content.current) {
        content.current.style.transform = ''
        content.current.style.filter = ''
        content.current.style.willChange = ''
      }
      if (meter.current) meter.current.style.transform = 'scaleX(0)'
    }
    const step = (now) => {
      const dt = clamp((now - st.last) / 1000, 1 / 240, 1 / 30)
      st.last = now
      // velocity from the scroll position read in the listener, smoothed
      const raw = (st.top - st.prev) / dt
      st.prev = st.top
      st.v += (raw - st.v) * (1 - Math.exp(-14 * dt))
      const target = clamp((st.v * sensitivity) / 1800, -1, 1)
      // spring the effect amount toward the target so it overshoots a touch on release
      st.av += (stiffness * (target - st.a) - damping * st.av) * dt
      st.a += st.av * dt
      const c = content.current
      if (c) {
        c.style.willChange = useBlur ? 'transform, filter' : 'transform'
        c.style.transform = useSkew ? `skewY(${(-st.a * maxSkew).toFixed(3)}deg)` : ''
        const b = Math.abs(st.a) * maxBlur
        c.style.filter = useBlur && b > 0.05 ? `blur(${b.toFixed(2)}px)` : ''
      }
      if (meter.current) meter.current.style.transform = `scaleX(${Math.min(1, Math.abs(target)).toFixed(3)})`
      const still = Math.abs(raw) < 1 && Math.abs(st.v) < 2 && Math.abs(st.a) < 0.002 && Math.abs(st.av) < 0.01
      st.idle = still ? st.idle + dt : 0
      if (st.idle > 0.1) {
        st.raf = 0
        st.v = st.a = st.av = 0
        reset()
        return
      }
      st.raf = requestAnimationFrame(step)
    }
    const onScroll = () => {
      st.top = el.scrollTop
      if (mq?.matches || st.raf) return
      st.prev = st.top
      st.idle = 0
      st.last = performance.now()
      st.raf = requestAnimationFrame(step)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(st.raf)
      reset()
    }
  }, [effect, maxSkew, maxBlur, sensitivity, stiffness, damping])

  return (
    <div className="sk" style={{ '--sk-accent': accent, '--sk-bg': background, '--sk-ink': ink, '--sk-muted': muted, ...style }}>
      <style>{`
        .sk { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--sk-bg); color: var(--sk-ink); }
        .sk-scroll { position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; outline: none; scrollbar-width: thin; scrollbar-color: rgba(28,26,22,.25) transparent; }
        .sk-scroll:focus-visible { box-shadow: inset 0 0 0 3px var(--sk-accent); }
        .sk-list { list-style: none; margin: 0; padding: 72px 24px 96px; transform-origin: 50% 50%; backface-visibility: hidden; }
        .sk-row { display: flex; align-items: baseline; gap: 16px; padding: 6px 0; border-top: 1px solid rgba(28,26,22,.1); }
        .sk-row:last-child { border-bottom: 1px solid rgba(28,26,22,.1); }
        .sk-n { flex: none; width: 28px; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; color: var(--sk-muted); font-variant-numeric: tabular-nums; }
        .sk-w { font: 400 clamp(40px, 11vw, 96px)/1 Georgia, 'Times New Roman', serif; letter-spacing: -.02em; white-space: nowrap; }
        .sk-row:nth-child(even) .sk-w { color: transparent; -webkit-text-stroke: 1.5px var(--sk-ink); font-style: italic; }
        .sk-dot { color: var(--sk-accent); }
        .sk-hud { position: absolute; top: 14px; left: 24px; right: 24px; display: flex; align-items: center; gap: 12px; pointer-events: none; z-index: 1; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; color: var(--sk-muted); }
        .sk-hud::before { content: ''; position: absolute; inset: -14px -24px -18px; background: linear-gradient(var(--sk-bg) 55%, transparent); z-index: -1; }
        .sk-meter { position: relative; width: 96px; height: 3px; border-radius: 3px; background: rgba(28,26,22,.12); overflow: hidden; }
        .sk-meter i { position: absolute; inset: 0; background: var(--sk-accent); transform-origin: 0 50%; transform: scaleX(0); }
        .sk-hint { margin-left: auto; }
        @media (prefers-reduced-motion: reduce) { .sk-list { transform: none !important; filter: none !important; } }
      `}</style>
      <div className="sk-hud" aria-hidden="true">
        <span>Velocity</span>
        <span className="sk-meter"><i ref={meter} /></span>
        <span className="sk-hint">Scroll fast</span>
      </div>
      <div ref={scroller} className="sk-scroll" tabIndex={0} role="region" aria-label="Scrolling list. Scroll quickly to see the type lean and blur.">
        <ol ref={content} className="sk-list">
          {rows.map((w, i) => (
            <li key={i} className="sk-row">
              <span className="sk-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="sk-w">{w}{i % 3 === 0 && <span className="sk-dot">.</span>}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
