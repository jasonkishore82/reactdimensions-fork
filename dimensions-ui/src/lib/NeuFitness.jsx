import { useEffect, useState } from 'react'

// Neumorphic activity tracker. A recessed circular track holds a raised
// progress ring; the centre is a raised disc. Tap a day in the week to see
// its ring, start a workout (the button presses in and the timer runs), and
// switch tabs on a bottom bar where the active icon sits on a raised dot.

const NEU = {
  light: { base: '#e6ebf2', hi: '#ffffff', lo: '#b6c0ce', ink: '#243044', muted: '#56627a' },
  dark: { base: '#2a2e37', hi: '#363b47', lo: '#1b1e25', ink: '#e8ebf1', muted: '#a3abb9' },
}

const WEEK = [
  ['Mon', 8240, 410, 6.1, 52],
  ['Tue', 10420, 520, 7.8, 64],
  ['Wed', 6100, 300, 4.5, 31],
  ['Thu', 11800, 590, 8.9, 72],
  ['Fri', 9050, 450, 6.8, 47],
  ['Sat', 12600, 640, 9.5, 88],
  ['Sun', 7450, 372, 5.6, 40],
]
const TABS = [
  ['Today', 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 6v4l3 2'],
  ['Workouts', 'M3 8v4M6 6v8M14 6v8M17 8v4M6 10h8'],
  ['Trends', 'M3 15l4-5 3 3 7-8'],
  ['Profile', 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c0-3 2.7-5 6-5s6 2 6 5'],
]

const Icon = ({ d, size = 20 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={d} /></svg>
)

export default function NeuFitness({ mode = 'light', accent = '#ff7a45', goal = 10000, style }) {
  const t = NEU[mode] ?? NEU.light
  const [day, setDay] = useState(6)
  const [tab, setTab] = useState(0)
  const [running, setRunning] = useState(false)
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  const [name, steps, kcal, km, mins] = WEEK[day]
  const frac = Math.min(1, steps / goal)
  const R = 74, C = 2 * Math.PI * R
  const max = Math.max(goal, ...WEEK.map((w) => w[1]))
  const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

  return (
    <div className="nf-wrap" style={{ '--base': t.base, '--hi': t.hi, '--lo': t.lo, '--ink': t.ink, '--muted': t.muted, '--accent': accent, ...style }}>
      <style>{`
        .nf-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: var(--base); color: var(--ink); font: 500 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.nf-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .nf-up { background: var(--base); box-shadow: 6px 6px 14px var(--lo), -6px -6px 14px var(--hi); }
        .nf-in { background: var(--base); box-shadow: inset 5px 5px 10px var(--lo), inset -5px -5px 10px var(--hi); }
        .nf { display: grid; grid-template-columns: 240px 1fr; grid-template-rows: 1fr auto; gap: 20px 26px; padding: 20px 22px 14px; min-height: 100%; box-sizing: border-box; }
        .nf-ring { justify-self: center; position: relative; width: 200px; height: 200px; border-radius: 50%; display: grid; place-items: center; }
        .nf-ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
        .nf-core { width: 118px; height: 118px; border-radius: 50%; display: grid; place-items: center; text-align: center; }
        .nf-core b { display: block; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .nf-core small { color: var(--muted); font-size: 11.5px; }
        .nf-left { display: flex; flex-direction: column; gap: 18px; align-items: center; }
        .nf-go { width: 100%; padding: 13px; border-radius: 999px; font-weight: 800; font-size: 14px; color: var(--accent); transition: box-shadow 160ms; display: flex; justify-content: center; gap: 8px; align-items: center; }
        .nf-go[aria-pressed='true'] { box-shadow: inset 5px 5px 10px var(--lo), inset -5px -5px 10px var(--hi); }
        .nf-go i { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); }
        .nf-go[aria-pressed='true'] i { animation: nf-pulse 1s ease-in-out infinite; }
        @keyframes nf-pulse { 50% { opacity: .25; } }
        .nf-right { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
        .nf-right h2 { margin: 0; font-size: 20px; font-weight: 800; }
        .nf-right h2 small { color: var(--muted); font-weight: 600; font-size: 13px; margin-left: 8px; }
        .nf-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .nf-stat { border-radius: 16px; padding: 12px 14px; }
        .nf-stat small { display: block; color: var(--muted); font-size: 11.5px; font-weight: 600; }
        .nf-stat b { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .nf-stat b span { font-size: 12px; color: var(--muted); font-weight: 600; margin-left: 2px; }
        .nf-week { border-radius: 18px; padding: 12px 14px 10px; display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; align-items: end; height: 140px; box-sizing: border-box; }
        .nf-day { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; font-size: 11px; font-weight: 700; color: var(--muted); }
        .nf-track { width: 14px; flex: 1; border-radius: 999px; display: flex; align-items: flex-end; overflow: hidden; }
        .nf-track i { display: block; width: 100%; border-radius: 999px; background: color-mix(in srgb, var(--muted) 45%, var(--base)); transition: height 300ms; }
        .nf-day.met .nf-track i { background: var(--accent); }
        .nf-day[aria-pressed='true'] { color: var(--accent); }
        .nf-day .nf-dot { display: block; width: 5px; height: 5px; border-radius: 50%; background: transparent; }
        .nf-day.met .nf-dot { background: var(--accent); }
        .nf-tabs { grid-column: 1 / -1; display: flex; justify-content: space-around; border-radius: 22px; padding: 8px; }
        .nf-tab { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: var(--muted); padding: 2px 10px; }
        .nf-tab span { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; transition: box-shadow 200ms; }
        .nf-tab[aria-selected='true'] { color: var(--accent); }
        .nf-tab[aria-selected='true'] span { box-shadow: 4px 4px 9px var(--lo), -4px -4px 9px var(--hi); }
        @container (max-width: 640px) { .nf { grid-template-columns: 1fr; } .nf-stats { grid-template-columns: repeat(3, 1fr); gap: 8px; } }
        @media (prefers-reduced-motion: reduce) { .nf-wrap * { animation: none !important; } }
      `}</style>

      <div className="nf">
        <div className="nf-left">
          <div className="nf-ring nf-in" role="img" aria-label={`${steps.toLocaleString()} of ${goal.toLocaleString()} steps`}>
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r={R} fill="none" stroke={accent} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${frac * C} ${C}`} style={{ transition: 'stroke-dasharray 500ms ease', filter: `drop-shadow(2px 2px 3px ${t.lo})` }} />
            </svg>
            <div className="nf-core nf-up">
              <div><b>{steps.toLocaleString()}</b><small>{Math.round(frac * 100)}% of {goal / 1000}k steps</small></div>
            </div>
          </div>
          <button className={`nf-go ${running ? '' : 'nf-up'}`} aria-pressed={running} onClick={() => setRunning(!running)}>
            <i />{running ? `Pause · ${clock}` : secs ? `Resume · ${clock}` : 'Start workout'}
          </button>
        </div>

        <div className="nf-right">
          <h2>{name === 'Sun' ? 'Today' : name}<small>{steps >= goal ? 'Goal reached' : `${(goal - steps).toLocaleString()} steps to go`}</small></h2>
          <div className="nf-stats">
            {[['Calories', kcal, 'kcal'], ['Distance', km, 'km'], ['Active', mins, 'min']].map(([l, v, u]) => (
              <div key={l} className="nf-stat nf-up"><small>{l}</small><b>{v}<span>{u}</span></b></div>
            ))}
          </div>
          <div className="nf-week nf-in" role="group" aria-label="This week">
            {WEEK.map(([d, s], n) => (
              <button key={d} className={`nf-day${s >= goal ? ' met' : ''}`} aria-pressed={n === day} onClick={() => setDay(n)} aria-label={`${d}: ${s.toLocaleString()} steps`}>
                <span className="nf-track nf-in"><i style={{ height: `${(s / max) * 100}%` }} /></span>
                <span className="nf-dot" />
                {d}
              </button>
            ))}
          </div>
        </div>

        <nav className="nf-tabs nf-in" role="tablist">
          {TABS.map(([l, d], n) => (
            <button key={l} role="tab" className="nf-tab" aria-selected={n === tab} onClick={() => setTab(n)}>
              <span><Icon d={d} /></span>{l}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
