import { useRef } from 'react'

// Touch a letter and it flips over, like a card, to show an alternate glyph:
// the same letter set in a contrasting italic. The flip ripples out to its
// neighbours, then each one flips back after a moment.
export default function GlyphSwapText({
  text = 'Flip the letters',
  altFont = "italic 400 1em Georgia, 'Times New Roman', serif",
  accent = '#ff4d1a',
  spread = 2,
  hold = 700,
  flip = 260,
  style,
}) {
  const spans = useRef([])
  const busy = useRef(new Set())

  const flipTo = (el, alt) =>
    new Promise((done) => {
      const half = flip / 2
      el.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(90deg)' }], { duration: half, easing: 'ease-in' }).onfinish = () => {
        el.dataset.alt = alt ? '1' : ''
        el.style.font = alt ? altFont : ''
        el.style.color = alt ? accent : ''
        el.animate([{ transform: 'rotateX(-90deg)' }, { transform: 'rotateX(0deg)' }], { duration: half, easing: 'ease-out' }).onfinish = done
      }
    })

  const swap = async (i, delay) => {
    const el = spans.current[i]
    if (!el || busy.current.has(i) || /\s/.test(el.textContent)) return
    busy.current.add(i)
    await new Promise((r) => setTimeout(r, delay))
    await flipTo(el, true)
    await new Promise((r) => setTimeout(r, hold))
    await flipTo(el, false)
    busy.current.delete(i)
  }

  const touch = (i) => {
    for (let d = -spread; d <= spread; d++) swap(i + d, Math.abs(d) * 70)
  }

  return (
    <span aria-label={text} style={{ display: 'inline-block', whiteSpace: 'pre', ...style }}>
      {[...String(text)].map((c, i) => (
        <span key={`${i}-${c}`} aria-hidden="true" style={{ display: 'inline-block', perspective: '2em' }} onPointerEnter={() => touch(i)}>
          <span ref={(el) => (spans.current[i] = el)} style={{ display: 'inline-block', minWidth: c === ' ' ? '0.28em' : undefined, textAlign: 'center', backfaceVisibility: 'hidden' }}>
            {c}
          </span>
        </span>
      ))}
    </span>
  )
}
