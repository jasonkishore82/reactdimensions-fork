import { useEffect, useRef } from 'react'

// Lines of type at different depths, scrolling past at different rates, like
// layers in a diorama: the near lines are big, sharp and fast, the far ones
// small, faint, softly blurred and slow. Each line drifts through the middle
// in turn as you scroll the box. Separate lines with "|".
export default function ParallaxLines({
  text = 'Near things rush past|Middle ground drifts|Far away barely moves|The horizon holds still',
  depth = 1,
  background = '#f7f7f8',
  ink = '#1c1a16',
  accent = '#ff4d1a',
  style,
}) {
  const scroller = useRef()
  const view = useRef()
  const lines = useRef([])
  const parts = String(text).split('|').map((l) => l.trim()).filter(Boolean)

  // depth per line: the first line is nearest, the last farthest away
  const layer = (i) => 1 - (0.85 * i) / Math.max(1, parts.length - 1)

  useEffect(() => {
    const el = scroller.current
    let raf = 0
    const draw = () => {
      raf = 0
      const H = el.clientHeight
      const s = el.scrollTop
      const n = parts.length
      parts.forEach((_, i) => {
        const node = lines.current[i]
        if (!node) return
        const z = layer(i)
        const rate = 0.2 + 1.6 * z * depth
        const h = node.offsetHeight
        // start spread down the view, then each drifts up at its own rate and
        // wraps round to the bottom, so the layers keep sliding past each other
        const span = H + h * 2
        const base = H * (0.18 + (0.64 * i) / Math.max(1, n - 1))
        const y = ((((base - s * rate + h) % span) + span) % span) - h
        node.style.transform = `translate3d(-50%, ${(y - h / 2).toFixed(1)}px, 0) scale(${0.55 + 0.6 * z})`
      })
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    draw()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [text, depth])

  return (
    <div style={{ position: 'relative', isolation: 'isolate', width: '100%', height: '100%', overflow: 'hidden', background, color: ink, ...style }}>
      <div ref={scroller} tabIndex={0} aria-label={parts.join('. ')} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'none', outline: 'none' }}>
        <div style={{ height: '700%' }}>
          <div ref={view} aria-hidden="true" style={{ position: 'sticky', top: 0, height: `${100 / 7}%`, overflow: 'hidden' }}>
            {parts.map((l, i) => {
              const z = layer(i)
              return (
                <div
                  key={i}
                  ref={(n) => (lines.current[i] = n)}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    whiteSpace: 'nowrap',
                    willChange: 'transform',
                    zIndex: Math.round(z * 10),
                    opacity: 0.25 + 0.75 * z,
                    filter: z < 0.5 ? `blur(${((0.5 - z) * 4).toFixed(1)}px)` : 'none',
                    color: z === 1 ? accent : ink,
                  }}
                >
                  {l}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
