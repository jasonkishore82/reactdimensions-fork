import { useEffect, useRef, useState } from 'react'
import { useOnScreen } from '../ui/onscreen.js'

// Maximalist streetwear drop: patterned background, a layered product shot,
// a countdown in huge numerals, then the drop goes live. Pick a size from a
// loud grid and hit the giant "COP NOW" button (it shakes on hover); stock
// counts down as people buy. Prices and sizes stay on solid panels.

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const COLOURWAYS = [['Acid', '#c6ff00', '#111'], ['Bubblegum', '#ff7ac8', '#111'], ['Ultra', '#3b2bff', '#fff'], ['Flame', '#ff4d1a', '#111']]
const NAV = [['Drop', '★'], ['Shop', '◆'], ['Lookbook', '●'], ['Bag', '■']]

function Hoodie({ colour, ink }) {
  return (
    <svg viewBox="0 0 220 220" aria-hidden="true">
      <path d="M70 40 Q110 18 150 40 L190 70 L176 112 L160 104 L160 196 L60 196 L60 104 L44 112 L30 70 Z" fill={colour} stroke="#111" strokeWidth="5" strokeLinejoin="round" />
      <path d="M86 40 Q110 76 134 40" fill="none" stroke="#111" strokeWidth="5" />
      <path d="M94 56 L94 92 M126 56 L126 92" stroke="#111" strokeWidth="3" />
      <rect x="80" y="140" width="60" height="34" rx="6" fill="none" stroke="#111" strokeWidth="4" />
      <text x="110" y="128" textAnchor="middle" fontSize="20" fontWeight="900" fontFamily="'Arial Black', system-ui" fill={ink}>NO SLEEP</text>
    </svg>
  )
}

export default function MaxDrop({ product = 'NO SLEEP HOODIE', price = 140, startsIn = 12, style }) {
  const root = useRef(null)
  const visible = useOnScreen(root)
  const [left, setLeft] = useState(startsIn)
  const [size, setSize] = useState(null)
  const [colour, setColour] = useState(0)
  const [stock, setStock] = useState({ XS: 3, S: 9, M: 14, L: 11, XL: 5, XXL: 0 })
  const [bag, setBag] = useState(0)
  const [msg, setMsg] = useState('')
  const [nav, setNav] = useState(0)

  useEffect(() => setLeft(startsIn), [startsIn])
  useEffect(() => {
    if (!visible || left <= 0) return
    const id = setTimeout(() => setLeft((v) => v - 1), 1000)
    return () => clearTimeout(id)
  }, [left, visible])

  const live = left <= 0
  const cop = () => {
    if (!live) return setMsg('Not yet. Hold tight.')
    if (!size) return setMsg('Pick a size first.')
    if (!stock[size]) return setMsg(`${size} is sold out.`)
    setStock({ ...stock, [size]: stock[size] - 1 })
    setBag(bag + 1)
    setMsg(`Copped! ${COLOURWAYS[colour][0]} / ${size} is in your bag.`)
  }
  const [cw, cfill, cink] = COLOURWAYS[colour]
  const hh = String(Math.floor(left / 3600)).padStart(2, '0'), mm = String(Math.floor((left % 3600) / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0')

  return (
    <div ref={root} className="md-wrap" data-paused={visible ? undefined : ''} style={{ '--c': cfill, '--ci': cink, ...style }}>
      <style>{`
        .md-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: auto; color: #111; font: 700 13px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif; background: conic-gradient(from 90deg at 2px 2px, #111 90deg, #fff 0) 0 0 / 28px 28px; }
        :where(.md-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .md-wrap[data-paused] * { animation-play-state: paused !important; }
        .md-top { position: sticky; top: 0; z-index: 4; display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #111; color: #fff; }
        .md-logo { font: 900 20px/1 'Arial Black', system-ui, sans-serif; letter-spacing: -0.04em; }
        .md-logo span { color: var(--c); }
        .md-nav { display: flex; gap: 4px; }
        .md-nav button { padding: 6px 10px; border-radius: 999px; color: #fff; display: flex; gap: 6px; align-items: center; }
        .md-nav button i { font-style: normal; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; font-size: 10px; color: #111; }
        .md-nav button[aria-current='page'] { background: #fff; color: #111; }
        .md { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px; }
        .md-stage { position: relative; min-height: 320px; background: var(--c); border: 4px solid #111; box-shadow: 10px 10px 0 #111; overflow: hidden; display: grid; place-items: center; transition: background 250ms; }
        .md-stage::before { content: 'DROP 07 DROP 07 DROP 07 DROP 07 DROP 07'; position: absolute; inset: -20% -10%; font: 900 64px/0.9 'Arial Black', system-ui, sans-serif; color: rgba(0,0,0,.08); word-break: break-all; transform: rotate(-12deg); }
        .md-stage svg { position: relative; width: 74%; max-width: 260px; filter: drop-shadow(8px 8px 0 #111); }
        .md-tag { position: absolute; padding: 6px 10px; border: 3px solid #111; background: #fff; font: 900 12px/1 'Courier New', monospace; text-transform: uppercase; }
        .md-panel { display: flex; flex-direction: column; gap: 12px; }
        .md-box { background: #fff; border: 4px solid #111; box-shadow: 6px 6px 0 #111; padding: 12px 14px; }
        .md-box h1 { margin: 0; font: 900 26px/0.95 'Arial Black', system-ui, sans-serif; letter-spacing: -0.03em; }
        .md-price { display: flex; align-items: baseline; gap: 10px; margin-top: 6px; }
        .md-price b { font: 900 24px/1 'Courier New', monospace; }
        .md-price s { color: #555; font-family: Georgia, serif; font-style: italic; }
        .md-clock { display: flex; gap: 6px; align-items: center; }
        .md-clock b { font: 900 34px/1 'Courier New', monospace; background: var(--c); color: var(--ci); border: 3px solid #111; padding: 4px 8px; font-variant-numeric: tabular-nums; }
        .md-live { font: 900 28px/1 'Arial Black', system-ui, sans-serif; color: var(--ci); background: var(--c); padding: 4px 10px; border: 3px solid #111; animation: md-flash 1s steps(2) infinite; }
        @keyframes md-flash { 50% { background: #111; color: #fff; } }
        .md-sizes { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
        .md-size { padding: 9px 0; border: 3px solid #111; background: #fff; font: 900 13px/1 'Arial Black', system-ui, sans-serif; position: relative; }
        .md-size[aria-checked='true'] { background: var(--c); color: var(--ci); box-shadow: inset 0 0 0 3px #111; }
        .md-size:disabled { cursor: not-allowed; background: repeating-linear-gradient(45deg, #fff 0 5px, #ddd 5px 10px); color: #555; text-decoration: line-through; }
        .md-size small { position: absolute; right: 2px; top: 1px; font: 700 8px/1 'Courier New', monospace; }
        .md-cw { display: flex; gap: 8px; flex-wrap: wrap; }
        .md-cw button { padding: 6px 10px; border: 3px solid #111; font-weight: 900; }
        .md-cw button[aria-checked='true'] { box-shadow: 3px 3px 0 #111; transform: translate(-2px, -2px); }
        .md-cop { padding: 18px; font: 900 30px/1 'Arial Black', system-ui, sans-serif; letter-spacing: -0.02em; background: var(--c); color: var(--ci); border: 4px solid #111; box-shadow: 8px 8px 0 #111; transition: transform 100ms, background 250ms; }
        .md-wrap .md-cop { color: var(--ci); }
        .md-cop:hover:not([aria-disabled='true']), .md-cop:focus-visible { animation: md-shake 280ms ease-in-out infinite; }
        .md-cop[aria-disabled='true'] { background: #555; color: #fff; box-shadow: 8px 8px 0 #111; }
        .md-wrap .md-cop[aria-disabled='true'] { color: #fff; }
        @keyframes md-shake { 25% { transform: rotate(-1.5deg); } 75% { transform: rotate(1.5deg); } }
        .md-msg { min-height: 18px; font: 700 13px/1.3 'Courier New', monospace; }
        @container (max-width: 640px) { .md { grid-template-columns: 1fr; } .md-nav span { display: none; } }
        @media (prefers-reduced-motion: reduce) { .md-wrap * { animation: none !important; } }
      `}</style>

      <header className="md-top">
        <span className="md-logo">KNOT<span>/</span>WORK</span>
        <nav className="md-nav" aria-label="Shop">
          {NAV.map(([l, ic], n) => (
            <button key={l} aria-current={n === nav ? 'page' : undefined} onClick={() => setNav(n)}>
              <i style={{ background: COLOURWAYS[n][1] }} aria-hidden="true">{ic}</i><span>{l}{l === 'Bag' && bag ? ` · ${bag}` : ''}</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="md">
        <section className="md-stage" aria-label={`${product} in ${cw}`}>
          <Hoodie colour={cfill} ink={cink} />
          <span className="md-tag" style={{ left: 12, top: 12, transform: 'rotate(-6deg)' }}>Limited · 42 made</span>
          <span className="md-tag" style={{ right: 12, bottom: 14, transform: 'rotate(4deg)', background: '#111', color: '#fff' }}>Heavyweight 480 gsm</span>
        </section>

        <section className="md-panel">
          <div className="md-box">
            <h1>{product}</h1>
            <div className="md-price"><b>${price}</b><s>Retail drop, no restocks</s></div>
          </div>
          <div className="md-box" role="timer" aria-live="off">
            {live ? <span className="md-live">LIVE NOW</span> : (
              <div className="md-clock" aria-label={`Drop starts in ${left} seconds`}><b>{hh}</b>:<b>{mm}</b>:<b>{ss}</b></div>
            )}
          </div>
          <div className="md-box">
            <div className="md-cw" role="radiogroup" aria-label="Colourway">
              {COLOURWAYS.map(([n, f, ink], i) => <button key={n} role="radio" aria-checked={i === colour} style={{ background: f, color: ink }} onClick={() => setColour(i)}>{n}</button>)}
            </div>
          </div>
          <div className="md-box">
            <div className="md-sizes" role="radiogroup" aria-label="Size">
              {SIZES.map((s) => (
                <button key={s} className="md-size" role="radio" aria-checked={s === size} disabled={!stock[s]} aria-label={`${s}${stock[s] ? `, ${stock[s]} left` : ', sold out'}`} onClick={() => setSize(s)}>
                  {s}<small aria-hidden="true">{stock[s] || ''}</small>
                </button>
              ))}
            </div>
          </div>
          <button className="md-cop" aria-disabled={!live} onClick={cop}>{live ? 'COP NOW' : 'DROPPING SOON'}</button>
          <p className="md-msg" role="status">{msg}</p>
        </section>
      </div>
    </div>
  )
}
