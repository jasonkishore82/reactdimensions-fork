import { useRef, useState } from 'react'
import { useLens, specular } from '../liquid/lens.js'

// Liquid glass tab bar: a scrolling feed passes under a floating bar of thick
// glass that bends it at the edges. The selection is a glass droplet that
// stretches as it slides between tabs, the rim highlight follows the pointer,
// and "More" opens a glass sheet that magnifies the page edge behind it.

const TABS = [
  ['Home', 'M3 10l7-6 7 6v7H3zM8 17v-5h4v5'],
  ['Explore', 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12.5 7.5l-1.5 3.5-3.5 1.5 1.5-3.5z'],
  ['Library', 'M4 4h3v12H4zM8.5 4h3v12h-3zM13 5l3 .8-2.6 10.4-3-.8z'],
  ['Profile', 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c0-3 2.7-5 6-5s6 2 6 5'],
]

const FEED = [
  ['#ff5a3c', '#ffd23f', 'Summer in Lisbon', 'Travel'],
  ['#1d3fd1', '#7fd3ff', 'Deep focus playlist', 'Music'],
  ['#0f8a5f', '#c8f169', 'Plants that like shade', 'Home'],
  ['#2a1b3d', '#ff7ab6', 'Night markets', 'Food'],
  ['#f2eadb', '#d24a2a', 'Paper & type', 'Design'],
  ['#0b1f2a', '#38e0c8', 'Tide tables', 'Outdoors'],
]

const Icon = ({ d }) => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={d} /></svg>
)

export default function LiquidTabBar({ strength = 60, tint = 0.3, style }) {
  const [tab, setTab] = useState(0)
  const [moving, setMoving] = useState(false)
  const [sheet, setSheet] = useState(false)
  const bar = useRef(null)
  const drop = useRef(null)
  const panel = useRef(null)
  const barLens = useLens(bar, { radius: 32, depth: 16, strength, soften: 2 })
  const dropLens = useLens(drop, { radius: 24, depth: 20, strength: strength * 0.8, soften: 1 })
  const panelLens = useLens(panel, { radius: 28, depth: 28, strength: strength * 1.2, soften: 9 })

  const go = (n) => {
    if (n === tab) return
    setTab(n)
    setMoving(true)
    setTimeout(() => setMoving(false), 320)
  }

  return (
    <div className="lt-wrap" style={{ '--tint': tint, ...style }}>
      {barLens.filter}{dropLens.filter}{panelLens.filter}
      <style>{`
        .lt-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; background: #0d0d10; color: #fff; font: 500 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.lt-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .lt-feed { position: absolute; inset: 0; overflow: auto; padding: 18px 18px 110px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; align-content: start; scrollbar-width: none; }
        .lt-feed h1 { grid-column: 1 / -1; margin: 4px 0 2px; font-size: 34px; font-weight: 800; letter-spacing: -0.03em; }
        .lt-card { position: relative; border-radius: 22px; height: 230px; overflow: hidden; padding: 14px; display: flex; flex-direction: column; justify-content: flex-end; }
        .lt-card b { font-size: 20px; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; position: relative; }
        .lt-card small { font-weight: 700; letter-spacing: .1em; text-transform: uppercase; font-size: 10px; opacity: .85; position: relative; }
        .lt-card i { position: absolute; border-radius: 50%; }
        .lt-glass { background: rgba(18,18,26,var(--tint)); box-shadow: inset 0 1px 1px rgba(255,255,255,.7), inset 0 -1px 1px rgba(255,255,255,.25), inset 0 0 0 1px rgba(255,255,255,.18), 0 10px 30px rgba(0,0,0,.35); }
        .lt-glass::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: radial-gradient(circle at var(--gx, 30%) var(--gy, 0%), rgba(255,255,255,.45), transparent 45%); mix-blend-mode: soft-light; }
        .lt-bar { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); display: grid; grid-template-columns: repeat(5, 76px); height: 64px; border-radius: 32px; padding: 0 4px; align-items: center; }
        .lt-tab { position: relative; z-index: 2; height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 10.5px; font-weight: 600; opacity: .8; transition: opacity 150ms; text-shadow: 0 1px 2px rgba(0,0,0,.35); }
        .lt-tab[aria-current='page'] { opacity: 1; }
        .lt-drop { position: absolute; z-index: 1; top: 4px; left: 4px; width: 76px; height: 56px; border-radius: 28px; transition: transform 320ms cubic-bezier(.3,1.25,.5,1); }
        .lt-drop.moving { animation: lt-stretch 320ms ease; }
        @keyframes lt-stretch { 40% { scale: 1.3 .82; } }
        .lt-sheet { position: absolute; top: 12px; right: 12px; bottom: 92px; width: min(260px, 70%); border-radius: 28px; padding: 18px; transform: translateX(115%); transition: transform 420ms cubic-bezier(.2,.9,.2,1); display: flex; flex-direction: column; gap: 6px; z-index: 3; }
        .lt-sheet.open { transform: none; }
        .lt-sheet h3 { margin: 0 0 6px; font-size: 18px; text-shadow: 0 1px 3px rgba(0,0,0,.4); }
        .lt-sheet button { text-align: left; padding: 10px 12px; border-radius: 14px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,.4); }
        .lt-sheet button:hover { background: rgba(255,255,255,.14); }
        @container (max-width: 560px) { .lt-feed { grid-template-columns: repeat(2, 1fr); } .lt-bar { grid-template-columns: repeat(5, 62px); } .lt-drop { width: 62px; } }
      `}</style>

      <div className="lt-feed">
        <h1>{TABS[tab][0] === 'Home' ? 'For you' : TABS[tab][0]}</h1>
        {[...FEED, ...FEED].map(([bg, fg, title, tag], i) => (
          <article key={i} className="lt-card" style={{ background: bg, color: i % 6 === 4 ? '#1a1a1a' : '#fff' }}>
            <i style={{ width: '90%', aspectRatio: 1, background: fg, top: '-20%', right: '-35%' }} />
            <i style={{ width: '40%', aspectRatio: 1, border: `10px solid ${fg}`, bottom: '30%', left: '-10%' }} />
            <small>{tag}</small>
            <b>{title}</b>
          </article>
        ))}
      </div>

      <nav ref={bar} className="lt-bar lt-glass" style={barLens.style} onPointerMove={specular} aria-label="Main">
        <span ref={drop} className={`lt-drop lt-glass${moving ? ' moving' : ''}`} style={{ ...dropLens.style, transform: `translateX(${Math.min(tab, 4) * 100}%)` }} />
        {TABS.map(([label, d], n) => (
          <button key={label} className="lt-tab" aria-current={n === tab ? 'page' : undefined} onClick={() => go(n)}>
            <Icon d={d} />{label}
          </button>
        ))}
        <button className="lt-tab" aria-expanded={sheet} onClick={() => setSheet(!sheet)}>
          <Icon d={sheet ? 'M5 5l10 10M15 5L5 15' : 'M4 6h12M4 10h12M4 14h12'} />{sheet ? 'Close' : 'More'}
        </button>
      </nav>

      <aside ref={panel} className={`lt-sheet lt-glass${sheet ? ' open' : ''}`} style={panelLens.style} onPointerMove={specular} aria-hidden={!sheet}>
        <h3>More</h3>
        {['Downloads', 'Saved for later', 'Settings', 'Help'].map((x) => <button key={x} tabIndex={sheet ? 0 : -1}>{x}</button>)}
      </aside>
    </div>
  )
}
