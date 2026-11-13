import { useEffect, useRef } from 'react'

// Pixel sorting, the glitch-art technique: in every column the text's pixels
// are sorted, so all the ink slides down into a solid streak. On reveal the
// streaks un-sort: each pixel travels back up to where it belongs, column by
// column across the word, until the clean glyphs are left. A thin band of
// colour fringes the moving pixels.
export default function PixelSortText({
  text = 'SORTED',
  duration = 1600,
  color = '#1c1a16',
  accent = '#ff4d1a',
  trigger = 'mount',
  style,
}) {
  const wrap = useRef()
  const canvas = useRef()
  const raf = useRef(0)

  const play = () => {
    cancelAnimationFrame(raf.current)
    const cv = canvas.current
    const fs = parseFloat(getComputedStyle(wrap.current).fontSize) || 96
    const font = getComputedStyle(wrap.current).font
    const px = Math.max(2, Math.round(fs / 40)) // size of one "pixel"
    // rasterise the text into a grid of cells
    const off = document.createElement('canvas')
    const g = off.getContext('2d', { willReadFrequently: true })
    g.font = font
    const W = Math.ceil(g.measureText(text).width + fs * 0.2)
    const H = Math.ceil(fs * 1.25)
    off.width = Math.ceil(W / px)
    off.height = Math.ceil(H / px)
    g.scale(1 / px, 1 / px)
    g.font = font
    g.textBaseline = 'middle'
    g.fillText(text, fs * 0.1, H / 2)
    const data = g.getImageData(0, 0, off.width, off.height).data
    const cols = off.width
    const rows = off.height
    // per column: the ink cells, where they are, and where sorting puts them
    const parts = []
    for (let x = 0; x < cols; x++) {
      const ink = []
      for (let y = 0; y < rows; y++) if (data[(y * cols + x) * 4 + 3] > 110) ink.push(y)
      ink.forEach((y, k) => parts.push({ x, y, sy: rows - ink.length + k, col: x }))
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = W * dpr
    cv.height = H * dpr
    cv.style.width = `${W}px`
    cv.style.height = `${H}px`
    const c = cv.getContext('2d')
    c.scale(dpr, dpr)
    const ease = (t) => 1 - (1 - t) ** 3
    let t0 = 0
    const frame = (now) => {
      t0 ||= now
      const t = (now - t0) / duration
      c.clearRect(0, 0, W, H)
      let moving = false
      for (const p of parts) {
        // columns un-sort left to right, each taking 40% of the run
        const start = (p.col / cols) * 0.6
        const u = Math.max(0, Math.min(1, (t - start) / 0.4))
        if (u < 1) moving = true
        const y = p.sy + (p.y - p.sy) * ease(u)
        c.fillStyle = u > 0 && u < 1 ? accent : color
        c.fillRect(p.x * px, y * px, px + 0.5, px + 0.5)
      }
      if (moving) raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
  }

  useEffect(() => {
    if (trigger === 'mount') document.fonts?.ready.then(play) ?? play()
    else play()
    return () => cancelAnimationFrame(raf.current)
  }, [text, duration, color, accent, trigger])

  return (
    <span ref={wrap} role="img" aria-label={text} onPointerEnter={trigger === 'hover' ? play : undefined} style={{ display: 'inline-block', lineHeight: 0, ...style }}>
      <canvas ref={canvas} />
    </span>
  )
}
