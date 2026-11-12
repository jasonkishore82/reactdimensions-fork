import { useEffect, useRef } from 'react'

// Horizontal gallery driven by vertical scroll. The component scrolls inside
// itself: a tall track sits behind a sticky stage, and scrolling down slides
// the row of cards sideways, first card centred at the top, last card centred
// at the bottom. The slide is smoothed, and each card's artwork drifts a little
// against the card for depth. A counter and a thin bar show where you are.
// Focus the gallery and use the arrow keys to step a card at a time. Under
// reduced motion the row follows the scroll directly with no parallax.

const ART = [
  (a) => `radial-gradient(circle at 68% 34%, #fff3e2 0 9%, transparent 9.5%), radial-gradient(120% 60% at 30% 110%, #8a3b1c 0 40%, transparent 41%), radial-gradient(140% 70% at 90% 120%, #b9542a 0 45%, transparent 46%), linear-gradient(180deg, #f7c59f 0%, ${a} 100%)`,
  () => `radial-gradient(60% 40% at 50% 115%, #0e2a3a 0 70%, transparent 71%), repeating-linear-gradient(180deg, transparent 0 18px, rgba(255,255,255,.08) 18px 20px), linear-gradient(180deg, #9cc7d6 0%, #2f6f86 60%, #123c4d 100%)`,
  (a) => `radial-gradient(circle at 50% 48%, ${a} 0 18%, transparent 18.5%), radial-gradient(circle at 50% 48%, #2a2420 0 26%, transparent 26.5%), conic-gradient(from 90deg at 50% 48%, #e9dfcf, #cdbfa8, #e9dfcf, #cdbfa8, #e9dfcf)`,
  () => `radial-gradient(70% 50% at 20% 100%, #2f4a2c 0 60%, transparent 61%), radial-gradient(80% 55% at 85% 105%, #476b3d 0 60%, transparent 61%), radial-gradient(circle at 75% 25%, #f1e9c9 0 7%, transparent 7.5%), linear-gradient(180deg, #c9d8b6 0%, #88a777 100%)`,
  (a) => `linear-gradient(135deg, transparent 0 46%, ${a} 46% 54%, transparent 54%), linear-gradient(45deg, transparent 0 46%, #1c1a16 46% 54%, transparent 54%), linear-gradient(180deg, #d9d3c7, #b8b0a1)`,
  () => `radial-gradient(circle at 30% 30%, #ffd6e0 0 14%, transparent 14.5%), radial-gradient(circle at 62% 58%, #ff9eb5 0 20%, transparent 20.5%), radial-gradient(circle at 40% 80%, #c75b7a 0 12%, transparent 12.5%), linear-gradient(200deg, #fbe7ec, #e8b4c2)`,
  (a) => `repeating-radial-gradient(circle at 50% 120%, #1d1b2e 0 14px, #2c2946 14px 28px), radial-gradient(circle at 50% 30%, ${a} 0 10%, transparent 10.5%)`,
  () => `linear-gradient(180deg, transparent 0 62%, #5e6b74 62% 64%, transparent 64%), radial-gradient(90% 40% at 50% 100%, #3c4850 0 60%, transparent 61%), linear-gradient(180deg, #e7ecef 0%, #b7c3ca 62%, #8a99a3 100%)`,
]
const TITLES = ['Dune', 'Tide', 'Kiln', 'Moss', 'Cross', 'Bloom', 'Orbit', 'Haze']
const NOTES = ['Desert series', 'Coastal study', 'Studio ceramics', 'Field notes', 'Graphic mark', 'Petal set', 'Night piece', 'Lake morning']

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const pad = (n) => String(n).padStart(2, '0')

export default function ScrollGallery({
  count = 6,
  cardWidth = 280,
  gap = 24,
  parallax = 0.4,
  smoothing = 10,
  speed = 1,
  accent = '#ff4d1a',
  background = '#f4f1ea',
  ink = '#1c1a16',
  muted = '#8e887c',
  style,
}) {
  const n = clamp(Math.round(count), 3, 8)
  const scroller = useRef(null)
  const track = useRef(null)
  const stage = useRef(null)
  const row = useRef(null)
  const arts = useRef([])
  const counter = useRef(null)
  const title = useRef(null)
  const bar = useRef(null)
  const api = useRef({ go: () => {}, index: 0 })

  useEffect(() => {
    const el = scroller.current
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const st = { target: 0, cur: 0, vw: 0, vh: 0, cw: cardWidth, step: cardWidth + gap, dist: 0, raf: 0, last: 0, idx: -1 }

    const read = () => {
      const max = el.scrollHeight - el.clientHeight
      st.target = max > 0 ? clamp(el.scrollTop / max, 0, 1) : 0
    }
    const apply = () => {
      const x = -st.cur * st.dist
      if (row.current) row.current.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`
      const reduce = mq?.matches
      for (let i = 0; i < n; i++) {
        const a = arts.current[i]
        if (!a) continue
        // offset of this card from the centre of the stage, in card steps
        const off = (i * st.step + x) / st.step
        const shift = reduce ? 0 : clamp(-off * parallax * 0.2 * st.cw, -0.24 * st.cw, 0.24 * st.cw)
        a.style.transform = `translate3d(${shift.toFixed(2)}px,0,0)`
      }
      if (bar.current) bar.current.style.transform = `scaleX(${st.cur.toFixed(4)})`
      const idx = clamp(Math.round(-x / st.step), 0, n - 1)
      if (idx !== st.idx) {
        st.idx = idx
        api.current.index = idx
        if (counter.current) counter.current.textContent = `${pad(idx + 1)} / ${pad(n)}`
        if (title.current) title.current.textContent = TITLES[idx]
      }
    }
    const step = (now) => {
      const dt = clamp((now - st.last) / 1000, 0, 1 / 30)
      st.last = now
      if (mq?.matches || smoothing <= 0) st.cur = st.target
      else st.cur += (st.target - st.cur) * (1 - Math.exp(-smoothing * dt))
      if (Math.abs(st.target - st.cur) < 1e-4) st.cur = st.target
      apply()
      st.raf = st.cur === st.target ? 0 : requestAnimationFrame(step)
    }
    const kick = () => {
      if (st.raf) return
      st.last = performance.now()
      st.raf = requestAnimationFrame(step)
    }
    const measure = () => {
      st.vw = el.clientWidth
      st.vh = el.clientHeight
      st.cw = Math.min(cardWidth, st.vw * 0.78)
      st.step = st.cw + gap
      st.dist = (n - 1) * st.step
      if (stage.current) {
        stage.current.style.height = `${st.vh}px`
        stage.current.style.setProperty('--sg-cw', `${st.cw}px`)
        stage.current.style.setProperty('--sg-vh', `${st.vh}px`)
      }
      if (row.current) row.current.style.paddingInline = `${(st.vw - st.cw) / 2}px`
      if (track.current) track.current.style.height = `${st.vh + st.dist / Math.max(0.1, speed)}px`
      read()
      st.idx = -1
      kick()
    }
    const onScroll = () => {
      read()
      kick()
    }
    api.current.go = (i) => {
      const max = el.scrollHeight - el.clientHeight
      el.scrollTo({ top: (clamp(i, 0, n - 1) / (n - 1)) * max, behavior: mq?.matches ? 'auto' : 'smooth' })
    }

    measure()
    st.cur = st.target
    apply()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(st.raf)
    }
  }, [n, cardWidth, gap, parallax, smoothing, speed])

  const key = (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!d) return
    e.preventDefault()
    api.current.go(api.current.index + d)
  }

  return (
    <div
      ref={scroller}
      className="sg"
      tabIndex={0}
      role="region"
      aria-roledescription="gallery"
      aria-label="Gallery. Scroll down, or use the arrow keys, to move through the cards."
      onKeyDown={key}
      style={{ '--sg-accent': accent, '--sg-bg': background, '--sg-ink': ink, '--sg-muted': muted, '--sg-gap': `${gap}px`, ...style }}
    >
      <style>{`
        .sg { position: relative; width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; background: var(--sg-bg); color: var(--sg-ink); outline: none; scrollbar-width: none; -webkit-tap-highlight-color: transparent; }
        .sg::-webkit-scrollbar { display: none; }
        .sg:focus-visible { box-shadow: inset 0 0 0 3px var(--sg-accent); }
        .sg-track { position: relative; }
        .sg-stage { position: sticky; top: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: center; }
        .sg-row { display: flex; gap: var(--sg-gap); width: max-content; will-change: transform; }
        .sg-card { position: relative; flex: none; width: var(--sg-cw, 280px); height: min(calc(var(--sg-vh, 400px) * .64), calc(var(--sg-cw, 280px) * 1.25)); min-height: 160px; border-radius: 18px; overflow: hidden; background: #ddd6c9; box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 18px 40px -22px rgba(28,26,22,.45); margin: 0; }
        .sg-art { position: absolute; top: 0; bottom: 0; left: -25%; right: -25%; will-change: transform; }
        .sg-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 16px; display: flex; align-items: flex-end; justify-content: space-between; background: linear-gradient(180deg, transparent, rgba(20,18,14,.55)); color: #fff; }
        .sg-cap b { font: 400 26px/1 Georgia, 'Times New Roman', serif; }
        .sg-cap span { font: 500 10px/1.3 ui-monospace, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; opacity: .85; text-align: right; }
        .sg-num { position: absolute; top: 12px; left: 14px; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; color: rgba(255,255,255,.9); }
        .sg-hud { position: absolute; left: 20px; right: 20px; top: 16px; display: flex; justify-content: space-between; align-items: baseline; pointer-events: none; font: 500 11px/1 ui-monospace, Menlo, monospace; letter-spacing: .12em; color: var(--sg-muted); text-transform: uppercase; }
        .sg-hud strong { font: 400 22px/1 Georgia, 'Times New Roman', serif; letter-spacing: 0; text-transform: none; color: var(--sg-ink); margin-left: 10px; }
        .sg-count { color: var(--sg-ink); font-variant-numeric: tabular-nums; }
        .sg-foot { position: absolute; left: 20px; right: 20px; bottom: 18px; display: flex; align-items: center; gap: 14px; pointer-events: none; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; color: var(--sg-muted); text-transform: uppercase; }
        .sg-rail { position: relative; flex: 1; height: 2px; background: rgba(28,26,22,.12); border-radius: 2px; overflow: hidden; }
        .sg-bar { position: absolute; inset: 0; background: var(--sg-accent); transform-origin: 0 50%; transform: scaleX(0); }
        @media (prefers-reduced-motion: reduce) { .sg-row, .sg-art { will-change: auto; } }
      `}</style>
      <div ref={track} className="sg-track">
        <div ref={stage} className="sg-stage">
          <div className="sg-hud" aria-hidden="true">
            <span>Gallery<strong ref={title}>{TITLES[0]}</strong></span>
            <span ref={counter} className="sg-count">{`01 / ${pad(n)}`}</span>
          </div>
          <div ref={row} className="sg-row">
            {Array.from({ length: n }, (_, i) => (
              <figure key={i} className="sg-card" aria-label={`${i + 1} of ${n}: ${TITLES[i]}, ${NOTES[i]}`}>
                <div ref={(d) => (arts.current[i] = d)} className="sg-art" style={{ background: ART[i](accent) }} aria-hidden="true" />
                <span className="sg-num" aria-hidden="true">{pad(i + 1)}</span>
                <figcaption className="sg-cap">
                  <b>{TITLES[i]}</b>
                  <span>{NOTES[i]}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="sg-foot" aria-hidden="true">
            <span>Scroll</span>
            <div className="sg-rail"><div ref={bar} className="sg-bar" /></div>
            <span>← →</span>
          </div>
        </div>
      </div>
    </div>
  )
}
