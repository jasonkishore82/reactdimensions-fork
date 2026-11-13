import { useEffect, useState } from 'react'

// Each letter is one strip of paper folded up small, and it unfolds itself
// panel by panel into the letter shape. The panels are the cells of a 3x5
// letter grid, joined into a tree: each panel is hinged on the edge it
// shares with the panel it unfolds from, so when it swings open it carries
// everything still folded on it, exactly as a folded sheet opens. The paper
// shades as it turns, so you can see each crease.
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '!': '010010010000010', '?': '110001010000010', '-': '000000111000000', '.': '000000000000010',
}

// build a hinge tree over a letter's filled cells, breadth first from the
// first filled cell; each child records which side of its parent it's on
function treeFor(ch) {
  const bits = FONT[ch] || FONT['?']
  const on = (x, y) => x >= 0 && x < 3 && y >= 0 && y < 5 && bits[y * 3 + x] === '1'
  const start = [...bits].indexOf('1')
  if (start < 0) return null
  const seen = new Set([start])
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
  return root
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
          boxShadow: 'inset 0 0 0 0.012em rgba(0,0,0,.18), inset 0.04em 0.04em 0.08em rgba(255,255,255,.4)',
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
        const root = ch === ' ' ? null : treeFor(ch)
        return (
          <div key={i} style={{ position: 'relative', width: '3em', height: '5em', transformStyle: 'preserve-3d', filter: 'drop-shadow(0.06em 0.1em 0.06em rgba(0,0,0,.18))' }}>
            {root && (
              <div style={{ position: 'absolute', left: `${root.x}em`, top: `${root.y}em`, transformStyle: 'preserve-3d' }}>
                <Panel n={root} open={open} delay={open ? i * stagger : (chars.length - 1 - i) * 80} paper={i % 4 === 1 ? accent : paper} step={open ? step : 120} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
