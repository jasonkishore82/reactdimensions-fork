import { useEffect, useRef } from 'react'

// A sine wave travelling along the baseline, letters riding it like corks on
// water. Touch the line and you drop a stone in: a ripple runs out both ways
// from that letter, dying away with distance and time, and adds to the
// steady swell (waves superpose, so crossings make taller peaks).
export default function WaveText({
  text = 'Ripples on the line',
  amplitude = 0.08,
  wavelength = 6,
  speed = 1.2,
  ripple = 0.35,
  style,
}) {
  const root = useRef()
  const spans = useRef([])

  useEffect(() => {
    const els = spans.current.filter(Boolean)
    const stones = [] // { at: letter index, t: start time }
    let raf = 0
    let t = 0
    let last = 0
    let lastHit = -1
    const frame = (now) => {
      last ||= now
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      const k = (2 * Math.PI) / Math.max(1, wavelength)
      for (let i = 0; i < els.length; i++) {
        // the steady swell
        let y = amplitude * Math.sin(k * i - t * speed * 2 * Math.PI * 0.5)
        let slope = amplitude * k * Math.cos(k * i - t * speed * Math.PI)
        // ripples: a packet moving out at 9 letters/s, decaying
        for (const s of stones) {
          const age = t - s.t
          const d = Math.abs(i - s.at)
          const front = age * 9
          const env = Math.exp(-((d - front) ** 2) / 4) * Math.exp(-age * 1.6) * Math.exp(-d * 0.08)
          y += ripple * env * Math.cos((d - front) * 1.4)
          slope += ripple * env * Math.sign(i - s.at) * -1.4 * Math.sin((d - front) * 1.4) * 0.5
        }
        // letters tilt with the slope of the water under them
        els[i].style.transform = `translateY(${(-y).toFixed(4)}em) rotate(${(-Math.atan(slope) * 57.3 * 0.5).toFixed(2)}deg)`
      }
      for (let i = stones.length - 1; i >= 0; i--) if (t - stones[i].t > 3) stones.splice(i, 1)
      raf = requestAnimationFrame(frame)
    }
    const move = (e) => {
      const hit = els.findIndex((el) => {
        const r = el.getBoundingClientRect()
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 10 && e.clientY <= r.bottom + 10
      })
      if (hit >= 0 && hit !== lastHit && stones.length < 6) stones.push({ at: hit, t })
      lastHit = hit
    }
    raf = requestAnimationFrame(frame)
    root.current.addEventListener('pointermove', move)
    const el = root.current
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', move)
    }
  }, [text, amplitude, wavelength, speed, ripple])

  return (
    <span ref={root} aria-label={text} style={{ display: 'inline-block', whiteSpace: 'pre', padding: '0.5em 0', ...style }}>
      {[...String(text)].map((c, i) => (
        <span key={`${i}-${c}`} ref={(n) => (spans.current[i] = n)} aria-hidden="true" style={{ display: 'inline-block', willChange: 'transform', transformOrigin: '50% 70%' }}>
          {c}
        </span>
      ))}
    </span>
  )
}
