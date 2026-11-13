import { useEffect, useRef } from 'react'

// Lines on cards that rise up from the bottom as you scroll and pile onto a
// stack, each landing just below the last so its top edge peeks out. Cards
// that get covered sink back a little, smaller and dimmer, like a real deck
// seen from above. Scroll back and they lift off again. Separate lines with "|".
export default function StackLines({
  text = 'Collect the lines|Stack them like cards|Each one lands on the last|The ones underneath sink back|Scroll up to lift them off',
  peek = 16,
  card = '#ffffff',
  ink = '#1c1a16',
  accent = '#ff4d1a',
  background = '#f7f7f8',
  style,
}) {
  const scroller = useRef()
  const cards = useRef([])
  const parts = String(text).split('|').map((s) => s.trim()).filter(Boolean)

  useEffect(() => {
    const el = scroller.current
    let raf = 0
    const ease = (t) => 1 - (1 - t) ** 3
    const draw = () => {
      raf = 0
      const H = el.clientHeight
      const step = H * 0.55
      const s = el.scrollTop
      const n = parts.length
      // how far each card has come in, 0 (below the box) to 1 (on the stack)
      const prog = parts.map((_, i) => Math.min(1, Math.max(0, s / step - i + 0.6)))
      parts.forEach((_, i) => {
        const c = cards.current[i]
        if (!c) return
        const p = ease(prog[i])
        const h = c.offsetHeight
        const restY = H * 0.16 + i * peek
        const y = H + 10 + (restY - H - 10) * p
        // covered by how many cards (fractionally, as they arrive)
        let over = 0
        for (let j = i + 1; j < n; j++) over += ease(prog[j])
        const scale = 1 - Math.min(0.2, over * 0.045)
        c.style.transform = `translate3d(-50%, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(4)}) rotate(${((1 - p) * (i % 2 ? 3 : -3)).toFixed(2)}deg)`
        c.style.filter = `brightness(${(1 - Math.min(0.25, over * 0.06)).toFixed(3)})`
        c.style.visibility = y > H + 8 && p === 0 ? 'hidden' : 'visible'
        c.style.zIndex = String(i)
        void h
      })
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
  }, [text, peek])

  return (
    <div style={{ position: 'relative', isolation: 'isolate', width: '100%', height: '100%', overflow: 'hidden', background, color: ink, ...style }}>
      <div ref={scroller} tabIndex={0} aria-label={parts.join('. ')} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'none', outline: 'none' }}>
        <div style={{ height: `${100 + parts.length * 55}%` }}>
          <div aria-hidden="true" style={{ position: 'sticky', top: 0, height: `${10000 / (100 + parts.length * 55)}%`, overflow: 'hidden' }}>
            {parts.map((l, i) => (
              <div
                key={i}
                ref={(n) => (cards.current[i] = n)}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  width: 'min(86%, 15em)',
                  padding: '0.55em 0.7em 0.6em',
                  boxSizing: 'border-box',
                  borderRadius: '0.28em',
                  background: card,
                  boxShadow: '0 1px 0 rgba(0,0,0,.04), 0 12px 30px rgba(28,26,22,.12), inset 0 0 0 1px rgba(28,26,22,.07)',
                  transformOrigin: '50% 0',
                  willChange: 'transform',
                  visibility: 'hidden',
                }}
              >
                <div style={{ font: '600 0.2em/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', color: accent, marginBottom: '0.9em' }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ lineHeight: 1.05 }}>{l}</div>
              </div>
            ))}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', font: '500 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', color: `${ink}80` }}>Scroll to deal ↓</div>
          </div>
        </div>
      </div>
    </div>
  )
}
