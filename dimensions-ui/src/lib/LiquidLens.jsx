import { useRef, useState } from 'react'
import { useLens, specular } from '../liquid/lens.js'

// Liquid glass product viewer: a watch drawn in fine detail sits under a
// round glass lens you can drag to inspect it. Glass beads pick the dial
// colour, a glass pill switches Front / Side / Back, and the specs sit on a
// thick glass panel with the product showing softly behind.

const COLOURS = [
  ['Midnight', '#14213d', '#d9b45b'],
  ['Forest', '#1f4d3a', '#e9dcb5'],
  ['Salmon', '#e58e72', '#2b2b2b'],
  ['Ice', '#cfe3ef', '#1d3557'],
]
const VIEWS = ['Front', 'Side', 'Back']

function Watch({ view, dial, ink }) {
  const steel = '#c9cdd3'
  if (view === 'Side') {
    return (
      <svg viewBox="0 0 400 400" aria-hidden="true">
        <rect x="150" y="10" width="100" height="120" rx="14" fill="#3b3b3f" />
        <rect x="150" y="270" width="100" height="120" rx="14" fill="#3b3b3f" />
        {[30, 50, 70, 90, 110, 290, 310, 330, 350, 370].map((y) => <rect key={y} x="158" y={y} width="84" height="2" fill="#56565c" />)}
        <rect x="120" y="120" width="160" height="160" rx="26" fill={steel} />
        <rect x="128" y="128" width="144" height="18" rx="6" fill="#e6e9ee" />
        <rect x="128" y="254" width="144" height="18" rx="6" fill="#a8adb5" />
        <rect x="280" y="180" width="26" height="40" rx="6" fill={steel} />
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={284 + i * 3.6} y="182" width="1.4" height="36" fill="#8d9299" />)}
        <text x="200" y="208" textAnchor="middle" fontSize="11" fontFamily="system-ui" fill="#6c7078" letterSpacing="3">316L STEEL</text>
      </svg>
    )
  }
  if (view === 'Back') {
    return (
      <svg viewBox="0 0 400 400" aria-hidden="true">
        <rect x="150" y="10" width="100" height="90" rx="14" fill="#3b3b3f" />
        <rect x="150" y="300" width="100" height="90" rx="14" fill="#3b3b3f" />
        <circle cx="200" cy="200" r="120" fill={steel} />
        <circle cx="200" cy="200" r="100" fill="#b4b9c1" />
        <circle cx="200" cy="200" r="66" fill="#26282e" />
        {Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return <circle key={i} cx={200 + Math.cos(a) * 110} cy={200 + Math.sin(a) * 110} r="4" fill="#8d9299" /> })}
        <path id="ll-ring" d="M200 200m-84 0a84 84 0 1 1 168 0a84 84 0 1 1-168 0" fill="none" />
        <text fontSize="9.5" fontFamily="system-ui" fill="#4a4e56" letterSpacing="2.4"><textPath href="#ll-ring">MERIDIAN · CALIBRE M-24 · 28 JEWELS · WATER RESISTANT 100M · SAPPHIRE ·</textPath></text>
        {[[180, 185, 26], [222, 210, 18], [198, 228, 12]].map(([x, y, r], i) => (
          <g key={i}><circle cx={x} cy={y} r={r} fill="none" stroke={ink} strokeWidth="3" strokeDasharray="3 2" /><circle cx={x} cy={y} r={r * 0.3} fill={ink} /></g>
        ))}
        <path d="M200 200 L250 160 A64 64 0 0 1 262 214 Z" fill="#d9b45b" opacity=".85" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 400 400" aria-hidden="true">
      <rect x="150" y="10" width="100" height="100" rx="14" fill="#3b3b3f" />
      <rect x="150" y="290" width="100" height="100" rx="14" fill="#3b3b3f" />
      <circle cx="200" cy="200" r="120" fill={steel} />
      <rect x="318" y="188" width="16" height="24" rx="4" fill={steel} />
      <circle cx="200" cy="200" r="104" fill={dial} />
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2, big = i % 5 === 0
        return <line key={i} x1={200 + Math.cos(a) * 98} y1={200 + Math.sin(a) * 98} x2={200 + Math.cos(a) * (big ? 84 : 92)} y2={200 + Math.sin(a) * (big ? 84 : 92)} stroke={ink} strokeWidth={big ? 3 : 1} />
      })}
      {[['12', 200, 78], ['3', 318 - 14, 205], ['6', 200, 330], ['9', 96, 205]].map(([n, x, y]) => <text key={n} x={x} y={y} textAnchor="middle" fontSize="20" fontWeight="700" fontFamily="system-ui" fill={ink}>{n}</text>)}
      <text x="200" y="138" textAnchor="middle" fontSize="12" fontWeight="800" letterSpacing="3" fontFamily="system-ui" fill={ink}>MERIDIAN</text>
      <text x="200" y="152" textAnchor="middle" fontSize="7" letterSpacing="2" fontFamily="system-ui" fill={ink} opacity=".8">AUTOMATIC</text>
      <text x="200" y="268" textAnchor="middle" fontSize="7" letterSpacing="2" fontFamily="system-ui" fill={ink} opacity=".8">100M · 330FT</text>
      <rect x="262" y="192" width="22" height="16" rx="2" fill="#fff" />
      <text x="273" y="204" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="system-ui" fill="#111">11</text>
      <line x1="200" y1="200" x2="200" y2="122" stroke={ink} strokeWidth="6" strokeLinecap="round" transform="rotate(-50 200 200)" />
      <line x1="200" y1="200" x2="200" y2="102" stroke={ink} strokeWidth="4" strokeLinecap="round" transform="rotate(62 200 200)" />
      <line x1="200" y1="220" x2="200" y2="96" stroke="#e5484d" strokeWidth="1.6" transform="rotate(150 200 200)" />
      <circle cx="200" cy="200" r="6" fill={ink} />
    </svg>
  )
}

export default function LiquidLens({ zoom = 1.8, strength = 90, lensSize = 150, style }) {
  const [colour, setColour] = useState(0)
  const [view, setView] = useState(0)
  const [pos, setPos] = useState({ x: 0.36, y: 0.42 })
  const stage = useRef(null)
  const lens = useRef(null)
  const panel = useRef(null)
  const pill = useRef(null)
  const lensGlass = useLens(lens, { radius: lensSize / 2, depth: lensSize / 2, zoom, soften: 0 })
  const panelGlass = useLens(panel, { radius: 26, depth: 22, strength: strength * 0.6, fallbackBlur: 18, soften: 12 })
  const pillGlass = useLens(pill, { radius: 22, depth: 14, strength: strength * 0.5, soften: 3 })
  const [, dial, ink] = COLOURS[colour]

  const drag = (e) => {
    const r = stage.current.getBoundingClientRect()
    setPos({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) })
  }

  return (
    <div className="ll-wrap" style={style}>
      {lensGlass.filter}{panelGlass.filter}{pillGlass.filter}
      <style>{`
        .ll-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; color: #15161a; font: 500 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; background: radial-gradient(ellipse at 35% 45%, #ffffff, #e6e3dd 60%, #cfcac1); }
        :where(.ll-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .ll-glass { position: absolute; background: rgba(255,255,255,.08); box-shadow: inset 0 1px 1px rgba(255,255,255,.9), inset 0 -1px 2px rgba(0,0,0,.08), inset 0 0 0 1px rgba(255,255,255,.4), 0 18px 40px rgba(40,30,20,.18); }
        .ll-glass::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: radial-gradient(circle at var(--gx, 30%) var(--gy, 10%), rgba(255,255,255,.55), transparent 40%); }
        .ll-stage { position: absolute; left: 0; top: 0; bottom: 0; right: 290px; touch-action: none; cursor: grab; }
        .ll-stage:active { cursor: grabbing; }
        .ll-stage > svg { position: absolute; left: 50%; top: 50%; width: min(380px, 92%); height: min(380px, 92%); transform: translate(-50%, -50%); filter: drop-shadow(0 30px 30px rgba(0,0,0,.18)); }
        .ll-lens { border-radius: 50%; pointer-events: none; transform: translate(-50%, -50%); }
        .ll-hint { position: absolute; left: 16px; bottom: 14px; font-size: 11.5px; color: #6c6a64; }
        .ll-panel { right: 16px; top: 16px; bottom: 16px; width: 258px; border-radius: 26px; padding: 18px; display: flex; flex-direction: column; gap: 12px; background: rgba(255,255,255,.35); }
        .ll-panel small { letter-spacing: .14em; text-transform: uppercase; font-size: 10px; font-weight: 700; color: #6c6a64; }
        .ll-panel h2 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
        .ll-price { font-size: 18px; font-weight: 700; }
        .ll-beads { display: flex; gap: 12px; }
        .ll-bead { position: relative; width: 30px; height: 30px; border-radius: 50%; box-shadow: inset 0 2px 3px rgba(255,255,255,.8), inset 0 -3px 6px rgba(0,0,0,.25), 0 4px 10px rgba(0,0,0,.2); transition: transform 150ms; }
        .ll-bead::after { content: ''; position: absolute; left: 6px; top: 4px; width: 10px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.75); filter: blur(.5px); }
        .ll-bead[aria-checked='true'] { transform: scale(1.18); outline: 2px solid #15161a; outline-offset: 3px; }
        .ll-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; font-size: 12px; }
        .ll-specs span { color: #6c6a64; }
        .ll-specs b { display: block; color: #15161a; font-weight: 700; }
        .ll-buy { margin-top: auto; background: #15161a; color: #fff; border-radius: 999px; padding: 12px; font-weight: 700; }
        .ll-wrap .ll-buy { color: #fff; }
        .ll-pill { left: calc((100% - 290px) / 2); top: 16px; transform: translateX(-50%); display: grid; grid-template-columns: repeat(3, 70px); padding: 4px; border-radius: 22px; }
        .ll-pill button { position: relative; z-index: 1; padding: 7px 0; font-weight: 700; font-size: 12px; }
        .ll-pill i { position: absolute; top: 4px; bottom: 4px; left: 4px; width: 70px; border-radius: 18px; background: rgba(255,255,255,.7); box-shadow: 0 2px 6px rgba(0,0,0,.1); transition: transform 300ms cubic-bezier(.3,1.3,.5,1); }
        @container (max-width: 640px) { .ll-stage { right: 0; bottom: 210px; } .ll-panel { left: 12px; right: 12px; top: auto; bottom: 12px; width: auto; height: 190px; overflow: auto; } .ll-pill { left: 50%; } }
      `}</style>

      <div ref={stage} className="ll-stage" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag(e) }} onPointerMove={(e) => e.buttons && drag(e)}>
        <Watch view={VIEWS[view]} dial={dial} ink={ink} />
        <div ref={lens} className="ll-glass ll-lens" style={{ ...lensGlass.style, width: lensSize, height: lensSize, left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }} />
        <span className="ll-hint">Drag to inspect</span>
      </div>

      <div ref={pill} className="ll-glass ll-pill" style={pillGlass.style} role="tablist">
        <i style={{ transform: `translateX(${view * 100}%)` }} />
        {VIEWS.map((v, n) => <button key={v} role="tab" aria-selected={n === view} onClick={() => setView(n)}>{v}</button>)}
      </div>

      <aside ref={panel} className="ll-glass ll-panel" style={panelGlass.style} onPointerMove={specular}>
        <small>Meridian M-24</small>
        <h2>Automatic 40</h2>
        <span className="ll-price">$1,240</span>
        <div className="ll-beads" role="radiogroup" aria-label="Dial colour">
          {COLOURS.map(([name, c], n) => <button key={name} className="ll-bead" role="radio" aria-checked={n === colour} aria-label={name} title={name} style={{ background: c }} onClick={() => setColour(n)} />)}
        </div>
        <div className="ll-specs">
          <div><span>Dial</span><b>{COLOURS[colour][0]}</b></div>
          <div><span>Case</span><b>40 mm steel</b></div>
          <div><span>Movement</span><b>Automatic, 42 h</b></div>
          <div><span>Water</span><b>100 m</b></div>
        </div>
        <button className="ll-buy">Add to bag</button>
      </aside>
    </div>
  )
}
