import { useEffect, useRef, useState } from 'react'

// An airport departures board. Like the real mechanism, each cell holds a
// drum of flaps in a fixed order and can only advance one flap at a time, so
// to get from A to M it clatters through B, C, D... The top half of the old
// character drops away to show the new one behind it, and the new bottom half
// falls into place over the old. Change the text and each cell flips forward
// from where it is now, so cells that are further along the drum take longer.
const DRUM = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/'

const CSS = `
@keyframes rd-sf-top { from { transform: rotateX(0deg) } to { transform: rotateX(-90deg) } }
@keyframes rd-sf-bot { from { transform: rotateX(90deg) } to { transform: rotateX(0deg) } }
.rd-sf-cell { position: relative; display: inline-block; width: 0.74em; height: 1.12em; margin-right: 0.06em; perspective: 3em; font-weight: 700; }
.rd-sf-half { position: absolute; left: 0; right: 0; height: 50%; overflow: hidden; background: var(--rd-sf-bg); color: var(--rd-sf-fg); backface-visibility: hidden; }
.rd-sf-half > span { position: absolute; left: 0; right: 0; height: 1.12em; line-height: 1.12em; text-align: center; }
.rd-sf-top { top: 0; border-radius: 0.09em 0.09em 0 0; transform-origin: 50% 100%; }
.rd-sf-bot { bottom: 0; border-radius: 0 0 0.09em 0.09em; transform-origin: 50% 0%; }
.rd-sf-bot > span { top: -0.56em; }
.rd-sf-top::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 0.03em; background: rgba(0,0,0,.55); }
.rd-sf-top::before { content: ''; position: absolute; inset: 0; background: linear-gradient(rgba(255,255,255,.05), rgba(0,0,0,.12)); pointer-events: none; }
`

let actx
function clack(volume) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (actx.state === 'suspended') actx.resume()
    const t = actx.currentTime
    const len = Math.floor(actx.sampleRate * 0.012)
    const buf = actx.createBuffer(1, len, actx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
    const src = actx.createBufferSource()
    src.buffer = buf
    const bp = actx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2400 + Math.random() * 1200
    bp.Q.value = 1.4
    const g = actx.createGain()
    g.gain.value = volume
    src.connect(bp).connect(g).connect(actx.destination)
    src.start(t)
  } catch {
    // no audio available
  }
}

const norm = (c) => (DRUM.includes(c.toUpperCase()) ? c.toUpperCase() : c)
const nextOnDrum = (c) => {
  const i = DRUM.indexOf(c)
  return i < 0 ? ' ' : DRUM[(i + 1) % DRUM.length]
}

function Cell({ target, flipMs, delay, sound }) {
  const [cur, setCur] = useState(' ')
  const [flip, setFlip] = useState(null) // { from, to, n }
  const n = useRef(0)

  useEffect(() => {
    if (flip) return
    if (cur === target) return
    // a character not on the drum is printed on a flap of its own: jump to it
    const to = DRUM.includes(target) ? nextOnDrum(cur) : target
    const id = setTimeout(
      () => {
        n.current++
        setFlip({ from: cur, to, n: n.current })
        if (sound) clack(0.05)
      },
      n.current === 0 ? delay : 0,
    )
    return () => clearTimeout(id)
  }, [cur, target, flip, delay, sound])

  useEffect(() => {
    if (!flip) return
    const id = setTimeout(() => {
      setCur(flip.to)
      setFlip(null)
    }, flipMs)
    return () => clearTimeout(id)
  }, [flip, flipMs])

  const half = flipMs / 2
  const showTop = flip ? flip.to : cur // static top: what's behind the falling flap
  const showBot = flip ? flip.from : cur // static bottom: covered by the new flap
  return (
    <span className="rd-sf-cell">
      <span className="rd-sf-half rd-sf-top">
        <span>{showTop}</span>
      </span>
      <span className="rd-sf-half rd-sf-bot">
        <span>{showBot}</span>
      </span>
      {flip && (
        <>
          <span key={`t${flip.n}`} className="rd-sf-half rd-sf-top" style={{ animation: `rd-sf-top ${half}ms ease-in forwards`, zIndex: 2 }}>
            <span>{flip.from}</span>
          </span>
          <span
            key={`b${flip.n}`}
            className="rd-sf-half rd-sf-bot"
            style={{ transform: 'rotateX(90deg)', animation: `rd-sf-bot ${half}ms ease-out ${half}ms forwards`, zIndex: 2 }}
          >
            <span>{flip.to}</span>
          </span>
        </>
      )}
    </span>
  )
}

export default function SplitFlapText({
  text = 'DEPARTS 09:45',
  flipMs = 80,
  stagger = 40,
  background = '#1b1b1d',
  color = '#f2efe6',
  sound = false,
  style,
}) {
  const chars = [...String(text)].map(norm)
  return (
    <span
      aria-label={text}
      style={{ display: 'inline-flex', flexWrap: 'wrap', font: '700 1em ui-monospace, Menlo, monospace', '--rd-sf-bg': background, '--rd-sf-fg': color, ...style }}
    >
      <style>{CSS}</style>
      {chars.map((c, i) => (
        <Cell key={i} target={c} flipMs={flipMs} delay={i * stagger} sound={sound} />
      ))}
    </span>
  )
}
