import { useEffect, useRef } from 'react'

// A passage of big type that fills in with colour as you read down it: each
// line fills left to right as it crosses the middle of the box, so the ink
// keeps pace with your eye. Scroll back up and it empties again.
export default function ScrollFillText({
  text = 'Type that fills as you read it. Each line takes its colour as it crosses the middle, left to right, word by word, so the ink keeps pace with your eye. Scroll back and it drains away again.',
  ink = '#1c1a16',
  muted = '#d6d3cc',
  accent = '#ff4d1a',
  background = '#f7f7f8',
  softness = 0.6,
  style,
}) {
  const scroller = useRef()
  const words = useRef([])
  const parts = String(text).split(/\s+/).filter(Boolean)

  useEffect(() => {
    const el = scroller.current
    let raf = 0
    const draw = () => {
      raf = 0
      const box = el.getBoundingClientRect()
      const mid = box.top + box.height / 2
      for (const w of words.current) {
        if (!w) continue
        const r = w.getBoundingClientRect()
        const lineH = r.height || 1
        // how far this word's line is past the middle, in lines, with words
        // further right on the line starting later
        const across = (r.left + r.width / 2 - box.left) / box.width
        const f = Math.min(1, Math.max(0, (mid - (r.top + lineH / 2)) / (lineH * softness) + 0.5 - (across - 0.5) * 1.2))
        const p = (f * 100).toFixed(1)
        const col = w.dataset.accent ? accent : ink
        w.style.backgroundImage = `linear-gradient(90deg, ${col} ${p}%, ${muted} ${p}%)`
      }
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    draw()
    el.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
    }
  }, [text, ink, muted, accent, softness])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }}>
      <div ref={scroller} tabIndex={0} aria-label={text} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'none', outline: 'none' }}>
        <p aria-hidden="true" style={{ margin: 0, padding: '22% 8% 55%', font: 'inherit' }}>
          {parts.map((w, i) => (
            <span key={i}>
              <span
                ref={(n) => (words.current[i] = n)}
                data-accent={/[.!?]$/.test(w) ? '1' : undefined}
                style={{ color: 'transparent', WebkitBackgroundClip: 'text', backgroundClip: 'text', backgroundImage: `linear-gradient(90deg, ${muted}, ${muted})` }}
              >
                {w}
              </span>{' '}
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}
