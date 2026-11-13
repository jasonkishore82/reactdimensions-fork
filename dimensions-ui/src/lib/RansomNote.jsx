import { useEffect, useState } from 'react'

// A ransom note: every letter cut from a different magazine or newspaper,
// each with its own typeface, size, paper and ink, roughly trimmed, slid
// into place a little crooked and fixed down with a strip of tape. The cuts
// and tilts are random but stable for the text, so it doesn't reshuffle on
// every render. Click to cut a new set.
const FONTS = [
  "900 1em 'Arial Black', Impact, sans-serif",
  "700 1em Georgia, 'Times New Roman', serif",
  "italic 700 1em 'Times New Roman', serif",
  "400 1em 'Courier New', monospace",
  "800 1em 'Trebuchet MS', sans-serif",
  "700 1em 'Brush Script MT', cursive",
  "900 1em 'Rockwell', 'Georgia', serif",
  "700 1em 'Comic Sans MS', sans-serif",
  "600 1em 'Didot', 'Bodoni MT', 'Times New Roman', serif",
  "800 1em Impact, 'Arial Narrow', sans-serif",
]
const PAPERS = [
  ['#fffdf7', '#111'], ['#111', '#fff'], ['#ffe14d', '#111'], ['#e8423f', '#fff'], ['#f3ead8', '#5a2d0c'],
  ['#2b59c3', '#fff'], ['#f7c7d4', '#2a0b14'], ['#dfe6e9', '#1c1c1c'], ['#ffffff', '#c0161c'], ['#1f7a4d', '#f8f3e4'],
]

function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

export default function RansomNote({
  text = 'PAY UP BY NOON',
  stagger = 110,
  seed = 7,
  tape = true,
  style,
}) {
  const [shuffle, setShuffle] = useState(0)
  const [shown, setShown] = useState(0)
  const chars = [...String(text)]

  useEffect(() => {
    setShown(0)
    let i = 0
    const id = setInterval(() => {
      i++
      setShown(i)
      if (i >= chars.length) clearInterval(id)
    }, stagger)
    return () => clearInterval(id)
  }, [text, stagger, shuffle])

  const r = rng(seed * 7919 + shuffle * 104729 + 1)
  return (
    <div role="img" aria-label={text} onClick={() => setShuffle((s) => s + 1)} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '0.12em 0.04em', maxWidth: '9em', cursor: 'pointer', ...style }}>
      {chars.map((ch, i) => {
        const font = FONTS[Math.floor(r() * FONTS.length)]
        const [bg, fg] = PAPERS[Math.floor(r() * PAPERS.length)]
        const size = 0.75 + r() * 0.5
        const rot = (r() - 0.5) * 14
        const upper = r() > 0.35
        // a rough scissor cut: an irregular polygon a little bigger than the glyph
        const cut = `polygon(${r() * 8}% ${r() * 10}%, ${92 + r() * 8}% ${r() * 8}%, ${94 + r() * 6}% ${90 + r() * 10}%, ${r() * 6}% ${92 + r() * 8}%)`
        const tapeRot = (r() - 0.5) * 30
        const from = { x: (r() - 0.5) * 3, y: -1.2 - r(), rot: rot + (r() - 0.5) * 60 }
        if (ch === ' ') return <span key={i} style={{ width: '0.4em' }} />
        const visible = i < shown
        return (
          <span
            key={`${i}-${shuffle}`}
            style={{
              position: 'relative',
              display: 'inline-block',
              transform: visible ? `rotate(${rot}deg)` : `translate(${from.x}em, ${from.y}em) rotate(${from.rot}deg)`,
              opacity: visible ? 1 : 0,
              transition: 'transform 420ms cubic-bezier(.2,.9,.3,1.15), opacity 200ms',
            }}
          >
            <span style={{ display: 'inline-block', padding: '0.06em 0.12em', background: bg, color: fg, font, fontSize: `${size}em`, lineHeight: 1.05, clipPath: cut, boxShadow: '0 0.04em 0.06em rgba(0,0,0,.25)', textTransform: upper ? 'uppercase' : 'lowercase' }}>{ch}</span>
            {tape && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '-0.12em',
                  width: '0.7em',
                  height: '0.24em',
                  marginLeft: '-0.35em',
                  background: 'rgba(255,255,240,.55)',
                  boxShadow: '0 0 0 0.01em rgba(0,0,0,.06)',
                  transform: `rotate(${tapeRot}deg) scale(${visible ? 1 : 0})`,
                  transition: `transform 160ms ease-out ${visible ? 300 : 0}ms`,
                  backdropFilter: 'blur(0.4px)',
                }}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}
