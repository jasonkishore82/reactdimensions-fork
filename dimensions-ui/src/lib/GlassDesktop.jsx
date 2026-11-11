import { useEffect, useRef, useState } from 'react'
import { useOnScreen } from '../ui/onscreen.js'

// Glassmorphism desktop: frosted widgets over a dusk landscape drawn in SVG
// (layered ridges, a lake holding the sunset, the first stars). A glass menu
// bar with a live clock, a dock pill that switches widget pages, and a
// notification centre that slides in from the right.

const PAGES = ['Home', 'Focus', 'Stats']
const NOTES = [
  ['Calendar', 'Studio review in 15 min', '15:45'],
  ['Messages', 'Rui: “Pushed the new build 🚀”', '15:31'],
  ['Battery', 'Charged to 80%, holding there', '15:02'],
]
const STARS = Array.from({ length: 26 }, (_, i) => [(i * 47) % 400, (i * 23) % 70, ((i * 7) % 3) * 0.4 + 0.5])

function Wallpaper() {
  return (
    <svg className="gd-wall" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="gd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141b3b" />
          <stop offset=".45" stopColor="#5b3a6b" />
          <stop offset=".72" stopColor="#e07a5f" />
          <stop offset=".86" stopColor="#f6c38b" />
        </linearGradient>
        <linearGradient id="gd-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0b07f" />
          <stop offset=".35" stopColor="#7c4d6e" />
          <stop offset="1" stopColor="#1a1d3a" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill="url(#gd-sky)" />
      {STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity=".7" />)}
      <circle cx="250" cy="176" r="24" fill="#ffd9a0" />
      <path d="M0 150l40-24 34 16 46-40 40 30 30-14 52 34 38-28 50 22 34-12 36 20v26H0z" fill="#6c4a78" />
      <path d="M0 166l52-28 40 22 50-30 46 30 40-20 44 26 52-24 44 20 32-10v24H0z" fill="#3f3466" />
      <path d="M0 182l60-22 50 16 60-24 60 26 50-18 60 18 60-14v22H0z" fill="#262650" />
      <rect y="186" width="400" height="64" fill="url(#gd-lake)" />
      {[194, 202, 212, 224, 238].map((y, i) => <rect key={y} x={232 - i * 10} y={y} width={36 + i * 20} height="1.6" rx=".8" fill="#ffd9a0" opacity={0.7 - i * 0.12} />)}
    </svg>
  )
}

function useClock(active) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

function useMeters(active) {
  const [m, setM] = useState([34, 58, 80])
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setM((v) => [Math.min(95, Math.max(8, v[0] + (Math.random() * 18 - 9))), Math.min(90, Math.max(30, v[1] + (Math.random() * 6 - 3))), v[2]]), 1200)
    return () => clearInterval(id)
  }, [active])
  return m
}

const Ring = ({ value, label, color, size = 64 }) => {
  const r = 26, c = 2 * Math.PI * r
  return (
    <div className="gd-ring">
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 32 32)" style={{ transition: 'stroke-dasharray 900ms ease' }} />
        <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">{Math.round(value)}</text>
      </svg>
      <span>{label}</span>
    </div>
  )
}

export default function GlassDesktop({ blur = 18, frost = 0.16, style }) {
  const root = useRef(null)
  const visible = useOnScreen(root)
  const now = useClock(visible)
  const meters = useMeters(visible)
  const [page, setPage] = useState(0)
  const [panel, setPanel] = useState(false)
  const [notes, setNotes] = useState(NOTES)
  const [text, setText] = useState('Ship glass widgets\nCall framer about the dock\nWater the monstera')
  const [left, setLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [running])

  const y = now.getFullYear(), mo = now.getMonth(), today = now.getDate()
  const start = (new Date(y, mo, 1).getDay() + 6) % 7
  const days = new Date(y, mo + 1, 0).getDate()
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const timer = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`

  const Calendar = (
    <section className="gd-w gd-glass">
      <h4>{now.toLocaleDateString([], { month: 'long' })}</h4>
      <div className="gd-cal">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="dow">{d}</span>)}
        {Array.from({ length: start }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: days }, (_, i) => <span key={i} className={i + 1 === today ? 'today' : ''}>{i + 1}</span>)}
      </div>
    </section>
  )
  const Notes = (
    <section className="gd-w gd-glass gd-notes">
      <h4>Notes</h4>
      <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Notes" spellCheck={false} />
    </section>
  )
  const System = (big) => (
    <section className={`gd-w gd-glass${big ? ' gd-sys-big' : ''}`}>
      <h4>System</h4>
      <div className="gd-rings">
        <Ring value={meters[0]} label="CPU" color="#ffd27a" size={big ? 96 : 64} />
        <Ring value={meters[1]} label="Memory" color="#8fd3ff" size={big ? 96 : 64} />
        <Ring value={meters[2]} label="Battery" color="#9cf2b5" size={big ? 96 : 64} />
      </div>
    </section>
  )
  const Focus = (
    <section className="gd-w gd-glass gd-focus">
      <h4>Focus</h4>
      <b>{timer}</b>
      <div className="gd-row">
        <button className="gd-btn gd-glass" onClick={() => setRunning(!running)}>{running ? 'Pause' : left === 0 ? 'Done' : 'Start'}</button>
        <button className="gd-btn gd-glass" onClick={() => { setRunning(false); setLeft(25 * 60) }}>Reset</button>
      </div>
    </section>
  )

  return (
    <div ref={root} className="gd-wrap" data-paused={visible ? undefined : ''} style={{ '--blur': `${blur}px`, '--frost': frost, ...style }}>
      <style>{`
        .gd-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; color: #fff; background: #141b3b; font: 400 12.5px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.gd-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .gd-wall { position: absolute; inset: 0; width: 100%; height: 100%; }
        .gd-glass { background: rgba(255,255,255,var(--frost)); border: 1px solid rgba(255,255,255,.3); box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 14px 34px rgba(10,10,40,.22); -webkit-backdrop-filter: blur(var(--blur)) saturate(150%); backdrop-filter: blur(var(--blur)) saturate(150%); }
        .gd-bar { position: absolute; top: 0; left: 0; right: 0; height: 30px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-width: 0 0 1px; border-radius: 0; font-weight: 600; z-index: 3; }
        .gd-bar-r { display: flex; align-items: center; gap: 12px; font-variant-numeric: tabular-nums; }
        .gd-bell { position: relative; display: grid; }
        .gd-bell i { position: absolute; top: -2px; right: -3px; width: 7px; height: 7px; border-radius: 50%; background: #ff7a6b; }
        .gd-desk { position: absolute; inset: 42px 14px 66px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-content: start; }
        .gd-w { border-radius: 20px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .gd-w h4 { margin: 0; font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .8; }
        .gd-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; font-size: 11px; font-variant-numeric: tabular-nums; }
        .gd-cal span { padding: 3px 0; border-radius: 7px; }
        .gd-cal .dow { opacity: .6; font-weight: 700; font-size: 10px; }
        .gd-cal .today { background: #fff; color: #3f3466; font-weight: 800; }
        .gd-notes textarea { flex: 1; min-height: 110px; resize: none; border: 0; outline: none; background: transparent; color: #fff; font: 500 13px/1.6 system-ui, sans-serif; background-image: repeating-linear-gradient(transparent 0 20px, rgba(255,255,255,.18) 20px 21px); background-attachment: local; padding: 0; }
        .gd-rings { display: flex; justify-content: space-around; }
        .gd-ring { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; opacity: .95; }
        .gd-focus { align-items: center; justify-content: center; }
        .gd-focus b { font-size: 46px; font-weight: 200; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .gd-row { display: flex; gap: 8px; }
        .gd-btn { border-radius: 999px; padding: 7px 16px; font-weight: 600; }
        .gd-btn:hover { background: rgba(255,255,255,.3); }
        .gd-desk.focus { grid-template-columns: 1.3fr 1fr; }
        .gd-desk.stats { grid-template-columns: 1fr; justify-items: center; }
        .gd-sys-big { width: min(520px, 100%); }
        .gd-dock { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); display: flex; gap: 4px; padding: 5px; border-radius: 999px; z-index: 3; }
        .gd-dock button { padding: 8px 16px; border-radius: 999px; font-weight: 600; opacity: .8; transition: background 150ms; }
        .gd-dock button[aria-current='page'] { background: rgba(255,255,255,.34); opacity: 1; }
        .gd-nc { position: absolute; top: 38px; right: 10px; bottom: 10px; width: min(260px, 85%); display: flex; flex-direction: column; gap: 8px; transform: translateX(110%); transition: transform 380ms cubic-bezier(.2,.8,.2,1); z-index: 4; }
        .gd-nc.open { transform: none; }
        .gd-note { border-radius: 16px; padding: 10px 12px; position: relative; }
        .gd-note b { display: block; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; opacity: .8; }
        .gd-note small { position: absolute; top: 10px; right: 30px; opacity: .7; }
        .gd-note button { position: absolute; top: 7px; right: 8px; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; opacity: .8; }
        .gd-note button:hover { background: rgba(255,255,255,.3); }
        .gd-empty { text-align: center; opacity: .8; padding: 12px; border-radius: 16px; }
        @container (max-width: 680px) { .gd-desk, .gd-desk.focus { grid-template-columns: 1fr 1fr; overflow: auto; } }
        @container (max-width: 440px) { .gd-desk, .gd-desk.focus { grid-template-columns: 1fr; } }
      `}</style>

      <Wallpaper />

      <header className="gd-bar gd-glass">
        <span>Desk</span>
        <div className="gd-bar-r">
          <span>{now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span>{time}</span>
          <button className="gd-bell" aria-label="Notifications" aria-expanded={panel} onClick={() => setPanel(!panel)}>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 14V9a5 5 0 0 1 10 0v5l1.5 2h-13zM8.5 18h3" /></svg>
            {notes.length > 0 && <i />}
          </button>
        </div>
      </header>

      <div className={`gd-desk ${PAGES[page].toLowerCase()}`}>
        {page === 0 && <>{Calendar}{Notes}{System(false)}</>}
        {page === 1 && <>{Focus}{Notes}</>}
        {page === 2 && System(true)}
      </div>

      <nav className="gd-dock gd-glass">
        {PAGES.map((p, n) => <button key={p} aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)}>{p}</button>)}
      </nav>

      <aside className={`gd-nc${panel ? ' open' : ''}`} aria-hidden={!panel}>
        {notes.length === 0 && <div className="gd-empty gd-glass">You’re all caught up.</div>}
        {notes.map(([app, msg, t], n) => (
          <div key={app} className="gd-note gd-glass">
            <b>{app}</b><small>{t}</small>
            <button aria-label={`Dismiss ${app}`} tabIndex={panel ? 0 : -1} onClick={() => setNotes(notes.filter((_, k) => k !== n))}>×</button>
            {msg}
          </div>
        ))}
      </aside>
    </div>
  )
}
