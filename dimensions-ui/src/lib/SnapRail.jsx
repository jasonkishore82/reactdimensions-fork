import { useEffect, useRef, useState } from 'react'

// Snapping sections with a progress rail. Full-height sections snap into
// place as you scroll inside the component. A rail of dots on the right fills
// continuously with your progress, the dot for the section in view grows, and
// clicking a dot scrolls to its section. Focus the sections and use PageUp /
// PageDown, the arrow keys, Space, Home and End to move one section at a time.
// Under reduced motion the jumps are instant and nothing fades in.

const SECTIONS = [
  { kicker: 'Chapter one', title: 'Arrive', body: 'Every section fills the frame and snaps into place, so a page reads like a set of slides.' },
  { kicker: 'Chapter two', title: 'Settle', body: 'The rail fills as you go. It tracks the scroll itself, not just the section, so it moves with your hand.' },
  { kicker: 'Chapter three', title: 'Look', body: 'The dot for the section in view grows. Click any dot to travel straight to that section.' },
  { kicker: 'Chapter four', title: 'Move', body: 'PageUp, PageDown, the arrow keys, Space, Home and End step through one section at a time.' },
  { kicker: 'Chapter five', title: 'Rest', body: 'Under reduced motion the jumps are instant and the content simply appears.' },
  { kicker: 'Epilogue', title: 'Begin', body: 'Six sections at most: enough for a story, few enough to hold in your head.' },
]

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const pad = (n) => String(n).padStart(2, '0')

export default function SnapRail({
  sections = 5,
  accent = '#ff4d1a',
  background = '#f4f1ea',
  altBackground = '#e9e4da',
  ink = '#1c1a16',
  muted = '#8e887c',
  railColor = '#cfc8ba',
  dotSize = 10,
  style,
}) {
  const n = clamp(Math.round(sections), 2, SECTIONS.length)
  const [active, setActive] = useState(0)
  const scroller = useRef(null)
  const fill = useRef(null)
  const want = useRef(null)
  const activeRef = useRef(0)

  useEffect(() => {
    const el = scroller.current
    const st = { top: el.scrollTop, raf: 0 }
    const apply = () => {
      st.raf = 0
      const h = el.clientHeight || 1
      const max = el.scrollHeight - el.clientHeight
      const p = max > 0 ? clamp(st.top / max, 0, 1) : 0
      if (fill.current) fill.current.style.transform = `scaleY(${p.toFixed(4)})`
      const idx = clamp(Math.round(st.top / h), 0, n - 1)
      if (idx !== activeRef.current) {
        activeRef.current = idx
        setActive(idx)
      }
      if (want.current != null && Math.abs(st.top - want.current * h) < 2) want.current = null
    }
    const onScroll = () => {
      st.top = el.scrollTop
      if (!st.raf) st.raf = requestAnimationFrame(apply)
    }
    // keep the current section in place when the box is resized
    const ro = new ResizeObserver(() => {
      el.scrollTop = activeRef.current * el.clientHeight
      onScroll()
    })
    ro.observe(el)
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(st.raf)
    }
  }, [n])

  const go = (i) => {
    const el = scroller.current
    if (!el) return
    const idx = clamp(i, 0, n - 1)
    want.current = idx
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: idx * el.clientHeight, behavior: reduce ? 'auto' : 'smooth' })
  }

  const key = (e) => {
    if (e.target !== e.currentTarget) return
    const from = want.current ?? activeRef.current
    let to = null
    if (e.key === 'PageDown' || e.key === 'ArrowDown' || (e.key === ' ' && !e.shiftKey)) to = from + 1
    else if (e.key === 'PageUp' || e.key === 'ArrowUp' || (e.key === ' ' && e.shiftKey)) to = from - 1
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = n - 1
    if (to == null) return
    e.preventDefault()
    go(to)
  }

  return (
    <div
      className="sr"
      style={{ '--sr-accent': accent, '--sr-bg': background, '--sr-alt': altBackground, '--sr-ink': ink, '--sr-muted': muted, '--sr-rail': railColor, '--sr-dot': `${dotSize}px`, ...style }}
    >
      <style>{`
        .sr { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--sr-bg); color: var(--sr-ink); }
        .sr-scroll { position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scroll-snap-type: y mandatory; outline: none; scrollbar-width: none; }
        .sr-scroll::-webkit-scrollbar { display: none; }
        .sr-scroll:focus-visible { box-shadow: inset 0 0 0 3px var(--sr-accent); }
        .sr-sec { position: relative; height: 100%; scroll-snap-align: start; scroll-snap-stop: always; display: flex; align-items: center; padding: 32px 72px 32px clamp(20px, 7%, 64px); box-sizing: border-box; overflow: hidden; }
        .sr-sec:nth-child(even) { background: var(--sr-alt); }
        .sr-in { position: relative; max-width: 460px; opacity: 0; transform: translateY(22px); transition: opacity 520ms ease, transform 620ms cubic-bezier(.2,.8,.2,1); }
        .sr-sec[data-on='true'] .sr-in { opacity: 1; transform: none; }
        .sr-k { display: block; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .16em; text-transform: uppercase; color: var(--sr-muted); margin-bottom: 14px; }
        .sr-t { margin: 0 0 14px; font: 400 clamp(44px, 9vw, 84px)/.92 Georgia, 'Times New Roman', serif; letter-spacing: -.02em; }
        .sr-t span { color: var(--sr-accent); }
        .sr-b { margin: 0; max-width: 34ch; font: 400 14px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--sr-ink); opacity: .78; }
        .sr-big { position: absolute; right: 64px; bottom: -0.12em; font: 400 clamp(120px, 34vw, 280px)/1 Georgia, 'Times New Roman', serif; color: var(--sr-ink); opacity: .06; pointer-events: none; user-select: none; }
        .sr-railwrap { position: absolute; right: 22px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; gap: 12px; z-index: 1; }
        .sr-rail { position: relative; display: flex; flex-direction: column; align-items: center; gap: 22px; }
        .sr-line { position: absolute; left: 50%; width: 2px; margin-left: -1px; top: calc(var(--sr-dot) / 2); bottom: calc(var(--sr-dot) / 2); background: var(--sr-rail); border-radius: 2px; overflow: hidden; }
        .sr-fill { position: absolute; inset: 0; background: var(--sr-accent); transform-origin: 50% 0; transform: scaleY(0); }
        .sr-dot { position: relative; width: calc(var(--sr-dot) + 18px); height: calc(var(--sr-dot) + 18px); margin: -9px; padding: 0; border: 0; background: none; cursor: pointer; border-radius: 50%; -webkit-tap-highlight-color: transparent; }
        .sr-dot i { position: absolute; left: 50%; top: 50%; width: var(--sr-dot); height: var(--sr-dot); margin: calc(var(--sr-dot) / -2); border-radius: 50%; background: var(--sr-bg); box-shadow: inset 0 0 0 2px var(--sr-rail); transition: transform 320ms cubic-bezier(.2,.8,.2,1), background-color 200ms, box-shadow 200ms; }
        .sr-dot[data-done='true'] i { box-shadow: inset 0 0 0 2px var(--sr-accent); }
        .sr-dot[aria-current='true'] i { background: var(--sr-accent); box-shadow: inset 0 0 0 2px var(--sr-accent), 0 0 0 4px color-mix(in srgb, var(--sr-accent) 22%, transparent); transform: scale(1.6); }
        .sr-dot:hover i { transform: scale(1.3); }
        .sr-dot[aria-current='true']:hover i { transform: scale(1.6); }
        .sr-dot:focus-visible { outline: 2px solid var(--sr-accent); outline-offset: 2px; }
        .sr-dot:focus:not(:focus-visible) { outline: none; }
        .sr-count { font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .1em; color: var(--sr-muted); font-variant-numeric: tabular-nums; writing-mode: vertical-rl; }
        @media (prefers-reduced-motion: reduce) { .sr-in, .sr-dot i { transition: none; } .sr-in { opacity: 1; transform: none; } }
      `}</style>
      <div ref={scroller} className="sr-scroll" tabIndex={0} role="region" aria-label="Sections. Use PageUp, PageDown or the arrow keys to move between them." onKeyDown={key}>
        {SECTIONS.slice(0, n).map((s, i) => (
          <section key={i} className="sr-sec" data-on={i === active} aria-label={`${i + 1} of ${n}: ${s.title}`}>
            <span className="sr-big" aria-hidden="true">{pad(i + 1)}</span>
            <div className="sr-in">
              <span className="sr-k">{s.kicker}</span>
              <h2 className="sr-t">{s.title}<span>.</span></h2>
              <p className="sr-b">{s.body}</p>
            </div>
          </section>
        ))}
      </div>
      <nav className="sr-railwrap" aria-label="Section navigation">
        <div className="sr-rail">
          <span className="sr-line" aria-hidden="true"><span ref={fill} className="sr-fill" /></span>
          {SECTIONS.slice(0, n).map((s, i) => (
            <button
              key={i}
              type="button"
              className="sr-dot"
              aria-label={`Go to section ${i + 1}: ${s.title}`}
              aria-current={i === active ? 'true' : undefined}
              data-done={i < active}
              onClick={() => go(i)}
            >
              <i />
            </button>
          ))}
        </div>
        <span className="sr-count" aria-hidden="true">{pad(active + 1)} / {pad(n)}</span>
      </nav>
    </div>
  )
}
