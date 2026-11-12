import { useState } from 'react'

// Flat UI tool launcher: a grid of flat single-colour icon tiles that fill
// with their colour when picked, a collapsible list of category chips with
// colour dots, and a bottom tab bar with a pill behind the active icon.

const P = {
  calc: 'M6 3h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM7.5 6h5M7.5 10h.01M10 10h.01M12.5 10h.01M7.5 13h.01M10 13h.01M12.5 13h.01',
  swap: 'M4 7h11l-3-3M16 13H5l3 3',
  timer: 'M10 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM10 8v3l2 1M8 2h4',
  stop: 'M10 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM10 8v3M15 5l1.5-1.5M8 2h4',
  note: 'M5 3h7l3 3v11H5zM12 3v3h3M7.5 10h5M7.5 13h5',
  scan: 'M3 7V4h3M14 4h3v3M17 13v3h-3M6 16H3v-3M3 10h14',
  folder: 'M3 6a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  compass: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12.5 7.5l-1.5 3.5-3.5 1.5 1.5-3.5z',
  level: 'M3 8h14v4H3zM9 8v4M11 8v4',
  home: 'M3 9l7-6 7 6v8H3zM8 17v-5h4v5',
  clock: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 6v4l3 2',
  star: 'M10 3l2.2 4.5 4.8.7-3.5 3.4.8 4.9L10 14.2l-4.3 2.3.8-4.9L3 8.2l4.8-.7z',
  gear: 'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8',
  chev: 'M12 5l-5 5 5 5',
}

const CATS = [
  ['All', '#868e96'],
  ['Maths', '#3b82f6'],
  ['Time', '#f97316'],
  ['Files', '#10b981'],
  ['Write', '#a855f7'],
  ['Travel', '#ef4444'],
]

const TOOLS = [
  ['Calculator', 'calc', 'Maths'],
  ['Converter', 'swap', 'Maths'],
  ['Timer', 'timer', 'Time'],
  ['Stopwatch', 'stop', 'Time'],
  ['Notes', 'note', 'Write'],
  ['Scanner', 'scan', 'Files'],
  ['Files', 'folder', 'Files'],
  ['Compass', 'compass', 'Travel'],
  ['Level', 'level', 'Travel'],
]

const TABS = [['Home', 'home'], ['Recent', 'clock'], ['Saved', 'star'], ['Settings', 'gear']]

const Icon = ({ d, size = 22 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const colorOf = (cat) => CATS.find((c) => c[0] === cat)[1]

export default function FlatUtility({ accent = '#3b82f6', tileRadius = 14, showLabels = true, style }) {
  const [cat, setCat] = useState('All')
  const [open, setOpen] = useState(true)
  const [picked, setPicked] = useState('Timer')
  const [tab, setTab] = useState(0)
  const tools = TOOLS.filter((t) => cat === 'All' || t[2] === cat)

  return (
    <div className="fu-wrap" style={{ '--accent': accent, '--tr': `${tileRadius}px`, ...style }}>
      <div className={`fu${open ? '' : ' fu-closed'}`}>
      <style>{`
        .fu-wrap { container-type: inline-size; width: 100%; height: 100%; }
        .fu { display: grid; grid-template-columns: 170px 1fr; width: 100%; height: 100%; background: #f1f3f5; color: #212529; font: 400 13px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif; overflow: hidden; transition: grid-template-columns 200ms ease; }
        .fu.fu-closed { grid-template-columns: 52px 1fr; }
        .fu * { box-sizing: border-box; }
        .fu button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
        .fu-side { background: #fff; border-right: 1px solid #e9ecef; padding: 14px 10px; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
        .fu-toggle { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 12px; font-weight: 800; font-size: 14px; white-space: nowrap; }
        .fu-toggle svg { transition: transform 200ms; flex: none; }
        .fu-closed .fu-toggle svg { transform: rotate(180deg); }
        .fu-closed .fu-toggle span, .fu-closed .fu-chip span { display: none; }
        .fu-chip { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 999px; font-weight: 600; white-space: nowrap; text-align: left; }
        .fu-chip i { width: 10px; height: 10px; border-radius: 50%; flex: none; }
        .fu-chip[aria-pressed='true'] { background: #f1f3f5; }
        .fu-main { display: grid; grid-template-rows: auto 1fr auto; min-width: 0; }
        .fu-head { display: flex; align-items: baseline; justify-content: space-between; padding: 16px 20px 6px; }
        .fu-head h2 { margin: 0; font-size: 18px; font-weight: 800; }
        .fu-head span { color: #5c636a; font-weight: 600; }
        .fu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; padding: 10px 20px 14px; overflow: auto; align-content: start; }
        .fu-tile { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 6px 0; }
        .fu-box { width: 64px; height: 64px; border-radius: var(--tr); background: #fff; display: grid; place-items: center; color: var(--c); transition: background 140ms, color 140ms, transform 100ms; }
        .fu-tile:hover .fu-box { background: color-mix(in srgb, var(--c) 12%, #fff); }
        .fu-tile:active .fu-box { transform: scale(0.95); }
        .fu-tile[aria-pressed='true'] .fu-box { background: var(--c); color: #fff; }
        .fu-tile b { font-weight: 600; font-size: 12px; }
        .fu-tabs { display: flex; justify-content: space-around; background: #fff; border-top: 1px solid #e9ecef; padding: 8px 12px; }
        .fu-tab { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; color: #5c636a; padding: 0 6px; }
        .fu-pill { width: 52px; height: 28px; border-radius: 999px; display: grid; place-items: center; transition: background 160ms; }
        .fu-tab[aria-selected='true'] { color: color-mix(in srgb, var(--accent), black 32%); }
        .fu-tab[aria-selected='true'] .fu-pill { background: color-mix(in srgb, var(--accent) 16%, #fff); }
        @container (max-width: 520px) { .fu { grid-template-columns: 52px 1fr; } .fu .fu-toggle span, .fu .fu-chip span { display: none; } }
      `}</style>

      <aside className="fu-side">
        <button className="fu-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span>Categories</span>
          <Icon d={P.chev} size={16} />
        </button>
        {CATS.map(([name, color]) => (
          <button key={name} className="fu-chip" aria-pressed={cat === name} title={name} onClick={() => setCat(name)}>
            <i style={{ background: color }} />
            <span>{name}</span>
          </button>
        ))}
      </aside>

      <main className="fu-main">
        <header className="fu-head">
          <h2>{cat === 'All' ? 'All tools' : cat}</h2>
          <span>{tools.length} tools</span>
        </header>
        <div className="fu-grid">
          {tools.map(([name, icon, c]) => (
            <button key={name} className="fu-tile" aria-pressed={picked === name} style={{ '--c': colorOf(c) }} onClick={() => setPicked(name)}>
              <span className="fu-box"><Icon d={P[icon]} size={28} /></span>
              {showLabels && <b>{name}</b>}
            </button>
          ))}
        </div>
        <nav className="fu-tabs" role="tablist">
          {TABS.map(([label, icon], i) => (
            <button key={label} role="tab" className="fu-tab" aria-selected={i === tab} onClick={() => setTab(i)}>
              <span className="fu-pill"><Icon d={P[icon]} size={20} /></span>
              {label}
            </button>
          ))}
        </nav>
      </main>
      </div>
    </div>
  )
}
