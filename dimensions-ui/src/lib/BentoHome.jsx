import { useEffect, useState } from 'react'

// Bento app home screen: tiles for quick actions, recent files, a calendar
// peek, weather, a focus timer and battery. Whole tiles are buttons that
// press in; a bottom pill switches Home / Search / Profile; on wide screens
// a column of pinned tiles sits on the left.

const ACTIONS = [['Scan', '#ffd8a8', 'M3 7V4h3M14 4h3v3M17 13v3h-3M6 16H3v-3M3 10h14'], ['Note', '#c5f6fa', 'M5 3h7l3 3v11H5zM8 10h4M8 13h4'], ['Send', '#d0bfff', 'M3 10l14-6-5 14-2-6z'], ['Timer', '#b2f2bb', 'M10 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM10 8v3l2 1M8 2h4']]
const FILES = [['Q4 plan.pdf', '2m', '#ff6b6b'], ['Moodboard.fig', '1h', '#845ef7'], ['Budget.xlsx', 'Yesterday', '#20c997']]
const EVENTS = [['09:30', 'Stand-up', '#4dabf7'], ['12:00', 'Lunch with Rui', '#ffa94d'], ['15:45', 'Studio review', '#f783ac']]
const TABS = [['Home', 'M3 10l7-6 7 6v7H3z'], ['Search', 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM17 17l-3.5-3.5'], ['Profile', 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c0-3 2.7-5 6-5s6 2 6 5']]

const Icon = ({ d, size = 18 }) => <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={d} /></svg>

export default function BentoHome({ greeting = 'Good morning, Sam', accent = '#7048e8', style }) {
  const [tab, setTab] = useState(0)
  const [left, setLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [opened, setOpened] = useState(null)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(id)
  }, [running])
  const open = (what) => { setOpened(what); setTimeout(() => setOpened(null), 1200) }
  const mm = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`

  return (
    <div className="bh-wrap" style={{ '--accent': accent, ...style }}>
      <style>{`
        .bh-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; background: #f6f5fb; color: #1d1b2c; font: 500 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; display: grid; grid-template-columns: 150px 1fr; }
        :where(.bh-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: left; }
        .bh-pins { padding: 16px 0 16px 16px; display: flex; flex-direction: column; gap: 10px; }
        .bh-pins small { font-weight: 700; color: #5f5b78; letter-spacing: .1em; text-transform: uppercase; font-size: 10px; }
        .bh-pin { border-radius: 18px; padding: 12px; background: #fff; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
        .bh-main { overflow: auto; padding: 16px 16px 84px; }
        .bh-main h1 { margin: 0 0 12px; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
        .bh { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 112px; gap: 12px; }
        .bh-tile { position: relative; border-radius: 22px; padding: 14px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.04); display: flex; flex-direction: column; gap: 6px; overflow: hidden; transition: transform 120ms ease, box-shadow 150ms; }
        .bh-tile:hover { box-shadow: 0 8px 20px rgba(30,20,80,.08); }
        .bh-tile:active { transform: scale(.97); }
        .bh-tile h3 { margin: 0; font-size: 12px; font-weight: 700; color: #5f5b78; letter-spacing: .06em; text-transform: uppercase; }
        .bh-actions { grid-column: span 2; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px; }
        .bh-act { border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-weight: 700; font-size: 11.5px; transition: transform 120ms; }
        .bh-act:active { transform: scale(.94); }
        .bh-files { grid-column: span 2; grid-row: span 2; }
        .bh-file { display: flex; align-items: center; gap: 10px; padding: 7px 4px; border-radius: 10px; }
        .bh-file:hover { background: #f6f5fb; }
        .bh-file i { width: 30px; height: 36px; border-radius: 6px; flex: none; position: relative; }
        .bh-file i::after { content: ''; position: absolute; right: 0; top: 0; border: 6px solid #fff; border-left-color: transparent; border-bottom-color: transparent; }
        .bh-file small { display: block; color: #5f5b78; }
        .bh-cal { grid-column: span 2; grid-row: span 2; background: #1d1b2c; color: #fff; }
        .bh-cal h3 { color: #b3aecf; }
        .bh-date { display: flex; align-items: baseline; gap: 8px; }
        .bh-date b { font-size: 34px; font-weight: 800; }
        .bh-ev { display: flex; gap: 10px; align-items: center; padding: 3px 0; }
        .bh-ev i { width: 4px; height: 26px; border-radius: 2px; }
        .bh-ev small { display: block; color: #b3aecf; }
        .bh-weather { background: linear-gradient(160deg, #74c0fc, #4263eb); color: #fff; }
        .bh-weather h3 { color: rgba(255,255,255,.85); }
        .bh-weather b { font-size: 30px; font-weight: 300; margin-top: auto; line-height: 1; }
        .bh-weather span { font-size: 12px; opacity: .9; }
        .bh-focus { background: var(--accent); color: #fff; }
        .bh-focus h3 { color: #fff; }
        .bh-focus b { font-size: 26px; font-weight: 700; margin-top: auto; font-variant-numeric: tabular-nums; }
        .bh-focus small { font-weight: 600; }
        .bh-batt { grid-column: span 2; flex-direction: row; align-items: center; justify-content: space-around; }
        .bh-b { display: flex; flex-direction: column; align-items: center; gap: 4px; font-weight: 700; font-size: 11.5px; }
        .bh-b svg { transform: rotate(-90deg); }
        .bh-tabs { position: absolute; left: 50%; bottom: 14px; transform: translateX(calc(-50% + 75px)); display: flex; gap: 4px; padding: 5px; border-radius: 999px; background: #1d1b2c; z-index: 3; }
        .bh-tabs button { display: flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 999px; color: #b3aecf; font-weight: 700; text-align: center; }
        .bh-tabs button[aria-current='page'] { background: #fff; color: #1d1b2c; }
        .bh-toast { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); background: #1d1b2c; color: #fff; border-radius: 999px; padding: 7px 14px; font-weight: 700; z-index: 4; }
        @container (max-width: 720px) { .bh-wrap { grid-template-columns: 1fr; } .bh-pins { display: none; } .bh { grid-template-columns: repeat(2, 1fr); } .bh-tabs { transform: translateX(-50%); } }
      `}</style>

      <aside className="bh-pins">
        <small>Pinned</small>
        <button className="bh-pin" onClick={() => open('Design system')}><b>Design system</b><span style={{ color: '#5f5b78' }}>14 files</span></button>
        <button className="bh-pin" onClick={() => open('Team wiki')}><b>Team wiki</b><span style={{ color: '#5f5b78' }}>Updated 3h ago</span></button>
        <button className="bh-pin" onClick={() => open('Invoices')}><b>Invoices</b><span style={{ color: '#5f5b78' }}>2 due</span></button>
      </aside>

      <main className="bh-main">
        <h1>{greeting}</h1>
        <div className="bh">
          <div className="bh-tile bh-actions">
            {ACTIONS.map(([l, c, d]) => <button key={l} className="bh-act" style={{ background: c }} onClick={() => open(l)}><Icon d={d} size={20} />{l}</button>)}
          </div>
          <button className="bh-tile bh-weather" onClick={() => open('Weather')}><h3>Lisbon</h3><b>19°</b><span>Sunny, light breeze</span></button>
          <button className="bh-tile bh-focus" aria-pressed={running} onClick={() => setRunning(!running)}>
            <h3>Focus</h3><b>{mm}</b><small>{running ? 'Tap to pause' : left < 1500 ? 'Paused · tap to resume' : 'Tap to start'}</small>
          </button>
          <div className="bh-tile bh-files">
            <h3>Recent</h3>
            {FILES.map(([n, t, c]) => <button key={n} className="bh-file" onClick={() => open(n)}><i style={{ background: c }} /><span><b>{n}</b><small>Edited {t}</small></span></button>)}
          </div>
          <div className="bh-tile bh-cal">
            <h3>Today</h3>
            <div className="bh-date"><b>{new Date().getDate()}</b><span>{new Date().toLocaleDateString('en-GB', { weekday: 'long', month: 'long' })}</span></div>
            {EVENTS.map(([t, n, c]) => <div key={n} className="bh-ev"><i style={{ background: c }} /><span><b>{n}</b><small>{t}</small></span></div>)}
          </div>
          <div className="bh-tile bh-batt">
            {[['Phone', 82, '#40c057'], ['Watch', 46, '#fab005'], ['Buds', 18, '#fa5252']].map(([n, v, c]) => (
              <div key={n} className="bh-b">
                <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" fill="none" stroke="#efedf7" strokeWidth="5" /><circle cx="22" cy="22" r="18" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(v / 100) * 113} 113`} /></svg>
                {n} {v}%
              </div>
            ))}
          </div>
        </div>
      </main>

      <nav className="bh-tabs">
        {TABS.map(([l, d], n) => <button key={l} aria-label={l} aria-current={n === tab ? 'page' : undefined} onClick={() => setTab(n)}><Icon d={d} />{n === tab && l}</button>)}
      </nav>
      {opened && <div className="bh-toast" role="status">Opening {opened}…</div>}
    </div>
  )
}
