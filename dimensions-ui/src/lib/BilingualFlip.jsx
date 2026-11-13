import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// A line in two languages that keeps swapping, word by word: each word
// cross-fades into its translation in a wave from left to right, and its
// slot smoothly widens or narrows to the new word's width, so the line
// reflows gently instead of jumping. Pair words as "first:second", separated
// by commas.
export default function BilingualFlip({
  pairs = 'Light:Lumière, moves:bouge, through:à travers, the:la, quiet:calme, room:pièce',
  interval = 2.6,
  stagger = 90,
  accent = '#ff4d1a',
  style,
}) {
  const list = String(pairs)
    .split(',')
    .map((p) => p.split(':').map((s) => s.trim()))
    .filter((p) => p[0])
    .map(([a, b]) => [a, b || a])
  const [lang, setLang] = useState(0)
  const a = useRef([])
  const b = useRef([])
  const slots = useRef([])

  useEffect(() => {
    const id = setInterval(() => setLang((l) => 1 - l), interval * 1000)
    return () => clearInterval(id)
  }, [interval])

  // each slot animates to the width of the word now showing
  useLayoutEffect(() => {
    list.forEach((_, i) => {
      const s = slots.current[i]
      const w = (lang ? b : a).current[i]?.offsetWidth
      if (s && w) s.style.width = `${w}px`
    })
  }, [lang, pairs])

  return (
    <span aria-label={list.map((p) => p[lang]).join(' ')} style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 0.28em', ...style }}>
      {list.map(([x, y], i) => {
        const d = `${i * stagger}ms`
        return (
          <span
            key={i}
            ref={(n) => (slots.current[i] = n)}
            aria-hidden="true"
            style={{ position: 'relative', display: 'inline-block', height: '1.15em', transition: `width .45s cubic-bezier(.3,.7,.2,1) ${d}` }}
          >
            <span ref={(n) => (a.current[i] = n)} style={{ position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', transition: `opacity .35s ${d}, filter .35s ${d}, transform .45s ${d}`, opacity: lang ? 0 : 1, filter: lang ? 'blur(4px)' : 'none', transform: lang ? 'translateY(-0.25em)' : 'none' }}>
              {x}
            </span>
            <span ref={(n) => (b.current[i] = n)} style={{ position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', fontStyle: 'italic', color: accent, transition: `opacity .35s ${d}, filter .35s ${d}, transform .45s ${d}`, opacity: lang ? 1 : 0, filter: lang ? 'none' : 'blur(4px)', transform: lang ? 'none' : 'translateY(0.25em)' }}>
              {y}
            </span>
          </span>
        )
      })}
    </span>
  )
}
