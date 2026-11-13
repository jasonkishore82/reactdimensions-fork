import { useEffect, useRef } from 'react'

// A number that counts up to its target on rolling digit wheels, geared like
// a mechanical odometer: the units wheel spins freely, and each wheel to its
// left only turns while the wheel beside it rolls over from 9 to 0. So the
// last digits blur past and the leading ones tick over smoothly. Anything
// that isn't a digit ($ , . %) stays fixed in place.
const H = 1.15 // wheel slot height, em

const EASE = {
  out: (t) => 1 - (1 - t) ** 4,
  expo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  linear: (t) => t,
}

export default function CountUpText({
  value = '$12,480.50',
  from = 0,
  duration = 2400,
  easing = 'out',
  roll = true,
  trigger = 'mount',
  style,
}) {
  const chars = [...String(value)]
  const digitIdx = chars.map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0)
  const target = Number(digitIdx.map((i) => chars[i]).join('')) || 0
  const wheels = useRef([])
  const raf = useRef(0)

  // wheel positions for a continuous count x, units wheel first
  const place = (x) => {
    const out = []
    let prev = ((x % 10) + 10) % 10
    out.push(prev)
    for (let p = 1; p < digitIdx.length; p++) {
      const base = Math.floor(x / 10 ** p) % 10
      const carry = prev > 9 ? prev - 9 : 0
      prev = base + carry
      out.push(prev)
    }
    return out
  }

  const draw = (x) => {
    const pos = place(x)
    const n = digitIdx.length
    for (let k = 0; k < n; k++) {
      const el = wheels.current[k]
      if (!el) continue
      const p = n - 1 - k // place value of this wheel
      const v = roll ? pos[p] : Math.floor(pos[p])
      el.style.transform = `translateY(${-v * H}em)`
      // leading zeros sit faded, like unused wheels on a counter
      el.parentElement.style.opacity = p > 0 && x < 10 ** p - 0.5 ? '0.16' : '1'
    }
  }

  const play = () => {
    cancelAnimationFrame(raf.current)
    const ease = EASE[easing] ?? EASE.out
    const start = Math.min(Number(from) || 0, target)
    let t0 = 0
    const frame = (now) => {
      t0 ||= now
      const t = Math.min(1, (now - t0) / duration)
      draw(start + (target - start) * ease(t))
      if (t < 1) raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
  }

  useEffect(() => {
    draw(Math.min(Number(from) || 0, target))
    if (trigger === 'mount') play()
    else draw(target)
    return () => cancelAnimationFrame(raf.current)
  }, [value, from, duration, easing, roll, trigger])

  let k = 0
  return (
    <span
      aria-label={value}
      onPointerEnter={trigger === 'hover' ? play : undefined}
      style={{ display: 'inline-flex', alignItems: 'flex-start', fontVariantNumeric: 'tabular-nums', lineHeight: `${H}em`, whiteSpace: 'pre', ...style }}
    >
      {chars.map((c, i) => {
        if (!/\d/.test(c)) {
          return (
            <span key={i} aria-hidden="true" style={{ height: `${H}em` }}>
              {c}
            </span>
          )
        }
        const idx = k++
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{
              position: 'relative',
              display: 'inline-block',
              height: `${H}em`,
              overflow: 'hidden',
              transition: 'opacity .3s',
              // a soft fade at the top and bottom of the window, like a curved drum
              maskImage: 'linear-gradient(transparent, #000 18%, #000 82%, transparent)',
              WebkitMaskImage: 'linear-gradient(transparent, #000 18%, #000 82%, transparent)',
            }}
          >
            <span ref={(el) => (wheels.current[idx] = el)} style={{ display: 'flex', flexDirection: 'column', willChange: 'transform' }}>
              {'01234567890'.split('').map((d, j) => (
                <span key={j} style={{ height: `${H}em`, textAlign: 'center' }}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}
