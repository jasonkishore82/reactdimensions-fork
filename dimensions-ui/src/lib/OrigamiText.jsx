import { useEffect, useState } from 'react'

// Each letter is one strip of paper folded up small, and it unfolds itself
// panel by panel into the letter shape. The panels are the cells of a 3x5
// letter grid, joined into a tree: each panel is hinged on the edge it
// shares with the panel it unfolds from, so when it swings open it carries
// everything still folded on it, exactly as a folded sheet opens. The paper
// shades as it turns, so you can see each crease.
// A 3x5 block font. Where a shape allows it the cells join edge to edge,
// so the letter can be a single folded sheet; letters that need diagonal
// strokes (K, X, Z...) come out as two or three separate sheets.
const FONT = {
  A: '111101111101101', B: '110101111101110', C: '111100100100111', D: '111101101101110', E: '111100110100111',
  F: '111100110100100', G: '111100101101111', H: '101101111101101', I: '111010010010111', J: '001001001101111',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '111101101101101', O: '111101101101111',
  P: '111101111100100', Q: '111101101111001', R: '111101110101101', S: '111100111001111', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101111010010',
  Z: '111001010100111', 0: '111101101101111', 1: '110010010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111',
  9: '111101111001111', '!': '010010010000010', '?': '111001011000010', '-': '000000111000000', '.': '000000000000010',
}

// Build the hinge trees over a letter's filled cells: breadth first from
// the first unvisited cell, so every edge-connected group of cells becomes
// its own sheet (a forest, one tree per sheet). Each child records which
// side of its parent it's hinged to.
function treesFor(ch) {
  const bits = FONT[ch] || FONT['?']
  const on = (x, y) => x >= 0 && x < 3 && y >= 0 && y < 5 && bits[y * 3 + x] === '1'
  const seen = new Set()
  const roots = []
  for (let start = 0; start < 15; start++) {
    if (bits[start] !== '1' || seen.has(start)) continue
    seen.add(start)
    const root = { x: start % 3, y: (start / 3) | 0, kids: [], depth: 0 }
    const q = [root]
    while (q.length) {
      const n = q.shift()
      for (const [dx, dy, side] of [[1, 0, 'right'], [0, 1, 'bottom'], [-1, 0, 'left'], [0, -1, 'top']]) {
        const x = n.x + dx
        const y = n.y + dy
        const k = y * 3 + x
        if (on(x, y) && !seen.has(k)) {
          seen.add(k)
          const kid = { x, y, side, kids: [], depth: n.depth + 1 }
          n.kids.push(kid)
          q.push(kid)
        }
      }
    }
    roots.push(root)
  }
  return roots
}

const HINGE = {
  right: { pos: { left: '100%', top: 0 }, origin: '0 50%', axis: 'Y', sign: -1 },
  left: { pos: { right: '100%', top: 0 }, origin: '100% 50%', axis: 'Y', sign: 1 },
  bottom: { pos: { left: 0, top: '100%' }, origin: '50% 0', axis: 'X', sign: 1 },
  top: { pos: { left: 0, bottom: '100%' }, origin: '50% 100%', axis: 'X', sign: -1 },
}

function Panel({ n, open, delay, paper, step }) {
  const h = n.side ? HINGE[n.side] : null
  // folded flat back over its parent = 180deg; open = 0
  const deg = h ? (open ? 0 : 179.9 * h.sign) : 0
  const t = n.depth * step
  return (
    <div
      style={{
        position: 'absolute',
        width: '1em',
        height: '1em',
        ...(h ? h.pos : { left: 0, top: 0 }),
        transformOrigin: h ? h.origin : '50% 50%',
        transformStyle: 'preserve-3d',
        transform: h ? `rotate${h.axis}(${deg}deg)` : undefined,
        transition: `transform ${step * 0.9}ms cubic-bezier(.45,0,.25,1) ${delay + t}ms`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: paper,
          // creases: a fold shades the panel as it tilts, and leaves a faint line
          boxShadow: 'inset 0 0 0 0.012em rgba(0,0,0,.18), inset 0.04em 0.04em 0.08em rgba(255,255,255,.4), 0.04em 0.06em 0.08em rgba(0,0,0,.12)',
          filter: open ? 'brightness(1)' : 'brightness(.72)',
          transition: `filter ${step * 0.9}ms ${delay + t}ms`,
          backfaceVisibility: 'visible',
        }}
      />
      {n.kids.map((k, i) => (
        <Panel key={i} n={k} open={open} delay={delay} paper={paper} step={step} />
      ))}
    </div>
  )
}

export default function OrigamiText({
  text = 'FOLD',
  paper = '#f3efe6',
  accent = '#ff4d1a',
  step = 420,
  stagger = 500,
  style,
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    setOpen(false)
    const id = setTimeout(() => setOpen(true), 250)
    return () => clearTimeout(id)
  }, [text, step, stagger])

  const chars = [...String(text).toUpperCase()]
  return (
    <div
      role="img"
      aria-label={text}
      onClick={() => {
        setOpen(false)
        setTimeout(() => setOpen(true), chars.length * stagger + 1200)
      }}
      style={{ display: 'inline-flex', gap: '1em', perspective: '30em', cursor: 'pointer', ...style }}
    >
      {chars.map((ch, i) => {
        const roots = ch === ' ' ? [] : treesFor(ch)
        return (
          <div key={i} style={{ position: 'relative', width: '3em', height: '5em', perspective: '24em', transformStyle: 'preserve-3d' }}>
            {roots.map((root, r) => (
              <div key={r} style={{ position: 'absolute', left: `${root.x}em`, top: `${root.y}em`, transformStyle: 'preserve-3d' }}>
                <Panel n={root} open={open} delay={(open ? i * stagger : (chars.length - 1 - i) * 80) + r * 120} paper={i % 4 === 1 ? accent : paper} step={open ? step : 120} />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
