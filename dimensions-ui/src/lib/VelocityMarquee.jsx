import { useEffect, useRef } from 'react'

// Marquee bands that run on their own, then speed up when you scroll: the
// scroll velocity is added to their speed, and scrolling back up turns them
// around. Rows alternate direction. The boost eases off when you stop, so
// they glide back to cruising speed. Scroll inside the box to drive it.
export default function VelocityMarquee({
  text = 'Scroll faster',
  rows = 3,
  speed = 60,
  boost = 4,
  separator = '✦',
  accent = '#ff4d1a',
  background = '#f7f7f8',
  ink = '#1c1a16',
  style,
}) {
  const scroller = useRef()
  const bands = useRef([])

  useEffect(() => {
    const el = scroller.current
    const n = Math.max(1, Math.round(rows))
    const st = { x: Array(n).fill(0), dir: 1, v: 0, prev: el.scrollTop, raf: 0, last: 0 }
    const widths = bands.current.slice(0, n).map((b) => (b ? b.firstElementChild.getBoundingClientRect().width : 1))
    const frame = (now) => {
      st.last ||= now
      const dt = Math.min(0.05, (now - st.last) / 1000)
      st.last = now
      // scroll velocity in px/s, smoothed so a single wheel notch doesn't jerk
      const top = el.scrollTop
      const raw = (top - st.prev) / Math.max(dt, 1e-3)
      st.prev = top
      st.v += (raw - st.v) * (1 - Math.exp(-dt * 8))
      if (Math.abs(st.v) > 20) st.dir = Math.sign(st.v)
      const pace = speed + Math.abs(st.v) * boost * 0.1
      bands.current.slice(0, n).forEach((b, i) => {
        if (!b) return
        const w = widths[i] || 1
        const d = (i % 2 ? -1 : 1) * st.dir
        st.x[i] = (st.x[i] - d * pace * dt) % w
        if (st.x[i] > 0) st.x[i] -= w
        b.style.transform = `translate3d(${st.x[i].toFixed(2)}px,0,0) skewX(${(-Math.max(-12, Math.min(12, st.v * 0.01)) * d).toFixed(2)}deg)`
      })
      st.raf = requestAnimationFrame(frame)
    }
    st.raf = requestAnimationFrame(frame)
    // start part way down so you can scroll either way
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2
    st.prev = el.scrollTop
    return () => cancelAnimationFrame(st.raf)
  }, [text, rows, speed, boost, separator])

  const n = Math.max(1, Math.round(rows))
  const unit = `${text} ${separator} `
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, color: ink, ...style }}>
      <div ref={scroller} tabIndex={0} aria-label={`${text}. Scroll to speed it up.`} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'none', outline: 'none' }}>
        <div style={{ height: '1200%' }}>
          <div aria-hidden="true" style={{ position: 'sticky', top: 0, height: `${100 / 12}%`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.12em', overflow: 'hidden' }}>
            {[...Array(n)].map((_, i) => (
              <div
                key={i}
                ref={(b) => (bands.current[i] = b)}
                style={{
                  display: 'flex',
                  whiteSpace: 'pre',
                  willChange: 'transform',
                  font: 'inherit',
                  color: i % 2 ? 'transparent' : ink,
                  WebkitTextStroke: i % 2 ? `0.025em ${accent}` : undefined,
                }}
              >
                {[...Array(8)].map((__, k) => (
                  <span key={k}>{unit}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
