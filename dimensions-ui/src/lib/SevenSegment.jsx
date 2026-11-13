import { useEffect, useState } from 'react'

// A seven-segment LED display. Every segment is always there: the unlit ones
// glow faintly (the "ghost" you see on a real display), the lit ones burn
// bright with a halo. Show the live time, a running stopwatch, or your own
// text (digits and the letters a seven-segment can draw).
const SEGS = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
  A: 'abcefg', B: 'fedcg', C: 'afed', D: 'bcdeg', E: 'afged', F: 'afge', G: 'afedc', H: 'fbgec', I: 'bc', J: 'bcde', L: 'fed', N: 'ceg', O: 'abcdef', P: 'abfge', R: 'eg', S: 'afgcd', T: 'fged', U: 'fbedc', Y: 'fbgcd', '-': 'g', '_': 'd', ' ': '',
}

// segment shapes in a 60 x 100 cell: hexagonal bars, slanted a little
const POLY = {
  a: '12,4 48,4 54,10 48,16 12,16 6,10',
  b: '50,14 56,8 62,14 60,46 54,52 48,46',
  c: '48,54 54,48 60,54 58,86 52,92 46,86',
  d: '10,84 46,84 52,90 46,96 10,96 4,90',
  e: '2,54 8,48 14,54 12,86 6,92 0,86',
  f: '4,14 10,8 16,14 14,46 8,52 2,46',
  g: '11,44 47,44 53,50 47,56 11,56 5,50',
}

function Digit({ ch, dot, color, ghost }) {
  const on = SEGS[ch?.toUpperCase?.()] ?? ''
  return (
    <svg viewBox="-6 0 76 100" style={{ height: '1em', width: '0.76em', overflow: 'visible', transform: 'skewX(-6deg)' }}>
      {Object.entries(POLY).map(([s, p]) => (
        <polygon key={s} points={p} fill={on.includes(s) ? color : ghost} style={on.includes(s) ? { filter: `drop-shadow(0 0 3px ${color}) drop-shadow(0 0 9px ${color}aa)` } : undefined} />
      ))}
      <circle cx="66" cy="92" r="5" fill={dot ? color : ghost} />
    </svg>
  )
}

const pad = (n, w = 2) => String(n).padStart(w, '0')

export default function SevenSegment({
  mode = 'clock',
  text = 'HELLO',
  color = '#ff3b2f',
  panel = '#120f10',
  style,
}) {
  const [now, setNow] = useState(() => Date.now())
  const [start] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), mode === 'stopwatch' ? 31 : 250)
    return () => clearInterval(id)
  }, [mode])

  let chars
  let dots = new Set()
  let colon = false
  const d = new Date(now)
  if (mode === 'clock') {
    chars = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    colon = d.getMilliseconds() < 500
  } else if (mode === 'stopwatch') {
    const ms = now - start
    chars = `${pad(Math.floor(ms / 60000) % 100)}${pad(Math.floor(ms / 1000) % 60)}${pad(Math.floor(ms / 10) % 100)}`
    colon = true
  } else {
    // dots attach to the character before them
    const out = []
    for (const c of String(text).toUpperCase()) {
      if (c === '.' && out.length) dots.add(out.length - 1)
      else out.push(c)
    }
    chars = out.join('')
  }

  const ghost = `${color}1f`
  const grouped = mode !== 'text'
  return (
    <div role="timer" aria-label={mode === 'text' ? text : chars} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.08em', padding: '0.28em 0.36em', borderRadius: '0.12em', background: panel, boxShadow: 'inset 0 0.04em 0.12em rgba(0,0,0,.8), 0 0.1em 0.3em rgba(0,0,0,.25)', ...style }}>
      {[...chars].map((c, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Digit ch={c} dot={dots.has(i)} color={color} ghost={ghost} />
          {grouped && (i === 1 || i === 3) && (
            <svg viewBox="0 0 20 100" style={{ height: '1em', width: '0.2em', margin: '0 0.02em' }}>
              {[34, 70].map((y) => (
                <circle key={y} cx="10" cy={y} r="5" fill={colon ? color : ghost} style={colon ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined} />
              ))}
            </svg>
          )}
        </span>
      ))}
    </div>
  )
}
