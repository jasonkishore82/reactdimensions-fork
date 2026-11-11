import { useRef, useState } from 'react'

// Skeuomorphic desk calendar: a tear-off day pad on a wooden desk. Tear the
// top sheet to move to the next day (it curls away), stamp a day DONE with a
// rubber stamp, stick notes on the corkboard, and flip ring-binder tabs to
// switch between Day, Week and Month.

const DAY = 86400000
const VIEWS = ['Day', 'Week', 'Month']
const NOTE_COLOURS = ['#fff27a', '#ffc2d1', '#b8f2c8', '#bde0ff']
const key = (d) => d.toISOString().slice(0, 10)

export default function SkeuCalendar({ style }) {
  const today = useRef(new Date(new Date().setHours(12, 0, 0, 0))).current
  const [date, setDate] = useState(today)
  const [view, setView] = useState('Day')
  const [tearing, setTearing] = useState(null)
  const [done, setDone] = useState({})
  const [notes, setNotes] = useState([
    { id: 1, text: 'Dentist 3pm', c: 0, r: -3 },
    { id: 2, text: 'Order flowers for Sam', c: 1, r: 2 },
    { id: 3, text: 'Pay rent', c: 2, r: -1 },
  ])
  const [draft, setDraft] = useState('')
  const nextId = useRef(4)

  const go = (n) => setDate(new Date(date.getTime() + n * DAY))
  const tear = () => {
    if (tearing) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return go(1)
    setTearing(date)
    go(1)
    setTimeout(() => setTearing(null), 650)
  }
  const stamp = () => setDone({ ...done, [key(date)]: !done[key(date)] })
  const addNote = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    setNotes([...notes, { id: nextId.current++, text: draft.trim(), c: notes.length % 4, r: ((nextId.current * 7) % 7) - 3 }])
    setDraft('')
  }

  const sheet = (d, extra = '') => (
    <div className={`dc-sheet ${extra}`} aria-hidden={extra ? 'true' : undefined}>
      <span className="dc-month">{d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
      <b className="dc-num" style={{ color: d.getDay() === 0 ? '#c0352b' : undefined }}>{d.getDate()}</b>
      <span className="dc-wd">{d.toLocaleDateString('en-GB', { weekday: 'long' })}</span>
      {done[key(d)] && <span className="dc-stamp">Done</span>}
    </div>
  )

  const week = Array.from({ length: 7 }, (_, i) => new Date(date.getTime() + (i - ((date.getDay() + 6) % 7)) * DAY))
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()

  return (
    <div className="dc-wrap" style={style}>
      <style>{`
        .dc-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: repeating-linear-gradient(178deg, rgba(0,0,0,.06) 0 2px, transparent 2px 13px), repeating-linear-gradient(182deg, rgba(255,255,255,.05) 0 1px, transparent 1px 21px), linear-gradient(180deg, #b07a46, #8a5a30); color: #2a2018; font: 500 13px/1.35 Georgia, 'Times New Roman', serif; padding: 20px; box-sizing: border-box; display: grid; align-content: safe center; }
        :where(.dc-wrap) button, :where(.dc-wrap) input { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .dc { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 22px; max-width: 980px; width: 100%; margin: 0 auto; align-items: start; }
        .dc-left { min-width: 0; display: flex; flex-direction: column; gap: 0; }
        .dc-tabs { display: flex; gap: 4px; padding-left: 18px; }
        .dc-tab { padding: 8px 16px 10px; border-radius: 10px 10px 0 0; background: linear-gradient(#e8e2d4, #cfc6b2); box-shadow: inset 0 1px 0 #fff, 0 -1px 2px rgba(0,0,0,.2); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #4a3f30; transform: translateY(6px); transition: transform 150ms; }
        .dc-tab[aria-selected='true'] { background: linear-gradient(#fffdf6, #f3ecdc); transform: translateY(0); color: #2a2018; }
        .dc-pad { position: relative; margin-top: 4px; padding: 30px 18px 18px; border-radius: 12px; background: linear-gradient(180deg, #3a3a3d, #1f1f22); box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 20px 30px rgba(0,0,0,.45); }
        .dc-rings { position: absolute; left: 0; right: 0; top: -8px; display: flex; justify-content: space-evenly; pointer-events: none; z-index: 3; }
        .dc-rings i { width: 12px; height: 24px; border-radius: 6px; background: linear-gradient(90deg, #7d7d7d, #f2f2f2 45%, #8d8d8d); box-shadow: 0 2px 3px rgba(0,0,0,.5); }
        .dc-stack { position: relative; perspective: 900px; min-height: 260px; }
        .dc-stack::before, .dc-stack::after { content: ''; position: absolute; left: 4px; right: 4px; bottom: -4px; height: 100%; background: #efe8d6; border-radius: 4px; z-index: 0; box-shadow: 0 1px 1px rgba(0,0,0,.2); }
        .dc-stack::after { left: 8px; right: 8px; bottom: -8px; background: #e3dbc6; z-index: -1; }
        .dc-sheet { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; padding: 18px 12px 22px; min-height: 260px; box-sizing: border-box; border-radius: 4px; background: repeating-linear-gradient(0deg, rgba(0,0,0,.015) 0 1px, transparent 1px 3px), #fffdf6; box-shadow: inset 0 3px 0 #f0e6d0; overflow: hidden; }
        .dc-sheet::before { content: ''; position: absolute; left: 10px; right: 10px; top: 6px; border-top: 2px dotted #c9bfa8; }
        .dc-month { margin-top: 6px; font-size: 13px; letter-spacing: .18em; text-transform: uppercase; color: #8a2f2f; }
        .dc-num { font: 700 112px/1 Georgia, 'Times New Roman', serif; color: #2a2018; letter-spacing: -.04em; }
        .dc-wd { font-style: italic; font-size: 18px; color: #4a3f30; }
        .dc-stamp { position: absolute; right: 14%; bottom: 22%; padding: 4px 14px; border: 4px solid #c0352b; border-radius: 6px; color: #c0352b; font: 800 30px/1 'Arial Black', Impact, sans-serif; letter-spacing: .1em; text-transform: uppercase; transform: rotate(-14deg); opacity: .82; mix-blend-mode: multiply; -webkit-mask: radial-gradient(circle at 30% 40%, #000 60%, transparent 61%) 0 0 / 7px 7px, linear-gradient(#000, #000); mask-composite: exclude; }
        .dc-torn { position: absolute; inset: 0; z-index: 2; transform-origin: 50% 0; animation: dc-tear 650ms cubic-bezier(.5,0,.75,0) forwards; }
        @keyframes dc-tear { 0% { transform: rotateX(0) rotate(0); } 30% { transform: rotateX(-30deg) rotate(-4deg); } 100% { transform: translate(-40%, 120%) rotateX(-70deg) rotate(-28deg); opacity: 0; } }
        .dc-actions { display: flex; gap: 10px; justify-content: center; margin-top: 14px; flex-wrap: wrap; }
        .dc-btn { padding: 9px 14px; border-radius: 8px; background: linear-gradient(#fafaf6, #ddd6c4); box-shadow: 0 3px 0 #a99d82, 0 4px 6px rgba(0,0,0,.25); font-size: 13px; color: #2a2018; transition: transform 80ms, box-shadow 80ms; }
        .dc-btn:active { transform: translateY(3px); box-shadow: 0 0 0 #a99d82, inset 0 2px 4px rgba(0,0,0,.2); }
        .dc-stampbtn { display: inline-flex; align-items: center; gap: 8px; }
        .dc-stampbtn i { width: 16px; height: 22px; border-radius: 8px 8px 3px 3px; background: linear-gradient(#7a4a2a, #4a2a14); box-shadow: 0 6px 0 -2px #c0352b; }
        .dc-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; padding: 12px; min-height: 260px; box-sizing: border-box; align-content: start; }
        .dc-grid b { text-align: center; font-size: 11px; letter-spacing: .1em; color: #8a2f2f; text-transform: uppercase; }
        .dc-cell { position: relative; aspect-ratio: 1; display: grid; place-items: center; border-radius: 4px; background: #f6f0e1; font-size: 14px; color: #2a2018; }
        .dc-cell[aria-current='date'] { background: #2a2018; color: #fffdf6; }
        .dc-cell.done::after { content: '✓'; position: absolute; right: 2px; bottom: 0; font-size: 10px; color: #c0352b; font-weight: 800; }
        .dc-cell[aria-current='date'].done::after { color: #ffb3a8; }
        .dc-week { display: flex; flex-direction: column; gap: 4px; padding: 12px; min-height: 260px; box-sizing: border-box; }
        .dc-week button { display: flex; justify-content: space-between; padding: 8px 10px; border-radius: 4px; background: #f6f0e1; text-align: left; }
        .dc-week button[aria-current='date'] { background: #2a2018; color: #fffdf6; }
        .dc-cork { min-width: 0; border-radius: 12px; padding: 16px; background: radial-gradient(#a7774a 1px, transparent 1.6px) 0 0 / 7px 7px, radial-gradient(#7d5230 1px, transparent 1.6px) 3px 4px / 9px 9px, #b98a5c; box-shadow: inset 0 0 0 10px #6b4426, inset 0 0 0 12px #4a2d18, inset 0 0 30px rgba(0,0,0,.35), 0 20px 30px rgba(0,0,0,.4); }
        .dc-cork h3 { margin: 6px 0 10px; text-align: center; font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: #fffdf6; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
        .dc-notes { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 14px; padding: 8px; list-style: none; margin: 0; }
        .dc-note { position: relative; min-height: 96px; padding: 20px 10px 10px; box-sizing: border-box; font: 400 16px/1.25 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive; color: #2a2018; box-shadow: 0 8px 10px -6px rgba(0,0,0,.5), inset 0 -18px 18px -18px rgba(0,0,0,.25); overflow-wrap: anywhere; }
        .dc-note::before { content: ''; position: absolute; left: 50%; top: 5px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ff8a80, #c0352b 60%, #7a1a14); box-shadow: 0 2px 2px rgba(0,0,0,.45); }
        .dc-note button { position: absolute; right: 4px; top: 2px; width: 22px; height: 22px; border-radius: 50%; color: #4a3f30; font: 700 15px/1 sans-serif; opacity: .55; }
        .dc-note button:hover, .dc-note button:focus-visible { opacity: 1; background: rgba(0,0,0,.08); }
        .dc-add { display: flex; gap: 8px; margin-top: 12px; padding: 0 8px 4px; }
        .dc-add input { flex: 1; min-width: 0; padding: 9px 10px; border-radius: 4px; background: #fff27a; color: #2a2018; cursor: text; font: 400 15px/1.2 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive; box-shadow: inset 0 1px 3px rgba(0,0,0,.2); }
        .dc-add input::placeholder { color: #6b5d3a; }
        .dc-wrap :focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
        @container (max-width: 700px) { .dc { grid-template-columns: 1fr; } .dc-num { font-size: 88px; } }
        @media (prefers-reduced-motion: reduce) { .dc-tab, .dc-btn { transition: none; } .dc-torn { display: none; } }
      `}</style>

      <div className="dc">
        <section className="dc-left" aria-label="Desk calendar">
          <div className="dc-tabs" role="tablist" aria-label="View">
            {VIEWS.map((v) => <button key={v} role="tab" className="dc-tab" aria-selected={v === view} onClick={() => setView(v)}>{v}</button>)}
          </div>
          <div className="dc-pad">
            <div className="dc-rings" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div>
            {view === 'Day' && (
              <div className="dc-stack" aria-live="polite">
                {sheet(date)}
                {tearing && sheet(tearing, 'dc-torn')}
              </div>
            )}
            {view === 'Week' && (
              <div className="dc-sheet" style={{ padding: 0 }}>
                <div className="dc-week">
                  {week.map((d) => <button key={key(d)} aria-current={key(d) === key(date) ? 'date' : undefined} onClick={() => { setDate(d); setView('Day') }}><span>{d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric' })}</span><span>{done[key(d)] ? '✓ Done' : ''}</span></button>)}
                </div>
              </div>
            )}
            {view === 'Month' && (
              <div className="dc-sheet" style={{ padding: 0 }}>
                <div className="dc-grid">
                  {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <b key={d}>{d}</b>)}
                  {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
                  {Array.from({ length: days }, (_, i) => {
                    const d = new Date(date.getFullYear(), date.getMonth(), i + 1, 12)
                    return <button key={i} className={`dc-cell${done[key(d)] ? ' done' : ''}`} aria-current={key(d) === key(date) ? 'date' : undefined} aria-label={`${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}${done[key(d)] ? ', done' : ''}`} onClick={() => { setDate(d); setView('Day') }}>{i + 1}</button>
                  })}
                </div>
              </div>
            )}
            <div className="dc-actions">
              <button className="dc-btn" onClick={() => go(-1)} aria-label="Previous day">‹ Back</button>
              <button className="dc-btn" onClick={tear} disabled={view !== 'Day'} style={view !== 'Day' ? { opacity: 0.55 } : undefined}>Tear off ›</button>
              <button className="dc-btn dc-stampbtn" aria-pressed={!!done[key(date)]} onClick={stamp}><i aria-hidden="true" />{done[key(date)] ? 'Unstamp' : 'Stamp DONE'}</button>
            </div>
          </div>
        </section>

        <section className="dc-cork" aria-label="Corkboard reminders">
          <h3>Reminders</h3>
          <ul className="dc-notes">
            {notes.map((n) => (
              <li key={n.id} className="dc-note" style={{ background: NOTE_COLOURS[n.c], transform: `rotate(${n.r}deg)` }}>
                {n.text}
                <button aria-label={`Remove “${n.text}”`} onClick={() => setNotes(notes.filter((x) => x.id !== n.id))}>×</button>
              </li>
            ))}
          </ul>
          <form className="dc-add" onSubmit={addNote}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a sticky note…" aria-label="New sticky note" maxLength={60} />
            <button className="dc-btn" type="submit">Pin it</button>
          </form>
        </section>
      </div>
    </div>
  )
}
