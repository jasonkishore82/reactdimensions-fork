import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// A typographic poster where every line is sized to run exactly edge to
// edge, so short lines become huge and long ones small, like a Swiss poster.
// Every few seconds the words regroup into a new set of lines and each line
// springs to its new size. Resize the box and it refits.
function regroup(words, seed) {
  // split the words into 2 to 4 lines at varying break points
  const n = words.length
  const lines = Math.min(n, 2 + (seed % 3))
  const out = []
  let i = 0
  for (let l = 0; l < lines; l++) {
    const left = n - i
    const room = lines - l
    const take = l === lines - 1 ? left : Math.max(1, Math.min(left - (room - 1), Math.round(left / room + (((seed * (l + 3)) % 3) - 1))))
    out.push(words.slice(i, i + take).join(' '))
    i += take
  }
  return out
}

export default function KineticPoster({
  text = 'Type that fills the frame from edge to edge every time',
  interval = 3,
  ink = '#1c1a16',
  accent = '#ff4d1a',
  background = '#f7f7f8',
  style,
}) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const [seed, setSeed] = useState(0)
  const box = useRef()
  const lines = useRef([])
  const size = useRef([]) // springs: { s, v }
  const groups = regroup(words, seed)

  useEffect(() => {
    const id = setInterval(() => setSeed((s) => s + 1), interval * 1000)
    return () => clearInterval(id)
  }, [interval])

  // spring every line's font size to the size that makes it fit the width
  useLayoutEffect(() => {
    const el = box.current
    let raf = 0
    let last = 0
    let W = 0
    let w100 = []
    const targets = () => {
      W = el.clientWidth - 48
      const H = el.clientHeight - 48
      w100 = lines.current.slice(0, groups.length).map((n) => {
        if (!n) return 1
        // measure at a reference size, without any tracking
        const prev = [n.style.fontSize, n.style.letterSpacing]
        n.style.fontSize = '100px'
        n.style.letterSpacing = '0px'
        const w = n.scrollWidth || 1
        ;[n.style.fontSize, n.style.letterSpacing] = prev
        return w
      })
      const raw = w100.map((w) => (100 * W) / w)
      // if the stack is too tall, scale all lines down together
      const total = raw.reduce((a, b) => a + b * 0.86, 0)
      const k = total > H ? H / total : 1
      return raw.map((v) => v * k)
    }
    let goal = targets()
    const frame = (now) => {
      last ||= now
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      let busy = false
      goal.forEach((g, i) => {
        const sp = (size.current[i] ??= { s: g * 0.5, v: 0 })
        sp.v += (180 * (g - sp.s) - 18 * sp.v) * dt
        sp.s += sp.v * dt
        if (Math.abs(g - sp.s) > 0.2 || Math.abs(sp.v) > 0.5) busy = true
        const n = lines.current[i]
        if (n) {
          const fs = Math.max(4, sp.s)
          n.style.fontSize = `${fs.toFixed(2)}px`
          // whatever width the size leaves, spread across the gaps between
          // letters, so the line still runs exactly edge to edge
          const gaps = Math.max(1, groups[i].length - 1)
          const ls = Math.max(0, (W - (w100[i] * fs) / 100) / gaps)
          n.style.letterSpacing = `${ls.toFixed(2)}px`
          // spacing also lands after the last letter: take it back
          n.style.marginRight = `${(-ls).toFixed(2)}px`
        }
      })
      raf = busy ? requestAnimationFrame(frame) : 0
      if (!busy) last = 0
    }
    raf = requestAnimationFrame(frame)
    const ro = new ResizeObserver(() => {
      goal = targets()
      if (!raf) raf = requestAnimationFrame(frame)
    })
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [seed, text])

  return (
    <div ref={box} aria-label={text} role="img" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, color: ink, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, boxSizing: 'border-box', ...style }}>
      {groups.map((g, i) => (
        <div
          key={i}
          ref={(n) => (lines.current[i] = n)}
          aria-hidden="true"
          style={{ whiteSpace: 'nowrap', lineHeight: 0.86, color: i === (seed % groups.length) ? accent : ink, transition: 'color .4s', alignSelf: 'flex-start' }}
        >
          {g}
        </div>
      ))}
    </div>
  )
}
