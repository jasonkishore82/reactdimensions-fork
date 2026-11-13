import { useEffect, useRef } from 'react'

// One long sentence on a single line, far wider than the box. Scrolling down
// pans it sideways past you, like reading a banner from a moving train. The
// word in the middle lights up, the pan leans a little with your scroll
// speed, and a thin bar along the bottom shows how far through you are.
export default function ScrubSentence({
  text = 'A long sentence that pans past as you scroll, one word at a time, until you reach the end.',
  lean = 1,
  ink = '#1c1a16',
  muted = '#b9b5ac',
  accent = '#ff4d1a',
  background = '#f7f7f8',
  style,
}) {
  const scroller = useRef()
  const track = useRef()
  const bar = useRef()
  const words = useRef([])
  const parts = String(text).split(/\s+/).filter(Boolean)

  useEffect(() => {
    const el = scroller.current
    const st = { skew: 0, prev: el.scrollTop, raf: 0, last: 0 }
    const frame = (now) => {
      st.last ||= now
      const dt = Math.min(0.05, (now - st.last) / 1000)
      st.last = now
      const max = el.scrollHeight - el.clientHeight || 1
      const p = el.scrollTop / max
      const v = (el.scrollTop - st.prev) / Math.max(dt, 1e-3)
      st.prev = el.scrollTop
      st.skew += (Math.max(-14, Math.min(14, -v * 0.012 * lean)) - st.skew) * (1 - Math.exp(-dt * 8))
      const W = el.clientWidth
      const tw = track.current.scrollWidth
      // start with the first word in the middle, end with the last word there
      const x = W / 2 - words.current[0].offsetWidth / 2 - p * (tw - words.current[0].offsetWidth / 2 - words.current[parts.length - 1].offsetWidth / 2)
      track.current.style.transform = `translate3d(${x.toFixed(1)}px,-50%,0) skewX(${st.skew.toFixed(2)}deg)`
      bar.current.style.transform = `scaleX(${p.toFixed(4)})`
      const mid = W / 2 - x
      words.current.forEach((w) => {
        if (!w) return
        const c = w.offsetLeft + w.offsetWidth / 2
        const d = Math.abs(c - mid) / Math.max(1, w.offsetWidth)
        w.style.color = d < 0.7 ? accent : c < mid ? ink : muted
      })
      st.raf = requestAnimationFrame(frame)
    }
    st.raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(st.raf)
  }, [text, lean, ink, muted, accent])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }}>
      <div ref={scroller} tabIndex={0} aria-label={text} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'none', outline: 'none' }}>
        <div style={{ height: `${100 + parts.length * 40}%` }}>
          <div aria-hidden="true" style={{ position: 'sticky', top: 0, height: `${10000 / (100 + parts.length * 40)}%`, overflow: 'hidden' }}>
            <div ref={track} style={{ position: 'absolute', left: 0, top: '50%', display: 'flex', gap: '0.28em', whiteSpace: 'nowrap', willChange: 'transform', font: 'inherit' }}>
              {parts.map((w, i) => (
                <span key={i} ref={(n) => (words.current[i] = n)} style={{ transition: 'color .25s' }}>
                  {w}
                </span>
              ))}
            </div>
            <div style={{ position: 'absolute', left: 24, right: 24, bottom: 22, height: 2, background: `${ink}1a`, borderRadius: 2 }}>
              <div ref={bar} style={{ height: '100%', background: accent, transformOrigin: '0 50%', transform: 'scaleX(0)', borderRadius: 2 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
