import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Text that writes itself one stroke at a time, as if by hand. Every glyph is a
// single-line pen path (not a font outline), drawn in writing order at a steady
// pen speed, with a short lift between strokes. Lowercase letters join: each
// starts with a lead-in from wherever the last letter left the pen (baseline,
// or high after o / b / v / w). Capitals, digits and punctuation stand alone.
// `frameRate` steps the drawing for a frame-by-frame feel; `slant` sets the
// lean. Respects prefers-reduced-motion.
//
// Units: baseline y 0, x-height -10, ascenders -19, capitals -17, digits -15,
// descenders +9.

const f = (n) => +n.toFixed(2)

// A full ellipse drawn anticlockwise, starting and ending at angle `deg`
// (0 = right, 90 = top), from the current pen position, which must be on it.
function oval(cx, cy, rx, ry, deg) {
  const at = (d) => {
    const r = (d * Math.PI) / 180
    return `${f(cx + rx * Math.cos(r))} ${f(cy - ry * Math.sin(r))}`
  }
  return `A${rx} ${ry} 0 0 0 ${at(deg + 180)}A${rx} ${ry} 0 0 0 ${at(deg)}`
}
const BOWL = oval(4.6, -5, 3.6, 5, 50) // the a / d / g / q bowl, from its top right
const BOWL_START = [6.91, -8.83]
const LOOP = 'C5.5 -19.5 2.5 -20 2.3 -16' // the ascender loop of b / f / h / k / l

// lowercase: [width, body start, body, exits high?]
const LOWER = {
  a: [10.5, BOWL_START, `${BOWL}L8.2 -10L8.2 -1.5Q8.2 0 9.7 0L10.5 0`],
  b: [10, [5.3, -17], `${LOOP}L2.3 -2C2.3 0 8 .5 8 -5C8 -9.5 4 -10 2.5 -8C4.5 -8.6 7.5 -9.2 10 -9`, true],
  c: [10, [7.6, -8.6], 'C7.3 -9.6 6 -10.2 4.6 -10A3.6 5 0 0 0 1 -5A3.6 5 0 0 0 4.6 0C6.5 0 8.5 -.4 10 0'],
  d: [10.5, BOWL_START, `${BOWL}L8.2 -19L8.2 -1.5Q8.2 0 9.7 0L10.5 0`],
  e: [10, [2, -4.5], 'C5 -5 8 -6 7.5 -8.5C7 -10.5 3 -10.5 1.8 -7C.8 -4 1.5 0 5 0C7 0 8.5 -.5 10 0'],
  f: [9, [5.3, -17], `${LOOP}L2.3 6C2.3 9.5 -.5 9 .3 6C1 3 5 .8 9 0`],
  g: [10.5, BOWL_START, `${BOWL}L8.2 -10L8.2 5.5C8.2 10 1.5 10 2.3 6.5C3 4 7 1.2 10.5 0`],
  h: [10.5, [5.3, -17], `${LOOP}L2.3 0L2.3 -5.5C3.3 -9 7.8 -11 7.8 -6L7.8 -1.5Q7.8 0 9.3 0L10.5 0`],
  i: [6.5, [3, -10], 'L3 -1.5Q3 0 4.5 0L6.5 0M3 -14L3 -13.9'],
  j: [7, [3, -10], 'L3 5.5C3 10 -1.5 10 -.8 6.5C-.2 3.5 3.5 1.2 7 0M3 -14L3 -13.9'],
  k: [10, [5.3, -17], `${LOOP}L2.3 0L2.3 -4C4 -8 8.5 -10.5 8.3 -7.3C8.1 -5 5 -4.5 3.2 -4.5C5.5 -4 7 0 9 0L10 0`],
  l: [6, [5.3, -17], `${LOOP}L2.3 -1.5Q2.3 0 3.8 0L6 0`],
  m: [14, [2, -10], 'L2 0L2 -5.5C2.8 -9 6.6 -11 6.6 -6L6.6 0L6.6 -5.5C7.4 -9 11.2 -11 11.2 -6L11.2 -1.5Q11.2 0 12.7 0L14 0'],
  n: [10.5, [2, -10], 'L2 0L2 -5.5C3 -9 7.6 -11 7.6 -6L7.6 -1.5Q7.6 0 9.1 0L10.5 0'],
  o: [10, [4.6, -10], 'A3.6 5 0 0 0 4.6 0A3.6 5 0 0 0 4.6 -10C6.5 -10 8.5 -9 10 -9', true],
  p: [10.5, [2, -10], 'L2 8.5L2 -5C3 -9.5 8.6 -11 8.6 -5C8.6 -.5 4 .5 2.2 -1.5C4.5 -.5 7.5 0 10.5 0'],
  q: [10.5, BOWL_START, `${BOWL}L8.2 -10L8.2 8.5C8.2 5 9.3 1.5 10.5 0`],
  r: [9, [2, -10], 'C3 -8.5 4.5 -8.5 6 -9.8C5.5 -6 6.5 -1.5 7.5 -.5Q8.2 0 9 0'],
  s: [9, [4, -10], 'C5.5 -7 8 -4 7 -1.5C6 .5 3 .3 1.8 -1C4 -.3 6.5 .3 9 0'],
  t: [7, [3.2, -16], 'L3.2 -1.5Q3.2 0 4.7 0L7 0M.8 -10L6.5 -10'],
  u: [10.5, [2, -10], 'L2 -4C2 0 7.8 .5 7.8 -5L7.8 -10L7.8 -1.5Q7.8 0 9.3 0L10.5 0'],
  v: [10.5, [2, -10], 'C2.8 -6 4 -1.5 5 0C6 -2 7.5 -7 8.4 -10C8.8 -9.3 9.5 -9 10.5 -9', true],
  w: [12.5, [2, -10], 'L2 -4C2 0 6 .2 6.2 -3.5L6.2 -7L6.2 -3.5C6.4 .2 10.4 0 10.4 -4L10.4 -10C10.8 -9.3 11.5 -9 12.5 -9', true],
  x: [10, [2, -10], 'C3.5 -10 4.5 -9 5.5 -6C6.5 -2 7.5 0 10 0M2.5 0L8.5 -10'],
  y: [10.5, [2, -10], 'L2 -4C2 0 7.8 .5 7.8 -5L7.8 -10L7.8 5.5C7.8 10 1.5 10 2.3 6.5C3 4 7 1.2 10.5 0'],
  z: [9, [2, -10], 'L8 -10L2 0L9 0'],
}

// capitals, digits and punctuation: [width, path]
const SOLO = {
  A: [12, 'M0 0C2 -5 4 -12 5.5 -17C7 -12 9 -5 11 0M2.6 -7C5 -7.5 6.5 -7.5 8.6 -7'],
  B: [12, 'M2 0L2 -17C7 -17.5 9.5 -15.5 9.5 -13C9.5 -10.3 6.5 -9 2 -9C7 -9 10.5 -7.5 10.5 -4.5C10.5 -1.2 6.5 .2 2 0'],
  C: [12, 'M11 -14.5C10 -16.5 8 -17.2 6.5 -17C3 -16.6 1 -12.5 1 -8.5C1 -3.5 3.5 0 7 0C9 0 10.5 -1 11.5 -2.5'],
  D: [13, 'M2 0L2 -17C8 -17.5 11.5 -13.5 11.5 -8.5C11.5 -3.5 8 .3 2 0'],
  E: [12, 'M10.5 -15.5C9.5 -17 7 -17.5 5 -16.8C2.5 -16 2.5 -12 4.5 -10.5C6 -9.4 7.5 -9.2 8 -9.2C3 -9.5 .5 -7 1 -4C1.5 -.5 6 .8 9 -.5C10 -1 10.8 -1.8 11.3 -2.5'],
  F: [12, 'M2.5 -16.5C5 -17.3 8.5 -17.3 11 -16.5M6.5 -17C6.5 -11 6.3 -5 5.5 -2C5 -.5 3 .3 1.5 -1M3.5 -9L9 -9'],
  G: [13, 'M11 -14.5C10 -16.5 8 -17.2 6.5 -17C3 -16.6 1 -12.5 1 -8.5C1 -3.5 3.5 0 7 0C9.5 0 11 -2 11 -5L11 -8M8 -8L12.5 -8'],
  H: [12, 'M2 -17L2 0M10 -17L10 0M2 -8.5L10 -8.5'],
  I: [9, 'M1.5 -17L7.5 -17M4.5 -17L4.5 0M1.5 0L7.5 0'],
  J: [11, 'M3 -17L10 -17M7.5 -17L7.5 -4C7.5 0 4.5 .5 2.5 -.5C1.5 -1 1 -2 .8 -3'],
  K: [12, 'M2 -17L2 0M10.5 -17L2.3 -7.5M4.8 -10L11 0'],
  L: [11, 'M2.5 -17L2.5 -1.5Q2.5 0 4 0L10.5 0'],
  M: [15, 'M1 0L2.5 -17L7.5 -6L12.5 -17L14 0'],
  N: [13, 'M2 0L2 -17L11 0L11 -17'],
  O: [13, `M6.5 -17${oval(6.5, -8.5, 5.5, 8.5, 90)}`],
  P: [12, 'M2 0L2 -17C7.5 -17.5 10.5 -15.5 10.5 -12.5C10.5 -9.5 7.5 -8 2 -8'],
  Q: [13, `M6.5 -17${oval(6.5, -8.5, 5.5, 8.5, 90)}M8 -3L12 1`],
  R: [13, 'M2 0L2 -17C7.5 -17.5 10.5 -15.5 10.5 -12.5C10.5 -9.5 7.5 -8 2 -8C5 -8 8 -6 9 -3C9.5 -1 10.5 0 12 0'],
  S: [12, 'M10.5 -15C9.5 -16.8 7.5 -17.3 5.8 -17C3.5 -16.6 2.3 -15 2.5 -13C2.8 -10.5 9.5 -9.5 9.8 -5C10 -1.5 7 .2 4.5 0C2.8 -.1 1.5 -1 1 -2.5'],
  T: [13, 'M1 -15.5C3 -17.2 9 -17.5 12.5 -16.5M7 -17C7 -11 6.8 -5 6 -2.5C5.5 -.7 3.5 .2 2 -1'],
  U: [13, 'M1.5 -17L1.5 -6C1.5 -1.5 4 0 6.25 0C8.5 0 11 -1.5 11 -6L11 -17L11 -1.5Q11 0 12.5 0'],
  V: [13, 'M1 -17L6.5 0L12 -17'],
  W: [17, 'M1 -17L4.5 0L8.5 -12L12.5 0L16 -17'],
  X: [12, 'M1 -17L11 0M11 -17L1 0'],
  Y: [12, 'M1 -17L6 -8.5M11 -17L6 -8.5L6 0'],
  Z: [13, 'M1.5 -17L11 -17L1.5 0L11.5 0'],
  0: [10, `M5 -15${oval(5, -7.5, 4, 7.5, 90)}`],
  1: [8, 'M2 -12L5.5 -15L5.5 0'],
  2: [11, 'M1.5 -11.5C1.5 -14 3.5 -15.2 5.5 -15C8 -14.8 9.5 -13 9 -10.5C8.5 -8 4 -4 1.5 0L10 0'],
  3: [11, 'M1.8 -13C3 -15 6 -15.6 8 -14.2C10 -12.6 9 -8.8 5 -8.5C9.5 -8.4 10.5 -4.8 9 -2.3C7.3 .4 3 .6 1.2 -2'],
  4: [11, 'M7.5 0L7.5 -15L1 -4.5L10.5 -4.5'],
  5: [11, 'M9 -15L3 -15L2.3 -8.5C4.5 -9.8 8 -9.8 9.3 -7C10.5 -4 8.7 -.3 5.5 0C3.5 .2 1.8 -.8 1.2 -2'],
  6: [11, 'M8.8 -14C7.8 -15.3 5.8 -15.5 4.3 -14.6C1.5 -12.8 1 -8 1.3 -5C1.6 -1.6 3.3 0 5.4 0C7.9 0 9.4 -2 9.4 -4.6C9.4 -7.3 7.5 -9 5.3 -9C3.4 -9 1.8 -7.8 1.3 -5.8'],
  7: [11, 'M1 -15L10 -15C7.5 -11 5.5 -6 4.5 0'],
  8: [11, 'M5.3 -8.3C2 -9.2 1.8 -11.5 2.2 -12.8C2.8 -14.6 4 -15.2 5.3 -15.2C6.8 -15.2 8.3 -14.4 8.5 -12.6C8.7 -10.5 6.8 -9.2 5.3 -8.3C3 -7.3 1.2 -5.8 1.4 -3.6C1.6 -1 3.5 0 5.3 0C7.2 0 9.2 -1 9.2 -3.8C9.2 -6 7.5 -7.5 5.3 -8.3'],
  9: [11, 'M9 -10.5C8.3 -8.2 6.8 -6.7 5 -6.7C2.7 -6.7 1.2 -8.6 1.2 -10.8C1.2 -13.4 3 -15 5.1 -15C7.6 -15 9.1 -13 9.1 -10C9.1 -5 8 -1.5 6 -.4C4.2 .6 2.4 0 1.6 -1.2'],
  '.': [4, 'M1.5 -.1L1.5 0'],
  ',': [4, 'M2 -.5L1 2.5'],
  '!': [5, 'M2.5 -17L2.5 -5M2.5 -.1L2.5 0'],
  '?': [9, 'M1.5 -13C1.5 -17.5 7.5 -17.5 7.5 -13C7.5 -9.5 4 -9 4 -5M4 -.1L4 0'],
  "'": [3, 'M1.5 -18L1 -14.5'],
  '-': [7, 'M1 -5L6 -5'],
  ':': [4, 'M1.5 -8.1L1.5 -8M1.5 -.1L1.5 0'],
  '&': [12, 'M10.5 0C7 -3 2.5 -8 3 -13C3.3 -15.5 5 -16.5 6.5 -16C8 -15.5 8 -13 6 -11C3.5 -8.5 1 -6 1.5 -3C2 0 6 .5 8.5 -2C9.5 -3 10 -4.5 10.5 -6'],
}
const SPACE = 6
const GAP = 1.5 // space after a capital, digit or mark before the next glyph
const TRACK = 0.8 // extra room between joined lowercase letters; the lead-in spans it

// the stroke from where the pen is to where a letter's body starts
function leadIn(high, [sx, sy]) {
  return high
    ? `M${-TRACK} -9C${f(sx * 0.5)} -9.2 ${sx} ${f((sy - 9) / 2)} ${sx} ${sy}`
    : `M${-TRACK} 0C${f(sx * 0.45)} -.4 ${sx} ${f(sy * 0.45)} ${sx} ${sy}`
}

// Lay the text out as a list of single strokes (pen down to pen up), in order.
function layout(text) {
  let x = 0
  let high = false
  let afterSolo = false
  const strokes = []
  for (const ch of text) {
    if (ch === ' ' || ch === '\n') {
      strokes.push({ word: true })
      x += SPACE
      high = false
      afterSolo = false
      continue
    }
    const low = LOWER[ch]
    const solo = SOLO[ch] ?? (low ? null : SOLO[ch.toUpperCase()])
    if (low) {
      x += afterSolo ? GAP + TRACK : TRACK
      const [w, start, body, exitsHigh] = low
      const d = leadIn(high, start) + body
      d.split(/(?=M)/).forEach((s) => strokes.push({ x, d: s }))
      x += w
      high = !!exitsHigh
      afterSolo = false
    } else if (solo) {
      if (x > 0) x += GAP
      solo[1].split(/(?=M)/).forEach((s) => strokes.push({ x, d: s }))
      x += solo[0]
      high = false
      afterSolo = true
    } else {
      x += SPACE
      high = false
    }
  }
  return { strokes, width: Math.max(x, 1) }
}

const LIFT = 0.06 // seconds the pen spends in the air between strokes

export default function HandwritingText({
  text = 'Hello there',
  speed = 70,
  frameRate = 30,
  wordPause = 0.25,
  slant = 10,
  color = '#1d2b4f',
  strokeWidth = 1.3,
  loop = false,
  trigger = 'mount',
  style,
}) {
  const { strokes, width } = layout(text)
  const paths = useRef([])
  const lengths = useRef([])
  const raf = useRef(0)
  const timer = useRef(0)
  const [ready, setReady] = useState(0)

  // measure every stroke so the pen moves at the same speed through all of them
  useLayoutEffect(() => {
    lengths.current = strokes.map((s, i) => (s.word ? 0 : paths.current[i]?.getTotalLength() ?? 0))
    setReady((n) => n + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const durationOf = (i) => (strokes[i].word ? wordPause : lengths.current[i] / speed + LIFT)

  const show = (t) => {
    let left = t
    strokes.forEach((s, i) => {
      const dur = durationOf(i)
      if (s.word) { left -= dur; return }
      const len = lengths.current[i]
      const p = Math.max(0, Math.min(1, left / (dur - LIFT)))
      left -= dur
      const el = paths.current[i]
      if (!el) return
      el.style.strokeDasharray = `${len + 1} ${len + 1}`
      el.style.strokeDashoffset = `${len * (1 - p)}`
      el.style.visibility = p > 0 ? 'visible' : 'hidden'
    })
  }

  const play = () => {
    cancelAnimationFrame(raf.current)
    clearTimeout(timer.current)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { show(Infinity); return }
    const end = strokes.reduce((a, _, i) => a + durationOf(i), 0)
    const step = frameRate > 0 ? 1 / frameRate : 0
    const start = performance.now()
    let last = -1
    const tick = (now) => {
      let t = (now - start) / 1000
      if (step) t = Math.floor(t / step) * step
      if (t !== last) { show(t); last = t }
      if (t < end) raf.current = requestAnimationFrame(tick)
      else if (loop) timer.current = setTimeout(play, 1200)
    }
    show(0)
    raf.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (!ready) return
    if (trigger === 'mount') play()
    else show(Infinity)
    return () => { cancelAnimationFrame(raf.current); clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, speed, frameRate, wordPause, loop, trigger])

  const skew = Math.tan((slant * Math.PI) / 180)
  const pad = strokeWidth + 2
  const lean = 21 * skew // how far the tallest strokes lean right
  return (
    <span
      role="img"
      aria-label={text}
      onPointerEnter={trigger === 'hover' ? play : undefined}
      style={{ display: 'inline-block', width: `min(100%, ${Math.round((width + lean) * 6.5)}px)`, lineHeight: 0, ...style }}
    >
      <svg viewBox={`${f(-pad - 10 * skew)} ${-22 - pad} ${f(width + lean + 10 * skew + pad * 2)} ${33 + pad * 2}`} width="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
        <g fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" transform={`matrix(1 0 ${f(-skew)} 1 0 0)`}>
          {strokes.map((s, i) =>
            s.word ? null : (
              <path key={i} ref={(el) => (paths.current[i] = el)} d={s.d} transform={`translate(${s.x} 0)`} style={{ visibility: 'hidden' }} />
            ),
          )}
        </g>
      </svg>
    </span>
  )
}
