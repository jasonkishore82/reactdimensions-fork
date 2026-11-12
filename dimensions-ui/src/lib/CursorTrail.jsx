import { useEffect, useRef } from 'react'

// Cursor trail: a ribbon follows the pointer and fades out behind it. Each
// point takes its colour from whatever it passes over (the first element under
// the pointer with a solid background), so the trail changes as it crosses
// blocks of colour. Wrap your own content, or use the demo swatches.
// Turned off under prefers-reduced-motion.

function colourAt(x, y, skip, fallback) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el === skip) continue
    const c = getComputedStyle(el).backgroundColor
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) continue
    const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
    if (parts.length === 4 && parts[3] === 0) continue
    return invertish(parts[0], parts[1], parts[2])
  }
  return fallback
}
// a trail colour that contrasts with the background underneath
function invertish(r, g, b) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 140 ? `rgb(${r * 0.35 | 0} ${g * 0.35 | 0} ${b * 0.35 | 0})` : `rgb(${(r + 255 * 2) / 3 | 0} ${(g + 255 * 2) / 3 | 0} ${(b + 255 * 2) / 3 | 0})`
}

const SWATCHES = ['#ff4d1a', '#1d2b4f', '#f4d35e', '#2a9d8f', '#f4f1ea', '#7b2cbf']

export default function CursorTrail({
  children,
  length = 28,
  size = 10,
  fadeMs = 600,
  fallbackColor = '#1d2b4f',
  style,
}) {
  const wrap = useRef(null)
  const canvas = useRef(null)
  const pts = useRef([])

  useEffect(() => {
    const cv = canvas.current
    const ctx = cv.getContext('2d')
    let raf = 0
    const fit = () => {
      const r = wrap.current.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      cv.width = r.width * dpr
      cv.height = r.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap.current)
    const draw = () => {
      const now = performance.now()
      pts.current = pts.current.filter((p) => now - p.t < fadeMs).slice(-length)
      ctx.clearRect(0, 0, cv.width, cv.height)
      const list = pts.current
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1]
        const b = list[i]
        const life = 1 - (now - b.t) / fadeMs
        ctx.strokeStyle = b.c
        ctx.globalAlpha = Math.max(0, life)
        ctx.lineWidth = size * (0.25 + 0.75 * (i / list.length)) * life
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [length, size, fadeMs])

  const onMove = (e) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const r = wrap.current.getBoundingClientRect()
    pts.current.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now(), c: colourAt(e.clientX, e.clientY, canvas.current, fallbackColor) })
  }

  return (
    <div ref={wrap} onPointerMove={onMove} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', touchAction: 'none', ...style }}>
      {children ?? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', height: '100%' }}>
          {SWATCHES.map((c) => <div key={c} style={{ background: c }} />)}
        </div>
      )}
      <canvas ref={canvas} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  )
}
