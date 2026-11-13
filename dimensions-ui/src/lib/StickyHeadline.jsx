import { useEffect, useRef } from 'react'

// A big headline that, as you scroll the article, shrinks and slides up into
// the bar at the top, becoming its title. The bar fills in behind it once it
// arrives. One continuous move driven by scroll position, so scrolling back
// down lets it grow back out into the page.
const BAR = 52

export default function StickyHeadline({
  headline = 'The quiet hour',
  kicker = 'Essay · 6 min read',
  titleSize = 15,
  distance = 180,
  background = '#f7f7f8',
  ink = '#1c1a16',
  accent = '#ff4d1a',
  style,
}) {
  const scroller = useRef()
  const head = useRef()
  const bar = useRef()
  const kick = useRef()

  useEffect(() => {
    const el = scroller.current
    let raf = 0
    const draw = () => {
      raf = 0
      const p = Math.min(1, Math.max(0, el.scrollTop / distance))
      const e = p * p * (3 - 2 * p) // smoothstep
      const h = head.current
      const big = parseFloat(getComputedStyle(h).fontSize) || 64
      const s = 1 + (titleSize / big - 1) * e
      // from its place in the page to the left of the bar, vertically centred
      const x0 = 28
      const y0 = 92
      const x1 = 20
      const y1 = (BAR - h.offsetHeight * (titleSize / big)) / 2
      h.style.transform = `translate(${(x0 + (x1 - x0) * e).toFixed(2)}px, ${(y0 + (y1 - y0) * e).toFixed(2)}px) scale(${s.toFixed(4)})`
      bar.current.style.opacity = String(Math.max(0, (p - 0.6) / 0.4))
      kick.current.style.opacity = String(1 - Math.min(1, p * 2.5))
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
  }, [headline, titleSize, distance])

  const para = 'Scroll the article. The headline shrinks into the bar above and stays there as its title, and grows back out when you return to the top. '
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, color: ink, ...style }}>
      <div
        ref={bar}
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BAR, zIndex: 2, background: `${background}e6`, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(28,26,22,.12)', opacity: 0 }}
      />
      <h2
        ref={head}
        style={{ position: 'absolute', left: 0, top: 0, zIndex: 3, margin: 0, transformOrigin: '0 0', whiteSpace: 'nowrap', font: 'inherit', lineHeight: 1, pointerEvents: 'none' }}
      >
        {headline}
      </h2>
      <div ref={scroller} tabIndex={0} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin', outline: 'none' }}>
        <div ref={kick} style={{ padding: '58px 28px 0', font: '500 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: accent }}>
          {kicker}
        </div>
        {/* room for the headline while it sits in the page */}
        <div style={{ height: '1.25em' }} />
        <div style={{ padding: '24px 28px 120px', maxWidth: 620, font: '400 15px/1.7 Georgia, serif', color: `${ink}cc` }}>
          {[...Array(9)].map((_, i) => (
            <p key={i} style={{ margin: '0 0 1em' }}>
              {para.repeat(2 + (i % 2))}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
