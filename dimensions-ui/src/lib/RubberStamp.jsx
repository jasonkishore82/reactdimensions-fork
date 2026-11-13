import { useEffect, useId, useRef, useState } from 'react'

// A rubber stamp on a sheet of paper. Click anywhere and the stamp comes
// down there, never quite square, thumps onto the sheet and lifts away. The
// impression is uneven like a real one: the rubber picks up ink in a mottle,
// so some patches print solid and some break up, and each stamp is a little
// different. The pad's ink runs out as you go, so every stamp prints fainter
// and more broken than the last, until you click the ink pad to re-ink it.
const STAMP_W = 340
const STAMP_H = 150

let actx
function thump() {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (actx.state === 'suspended') actx.resume()
    const t = actx.currentTime
    const o = actx.createOscillator()
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12)
    const g = actx.createGain()
    g.gain.setValueAtTime(0.35, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
    o.connect(g).connect(actx.destination)
    o.start(t)
    o.stop(t + 0.18)
  } catch {
    // no audio available
  }
}

function Impression({ s, text, sub, ink, id }) {
  // ink load 1 = fresh pad, 0 = dry. A dry stamp prints broken and pale.
  const k = s.ink
  return (
    <svg
      viewBox={`0 0 ${STAMP_W} ${STAMP_H}`}
      width={STAMP_W * s.scale}
      height={STAMP_H * s.scale}
      style={{ position: 'absolute', left: s.x, top: s.y, transform: `translate(-50%, -50%) rotate(${s.rot}deg)`, overflow: 'visible', mixBlendMode: 'multiply', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <filter id={`ink-${id}-${s.n}`} x="-5%" y="-5%" width="110%" height="110%">
          {/* mottle: where the rubber picked up ink and where it did not */}
          <feTurbulence type="fractalNoise" baseFrequency="0.09 0.12" numOctaves="3" seed={s.seed} result="n" />
          <feColorMatrix
            in="n"
            type="matrix"
            values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${7 + (1 - k) * 6} ${-2.2 - (1 - k) * 4.2}`}
            result="mask"
          />
          {/* fine grain where the paper fibres skipped */}
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed={s.seed + 7} result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3 2.3" result="grain" />
          <feComposite in="mask" in2="grain" operator="arithmetic" k1="1" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" result="inked" />
          {/* a whisker of ink squeezed out round the edges */}
          <feMorphology in="inked" operator="dilate" radius="0.4" />
        </filter>
      </defs>
      <g filter={`url(#ink-${id}-${s.n})`} opacity={0.45 + 0.5 * k} fill={ink} stroke={ink}>
        <rect x="8" y="8" width={STAMP_W - 16} height={STAMP_H - 16} rx="12" fill="none" strokeWidth="7" />
        <rect x="20" y="20" width={STAMP_W - 40} height={STAMP_H - 40} rx="6" fill="none" strokeWidth="2.5" />
        <text x={STAMP_W / 2} y={sub ? 84 : 94} textAnchor="middle" stroke="none" fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif" fontWeight="900" fontSize="48" letterSpacing="3" textLength={Math.min(STAMP_W - 70, String(text).length * 40)} lengthAdjust="spacingAndGlyphs">
          {text}
        </text>
        {sub && (
          <text x={STAMP_W / 2} y="114" textAnchor="middle" stroke="none" fontFamily="ui-monospace, Menlo, Consolas, monospace" fontWeight="700" fontSize="18" letterSpacing="4">
            {sub}
          </text>
        )}
      </g>
    </svg>
  )
}

export default function RubberStamp({
  text = 'APPROVED',
  ink = '#c8322b',
  paper = '#f3eee3',
  stamps = 6,
  tilt = 7,
  date = true,
  sound = false,
  style,
}) {
  const id = useId().replace(/:/g, '')
  const box = useRef()
  const head = useRef()
  const busy = useRef(false)
  const load = useRef(1)
  const n = useRef(0)
  const [marks, setMarks] = useState([])
  const [pad, setPad] = useState(1)

  const sub = date ? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : ''

  const stampAt = (x, y) => {
    if (busy.current || !head.current) return
    busy.current = true
    const r = box.current.getBoundingClientRect()
    const scale = Math.min(1, (r.width * 0.62) / STAMP_W)
    const rot = (Math.random() * 2 - 1) * tilt
    const h = head.current
    h.style.left = `${x}px`
    h.style.top = `${y}px`
    h.style.width = `${STAMP_W * scale}px`
    h.style.height = `${STAMP_H * scale}px`
    // swoop in from above, thump, hold a moment, lift away
    const a = h.animate(
      [
        { transform: `translate(-50%, -50%) translate(40px, -160px) rotate(${rot + 10}deg) scale(1.35)`, opacity: 0, boxShadow: '30px 60px 40px rgba(0,0,0,.18)' },
        { transform: `translate(-50%, -50%) translate(10px, -30px) rotate(${rot + 2}deg) scale(1.12)`, opacity: 1, boxShadow: '14px 24px 18px rgba(0,0,0,.22)', offset: 0.45 },
        { transform: `translate(-50%, -50%) rotate(${rot}deg) scale(0.985)`, opacity: 1, boxShadow: '1px 2px 2px rgba(0,0,0,.35)', offset: 0.6 },
        { transform: `translate(-50%, -50%) rotate(${rot}deg) scale(1)`, opacity: 1, boxShadow: '1px 2px 3px rgba(0,0,0,.3)', offset: 0.72 },
        { transform: `translate(-50%, -50%) translate(-20px, -140px) rotate(${rot - 6}deg) scale(1.3)`, opacity: 0, boxShadow: '30px 60px 40px rgba(0,0,0,.12)' },
      ],
      { duration: 900, easing: 'cubic-bezier(.3,.1,.3,1)' },
    )
    setTimeout(() => {
      if (sound) thump()
      // the sheet jolts a fraction under the blow
      box.current?.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(1.5px)' }, { transform: 'translateY(0)' }], { duration: 120 })
      const k = load.current
      n.current++
      setMarks((m) => [...m.slice(-24), { n: n.current, x, y, rot, scale, ink: k, seed: Math.floor(Math.random() * 999) }])
      load.current = Math.max(0, k - 1 / Math.max(1, stamps))
      setPad(load.current)
    }, 540)
    a.onfinish = () => (busy.current = false)
  }

  const reink = (e) => {
    e.stopPropagation()
    load.current = 1
    setPad(1)
    e.currentTarget.animate([{ transform: 'scale(1)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 220 })
  }

  useEffect(() => {
    setMarks([])
    load.current = 1
    setPad(1)
    const t = setTimeout(() => {
      const r = box.current?.getBoundingClientRect()
      if (r) stampAt(r.width / 2, r.height / 2)
    }, 350)
    return () => clearTimeout(t)
  }, [text, ink, stamps, date])

  const click = (e) => {
    const r = box.current.getBoundingClientRect()
    stampAt(e.clientX - r.left, e.clientY - r.top)
  }

  return (
    <div
      ref={box}
      onClick={click}
      role="img"
      aria-label={`${text} stamp`}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: paper, cursor: 'crosshair', userSelect: 'none', ...style }}
    >
      {/* paper tooth */}
      <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.45, mixBlendMode: 'multiply', pointerEvents: 'none' }}>
        <filter id={`tooth-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="3" />
          <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0 0.42  0 0 0 -0.9 0.6" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#tooth-${id})`} />
      </svg>
      {marks.map((s) => (
        <Impression key={s.n} s={s} text={text} sub={sub} ink={ink} id={id} />
      ))}
      {/* the stamp itself: the rubber face seen from above, on its wooden mount */}
      <div
        ref={head}
        aria-hidden="true"
        style={{ position: 'absolute', opacity: 0, borderRadius: 10, pointerEvents: 'none', background: 'linear-gradient(135deg, #b98552, #8a5a30 60%, #6e4524)', boxSizing: 'border-box', border: '3px solid #5a381c' }}
      >
        <div style={{ position: 'absolute', inset: '22% 30%', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #4a4a4e, #18181a 70%)', boxShadow: '0 6px 10px rgba(0,0,0,.35)' }} />
      </div>
      {/* the ink pad: click to re-ink */}
      <button
        type="button"
        onClick={reink}
        aria-label="Re-ink the stamp"
        style={{ position: 'absolute', right: 16, bottom: 30, width: 92, height: 60, borderRadius: 8, border: 'none', padding: 6, cursor: 'pointer', background: 'linear-gradient(#3b3b40, #222226)', boxShadow: '0 4px 10px rgba(0,0,0,.25)' }}
      >
        <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 4, background: `color-mix(in srgb, ${ink} ${Math.round(25 + pad * 75)}%, #8a8174)`, boxShadow: 'inset 0 2px 4px rgba(0,0,0,.35)' }} />
        <span style={{ position: 'absolute', left: 0, right: 0, bottom: -18, font: '600 10px/1 ui-monospace, Menlo, monospace', color: '#7a7368', letterSpacing: '0.08em' }}>RE-INK</span>
      </button>
    </div>
  )
}
