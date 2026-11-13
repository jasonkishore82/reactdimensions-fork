import { useEffect, useRef } from 'react'

// A solid bar sweeps across each line: it grows to cover the line, the text
// appears underneath, and the bar pulls away off the far side. Separate
// lines with "|"; each one starts a little after the last.
const EASE = 'cubic-bezier(.77,0,.18,1)'

export default function MaskWipeText({
  text = 'Masked|and revealed.',
  duration = 1100,
  stagger = 160,
  barColor = '#ff4d1a',
  direction = 'left',
  trigger = 'mount',
  style,
}) {
  const lines = String(text).split('|')
  const bars = useRef([])
  const words = useRef([])
  const anims = useRef([])

  const play = () => {
    for (const a of anims.current) a.cancel()
    anims.current = []
    const from = direction === 'right' ? 'right' : 'left'
    const to = from === 'left' ? 'right' : 'left'
    lines.forEach((_, i) => {
      const bar = bars.current[i]
      const word = words.current[i]
      if (!bar || !word) return
      const timing = { duration, delay: i * stagger, fill: 'both' }
      // the bar grows from one side, then shrinks toward the other
      anims.current.push(
        bar.animate(
          [
            { transform: 'scaleX(0)', transformOrigin: `${from} center`, easing: EASE, offset: 0 },
            { transform: 'scaleX(1)', transformOrigin: `${from} center`, offset: 0.5 },
            { transform: 'scaleX(1)', transformOrigin: `${to} center`, easing: EASE, offset: 0.5001 },
            { transform: 'scaleX(0)', transformOrigin: `${to} center`, offset: 1 },
          ],
          timing,
        ),
      )
      // the text switches on while the bar fully covers it
      anims.current.push(
        word.animate(
          [
            { opacity: 0, offset: 0 },
            { opacity: 0, offset: 0.5 },
            { opacity: 1, offset: 0.5001 },
            { opacity: 1, offset: 1 },
          ],
          timing,
        ),
      )
    })
  }

  useEffect(() => {
    if (trigger === 'mount') play()
    return () => {
      for (const a of anims.current) a.cancel()
    }
  }, [text, duration, stagger, barColor, direction, trigger])

  return (
    <span aria-label={lines.join(' ')} onPointerEnter={trigger === 'hover' ? play : undefined} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', ...style }}>
      {lines.map((line, i) => (
        <span key={i} aria-hidden="true" style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre', padding: '0 0.06em' }}>
          <span ref={(el) => (words.current[i] = el)} style={{ display: 'inline-block' }}>
            {line}
          </span>
          <span
            ref={(el) => (bars.current[i] = el)}
            style={{ position: 'absolute', inset: '0.06em 0', background: barColor, transform: 'scaleX(0)', pointerEvents: 'none' }}
          />
        </span>
      ))}
    </span>
  )
}
