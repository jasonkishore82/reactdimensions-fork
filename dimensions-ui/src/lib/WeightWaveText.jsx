import { useEffect, useRef } from 'react'

// Letters swell in weight as the pointer passes over them, like a wave of ink
// following your hand. Each letter's weight eases toward a target set by its
// distance from the pointer (a smooth bell), so the swell trails slightly and
// settles back to thin when you leave. Uses a variable font, so the weight
// changes continuously instead of in steps: the default stack picks one up on
// most systems (Segoe UI Variable, SF Pro, Inter, Roboto Flex).
export default function WeightWaveText({
  text = 'Swell under the pointer',
  minWeight = 200,
  maxWeight = 900,
  radius = 120,
  ease = 10,
  style,
}) {
  const root = useRef()
  const spans = useRef([])

  useEffect(() => {
    const els = spans.current.filter(Boolean)
    const w = els.map(() => minWeight)
    let centers = []
    let px = -1e6
    let py = -1e6
    let inside = false
    let raf = 0
    let last = 0
    const set = (el, v) => {
      el.style.fontVariationSettings = `'wght' ${v.toFixed(1)}`
      el.style.fontWeight = v.toFixed(0)
    }
    els.forEach((el) => set(el, minWeight))
    const measure = () => {
      centers = els.map((el) => {
        const r = el.getBoundingClientRect()
        return [r.left + r.width / 2, r.top + r.height / 2]
      })
    }
    const frame = (now) => {
      last ||= now
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const k = 1 - Math.exp(-dt * ease)
      let busy = inside
      els.forEach((el, i) => {
        const [cx, cy] = centers[i] ?? [0, 0]
        const d2 = inside ? (px - cx) ** 2 + (py - cy) ** 2 * 1.6 : Infinity
        const target = minWeight + (maxWeight - minWeight) * Math.exp(-d2 / (radius * radius))
        w[i] += (target - w[i]) * k
        if (Math.abs(target - w[i]) > 0.5) busy = true
        set(el, w[i])
      })
      raf = busy ? requestAnimationFrame(frame) : 0
      if (!busy) last = 0
    }
    const move = (e) => {
      const r = root.current.getBoundingClientRect()
      const was = inside
      px = e.clientX
      py = e.clientY
      inside = px > r.left - radius && px < r.right + radius && py > r.top - radius && py < r.bottom + radius
      // weights change letter widths, so only measure when the pointer arrives
      if (inside && !was) measure()
      if ((inside || was) && !raf) raf = requestAnimationFrame(frame)
    }
    window.addEventListener('pointermove', move)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
    }
  }, [text, minWeight, maxWeight, radius, ease])

  return (
    <span
      ref={root}
      aria-label={text}
      style={{ display: 'inline-block', whiteSpace: 'pre', fontFamily: "'Segoe UI Variable Display', 'Segoe UI Variable', 'SF Pro Display', system-ui, 'Inter', 'Roboto Flex', sans-serif", ...style }}
    >
      {[...String(text)].map((c, i) => (
        <span key={`${i}-${c}`} ref={(el) => (spans.current[i] = el)} aria-hidden="true">
          {c}
        </span>
      ))}
    </span>
  )
}
