import { useEffect, useRef } from 'react'

// Grab a word and pull: the letter under your finger comes with you and the
// rest of the word stretches after it like a rubber band, the far letters
// moving less. The further you pull the harder it resists. Let go and every
// letter snaps home on a springy, under-damped return that wobbles to rest.
export default function RubberBandText({
  text = 'Pull any word',
  resistance = 140,
  stiffness = 320,
  damping = 9,
  style,
}) {
  const spans = useRef([])
  const st = useRef({ L: [], drag: null, raf: 0, last: 0 })

  const words = []
  let idx = 0
  for (const part of String(text).split(/(\s+)/)) {
    if (!part) continue
    const letters = [...part].map((c) => ({ c, i: idx++ }))
    words.push({ space: /^\s+$/.test(part), letters })
  }

  useEffect(() => {
    const s = st.current
    s.L = spans.current.map((el) => (el ? { el, x: 0, y: 0, vx: 0, vy: 0 } : null))
    const frame = (now) => {
      s.last ||= now
      const dt = Math.min(0.033, (now - s.last) / 1000)
      s.last = now
      let busy = !!s.drag
      s.L.forEach((l, i) => {
        if (!l) return
        let tx = 0
        let ty = 0
        if (s.drag && s.drag.word.includes(i)) {
          // soft limit: pulling further stretches less and less
          const d = Math.hypot(s.drag.dx, s.drag.dy) || 1
          const reach = resistance * Math.tanh(d / resistance)
          const k = Math.exp(-((i - s.drag.at) ** 2) / (2 * s.drag.sigma ** 2))
          tx = (s.drag.dx / d) * reach * k
          ty = (s.drag.dy / d) * reach * k
        }
        if (s.drag && s.drag.word.includes(i)) {
          // while held, letters follow quickly with no wobble
          const f = 1 - Math.exp(-dt * 30)
          l.vx = (tx - l.x) / Math.max(dt, 1e-3)
          l.vy = (ty - l.y) / Math.max(dt, 1e-3)
          l.x += (tx - l.x) * f
          l.y += (ty - l.y) * f
        } else {
          l.vx += (stiffness * (tx - l.x) - damping * l.vx) * dt
          l.vy += (stiffness * (ty - l.y) - damping * l.vy) * dt
          l.x += l.vx * dt
          l.y += l.vy * dt
        }
        if (Math.abs(l.x) + Math.abs(l.y) + Math.abs(l.vx) + Math.abs(l.vy) > 0.05) busy = true
        l.el.style.transform = `translate(${l.x.toFixed(2)}px, ${l.y.toFixed(2)}px)`
      })
      s.raf = busy ? requestAnimationFrame(frame) : 0
      if (!busy) s.last = 0
    }
    s.kick = () => {
      if (!s.raf) s.raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      if (!s.drag) return
      s.drag.dx = e.clientX - s.drag.x0
      s.drag.dy = e.clientY - s.drag.y0
    }
    const up = () => {
      if (!s.drag) return
      // the release fling: keep the speed the letters had, but cap it
      for (const l of s.L) {
        if (!l) continue
        l.vx = Math.max(-1500, Math.min(1500, l.vx * 0.3))
        l.vy = Math.max(-1500, Math.min(1500, l.vy * 0.3))
      }
      s.drag = null
      document.body.style.cursor = ''
      s.kick()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      cancelAnimationFrame(s.raf)
      s.raf = 0
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [text, resistance, stiffness, damping])

  const grab = (word, at) => (e) => {
    e.preventDefault()
    const s = st.current
    s.drag = { word, at, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, sigma: Math.max(0.8, word.length * 0.32) }
    document.body.style.cursor = 'grabbing'
    s.kick?.()
  }

  return (
    <span aria-label={text} style={{ display: 'inline-block', whiteSpace: 'pre', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', ...style }}>
      {words.map((w, wi) => {
        if (w.space) return <span key={wi}>{w.letters.map((l) => l.c).join('')}</span>
        const ids = w.letters.map((l) => l.i)
        return (
          <span key={wi} aria-hidden="true" style={{ display: 'inline-block', cursor: 'grab' }}>
            {w.letters.map((l) => (
              <span key={l.i} ref={(el) => (spans.current[l.i] = el)} onPointerDown={grab(ids, l.i)} style={{ display: 'inline-block', willChange: 'transform' }}>
                {l.c}
              </span>
            ))}
          </span>
        )
      })}
    </span>
  )
}
