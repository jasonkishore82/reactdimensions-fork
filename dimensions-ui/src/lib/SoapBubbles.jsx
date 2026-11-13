import { useEffect, useRef } from 'react'

// Each letter floats inside its own soap bubble. The bubbles drift on slow
// air currents but stay loosely in order so the word still reads, and they
// wobble as they go (a bubble's skin is elastic, so it breathes in and out
// of round). The film shimmers with thin-film colours that swirl as it
// thins. Touch a bubble and it pops: the film vanishes in an instant, a few
// droplets fly off, the letter drops away, and a new bubble drifts up to
// replace it.
export default function SoapBubbles({
  text = 'BUBBLES',
  size = 1,
  drift = 1,
  ink = '#1d1d1f',
  style,
}) {
  const box = useRef()
  const els = useRef([])

  useEffect(() => {
    const el = box.current
    const chars = [...String(text)]
    let W = el.clientWidth
    let H = el.clientHeight
    const n = chars.length
    const R = Math.min((W * 0.85) / n / 2, H * 0.16) * size
    // the bubble size is set here, from the box, for the whole set
    el.style.setProperty('--rd-sb-d', `${2 * R}px`)
    const homes = chars.map((_, i) => ({ x: W / 2 + (i - (n - 1) / 2) * R * 2.05, y: H * 0.48 }))
    const bs = chars.map((c, i) => ({
      i,
      c,
      x: homes[i].x + (Math.random() - 0.5) * 30,
      y: H + R + Math.random() * H * 0.4,
      vx: 0,
      vy: 0,
      phase: Math.random() * 10,
      state: 'live',
      t: 0,
    }))
    let raf = 0
    let last = 0
    let time = 0
    const frame = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      time += dt
      W = el.clientWidth
      H = el.clientHeight
      for (const b of bs) {
        const node = els.current[b.i]
        if (!node) continue
        const bubble = node.firstChild
        const letter = node.lastChild
        if (b.state === 'live') {
          // air currents: a slowly changing swirl, plus a weak pull home
          const ax = Math.sin(time * 0.6 + b.y * 0.01 + b.phase) * 30 * drift + (homes[b.i].x - b.x) * 0.9
          const ay = Math.cos(time * 0.5 + b.x * 0.012) * 26 * drift + (homes[b.i].y - b.y) * 0.9
          b.vx = (b.vx + ax * dt) * Math.exp(-dt * 1.2)
          b.vy = (b.vy + ay * dt) * Math.exp(-dt * 1.2)
          b.x += b.vx * dt
          b.y += b.vy * dt
          // the skin breathes out of round
          const wob = Math.sin(time * 3.1 + b.phase) * 0.045
          node.style.transform = `translate(${b.x - R}px, ${b.y - R}px)`
          bubble.style.transform = `scale(${1 + wob}, ${1 - wob}) rotate(${time * 20 + b.phase * 30}deg)`
          bubble.style.opacity = '1'
          letter.style.transform = `translateY(${Math.sin(time * 1.4 + b.phase) * 3}px)`
          letter.style.opacity = '1'
        } else if (b.state === 'popped') {
          b.t += dt
          b.vy += 900 * dt
          b.y += b.vy * dt
          node.style.transform = `translate(${b.x - R}px, ${b.y - R}px)`
          letter.style.opacity = String(Math.max(0, 1 - b.t * 1.4))
          bubble.style.opacity = '0'
          if (b.t > 1.4) {
            // a fresh bubble rises from below
            b.state = 'live'
            b.x = homes[b.i].x + (Math.random() - 0.5) * 60
            b.y = H + R * 1.5
            b.vx = 0
            b.vy = -60
          }
        }
      }
      raf = requestAnimationFrame(frame)
    }
    const pop = (b) => {
      if (b.state !== 'live') return
      b.state = 'popped'
      b.t = 0
      b.vy = -40
      const node = els.current[b.i]
      // droplets
      for (let k = 0; k < 8; k++) {
        const d = document.createElement('span')
        const a = (k / 8) * Math.PI * 2
        d.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 0 3px rgba(120,180,255,.8);pointer-events:none`
        el.appendChild(d)
        d.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * R * 1.3}px), calc(-50% + ${Math.sin(a) * R * 1.3 + 20}px))`, opacity: 0 }], { duration: 450, easing: 'ease-out' }).onfinish = () => d.remove()
      }
      node?.animate([{ filter: 'brightness(2)' }, { filter: 'none' }], { duration: 120 })
    }
    const hit = (e) => {
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      for (const b of bs) if (b.state === 'live' && Math.hypot(b.x - x, b.y - y) < R) pop(b)
    }
    el.addEventListener('pointerdown', hit)
    el.addEventListener('pointermove', hit)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', hit)
      el.removeEventListener('pointermove', hit)
    }
  }, [text, size, drift])

  const chars = [...String(text)]
  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(120% 100% at 50% 0%, #dff1ff, #a9cfe9 60%, #7fa9c9)', ...style }}>
      <style>{'@keyframes rd-sb-film { to { filter: hue-rotate(360deg) } }'}</style>
      {chars.map((c, i) => (
        <div
          key={`${i}-${c}`}
          ref={(n) => (els.current[i] = n)}
          aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: 0, width: 'var(--rd-sb-d)', height: 'var(--rd-sb-d)', willChange: 'transform' }}
        >
          {/* the film: transparent middle, iridescent rim, two highlights */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 32% 28%, rgba(255,255,255,.95) 0 6%, transparent 7%), radial-gradient(circle at 70% 75%, rgba(255,255,255,.35) 0 5%, transparent 6%), radial-gradient(circle, transparent 58%, rgba(255,255,255,.18) 70%, rgba(255,255,255,.55) 98%, transparent 100%), conic-gradient(from 30deg, rgba(255,120,200,.35), rgba(120,220,255,.35), rgba(255,240,120,.3), rgba(140,255,170,.3), rgba(255,120,200,.35))',
              WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,.25) 50%, #000 72%)',
              maskImage: 'radial-gradient(circle, rgba(0,0,0,.25) 50%, #000 72%)',
              animation: `rd-sb-film ${6 + (i % 3)}s linear infinite`,
            }}
          />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: `800 calc(var(--rd-sb-d) * 0.5)/1 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif`, color: ink }}>{c === ' ' ? '' : c}</div>
        </div>
      ))}
    </div>
  )
}
