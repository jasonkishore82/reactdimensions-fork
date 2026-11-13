import { useEffect, useRef } from 'react'

// A pendulum wave. Each letter hangs on its own string from a slanted bar,
// and every string is a little shorter than the one before. A pendulum's
// period goes with the square root of its length, so the lengths are chosen
// to make letter n swing exactly (K + n) times per cycle. Released together
// they start in a line, drift out of step into travelling waves, split into
// two and three interleaved rows, scramble, and come back into line at the
// end of each cycle. Click to release them all again from the same side.
//
// They swing towards and away from you, so you see them through the
// camera's perspective: the near ones grow, the far ones shrink and rise.
export default function PendulumWave({
  text = 'PENDULUM WAVE',
  cycle = 30,
  swings = 16,
  amplitude = 24,
  plane = 'depth',
  ink = '#1d1d1f',
  accent = '#ff4d1a',
  style,
}) {
  const box = useRef()
  const arms = useRef([])
  const strings = useRef([])

  useEffect(() => {
    const el = box.current
    const chars = [...String(text)]
    const n = chars.length
    let raf = 0
    let t0 = 0
    const A = (amplitude * Math.PI) / 180
    // letter n completes (swings + n) oscillations every cycle
    const periods = chars.map((_, i) => cycle / (swings + i))
    // L = g (T / 2 pi)^2: relative lengths, the first (slowest) is longest
    const rel = periods.map((T) => (T / periods[0]) ** 2)

    const layout = () => {
      const W = el.clientWidth
      const H = el.clientHeight
      const L0 = H * 0.62
      const pitch = Math.min(W * 0.86 / n, H * 0.12)
      const left = (W - pitch * (n - 1)) / 2
      // letters all rest on the same line; the bar slants to suit the lengths
      const rest = H * 0.8
      for (let i = 0; i < n; i++) {
        const a = arms.current[i]
        if (!a) continue
        const len = L0 * rel[i]
        a.style.left = `${left + i * pitch}px`
        a.style.top = `${rest - len}px`
        a.style.height = `${len}px`
        a.style.fontSize = `${pitch * 0.95}px`
      }
      // the frame is a curved rail through every pivot, run on a little past each end
      const bar = el.querySelector('[data-bar]')
      if (bar) {
        const pts = rel.map((r, i) => [left + i * pitch, rest - L0 * r])
        const [a, b] = [pts[0], pts[1] ?? [pts[0][0] + pitch, pts[0][1]]]
        const [c, d] = [pts[n - 2] ?? [pts[n - 1][0] - pitch, pts[n - 1][1]], pts[n - 1]]
        const head = [a[0] - (b[0] - a[0]) * 0.6, a[1] - (b[1] - a[1]) * 0.6]
        const tail = [d[0] + (d[0] - c[0]) * 0.6, d[1] + (d[1] - c[1]) * 0.6]
        bar.setAttribute('points', [head, ...pts, tail].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '))
      }
    }

    const frame = (now) => {
      t0 ||= now
      const t = (now - t0) / 1000
      for (let i = 0; i < n; i++) {
        const a = arms.current[i]
        if (!a) continue
        // small-angle motion, with a hint of air drag that the next click resets
        const th = A * Math.cos((2 * Math.PI * t) / periods[i]) * Math.exp(-t / 400)
        if (plane === 'depth') {
          a.style.transform = `rotateX(${th}rad)`
          // a letter tipped towards you catches more light
          a.style.filter = `brightness(${(1 + 0.25 * Math.sin(th)).toFixed(3)})`
        } else {
          a.style.transform = `rotate(${th}rad)`
          a.style.filter = ''
        }
      }
      raf = requestAnimationFrame(frame)
    }

    const release = () => {
      t0 = 0
    }
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(el)
    el.addEventListener('click', release)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('click', release)
    }
  }, [text, cycle, swings, amplitude, plane])

  return (
    <div
      ref={box}
      role="img"
      aria-label={text}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(120% 90% at 50% 0%, #fbfaf7, #e9e5dd)', perspective: '900px', perspectiveOrigin: '50% -30%', cursor: 'pointer', userSelect: 'none', ...style }}
    >
      <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <polyline data-bar fill="none" stroke="#3a3a3e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {[...String(text)].map((c, i) => (
        <div
          key={`${i}-${c}`}
          ref={(n) => (arms.current[i] = n)}
          aria-hidden="true"
          style={{ position: 'absolute', width: 0, transformOrigin: '0 0', transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
          {c !== ' ' && (
            <>
              <div ref={(n) => (strings.current[i] = n)} style={{ position: 'absolute', left: -0.5, top: 0, bottom: '0.5em', width: 1, background: 'rgba(40,40,44,.55)' }} />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  transform: 'translate(-50%, 0)',
                  font: "800 1em/1 var(--sans, 'Helvetica Neue', Arial, sans-serif)",
                  color: i % 5 === 2 ? accent : ink,
                  textShadow: '0 0.04em 0.06em rgba(0,0,0,.15)',
                }}
              >
                {c}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
