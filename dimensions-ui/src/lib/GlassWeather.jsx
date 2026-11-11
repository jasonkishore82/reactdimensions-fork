import { useState } from 'react'

// Glassmorphism weather app. The sky behind the glass is drawn live for
// each city's conditions: sun and drifting cloud, falling snow, driving
// rain, or a starry night. Frosted cards for now, hourly and the week; a
// glass radar; unit chips; and a tall glass list of saved cities.

const CITIES = [
  { name: 'Lisbon', cond: 'Sunny', scene: 'sun', t: 24, hi: 27, lo: 17, hourly: [22, 24, 26, 27, 26, 24, 21], week: [[27, 17], [28, 18], [25, 16], [23, 15], [26, 17]] },
  { name: 'Oslo', cond: 'Light snow', scene: 'snow', t: -3, hi: -1, lo: -7, hourly: [-4, -3, -2, -1, -2, -4, -6], week: [[-1, -7], [0, -6], [-2, -9], [1, -4], [-3, -8]] },
  { name: 'Mumbai', cond: 'Heavy rain', scene: 'rain', t: 29, hi: 30, lo: 26, hourly: [28, 29, 29, 30, 29, 28, 27], week: [[30, 26], [31, 26], [29, 25], [30, 26], [31, 27]] },
  { name: 'Reykjavík', cond: 'Clear night', scene: 'night', t: 2, hi: 5, lo: -1, hourly: [2, 1, 0, 0, -1, 0, 2], week: [[5, -1], [4, -2], [6, 0], [3, -3], [5, -1]] },
]
const DAYS = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon']
const HOURS = ['Now', '13', '14', '15', '16', '17', '18']
const TABS = ['Today', 'Week', 'Radar']

const SKY = {
  sun: 'linear-gradient(180deg, #1e6fd9 0%, #4aa3ec 55%, #9fd3f2 100%)',
  snow: 'linear-gradient(180deg, #7f98ae 0%, #b5c6d3 60%, #e3eaef 100%)',
  rain: 'linear-gradient(180deg, #1d2b37 0%, #34505f 60%, #4d6b78 100%)',
  night: 'linear-gradient(180deg, #050a1f 0%, #14204a 60%, #2a3570 100%)',
}

// Deterministic particles so the scenes don't jump between renders.
const DOTS = Array.from({ length: 60 }, (_, i) => ({ x: (i * 61) % 100, d: ((i * 37) % 50) / 10, s: 2 + ((i * 13) % 4), dur: 4 + ((i * 7) % 5) }))

function Scene({ kind }) {
  if (kind === 'sun') {
    return (
      <>
        <div className="gw-sun" />
        <div className="gw-cloud" style={{ top: '18%', animationDuration: '38s' }} />
        <div className="gw-cloud" style={{ top: '46%', animationDuration: '52s', animationDelay: '-20s', transform: 'scale(.7)' }} />
      </>
    )
  }
  if (kind === 'snow') return DOTS.map((p, i) => <i key={i} className="gw-flake" style={{ left: `${p.x}%`, width: p.s, height: p.s, animationDuration: `${p.dur + 3}s`, animationDelay: `-${p.d}s` }} />)
  if (kind === 'rain') return DOTS.map((p, i) => <i key={i} className="gw-drop" style={{ left: `${p.x}%`, animationDuration: `${0.5 + p.d / 10}s`, animationDelay: `-${p.d}s` }} />)
  return (
    <>
      {DOTS.map((p, i) => <i key={i} className="gw-star" style={{ left: `${p.x}%`, top: `${(i * 29) % 70}%`, width: p.s / 1.6, height: p.s / 1.6, animationDelay: `-${p.d}s` }} />)}
      <div className="gw-moon" />
    </>
  )
}

const Glyph = ({ kind, size = 22 }) => {
  const p = {
    sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></>,
    snow: <><path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 2A3 3 0 0 0 7 15z" /><path d="M9 19h.01M12 21h.01M15 19h.01" /></>,
    rain: <><path d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 2A3 3 0 0 0 7 14z" /><path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3" /></>,
    night: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  }[kind]
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>
}

export default function GlassWeather({ blur = 16, frost = 0.18, unit = 'C', style }) {
  const [city, setCity] = useState(0)
  const [u, setU] = useState(unit)
  const [tab, setTab] = useState(0)
  const c = CITIES[city]
  const deg = (v) => `${Math.round(u === 'C' ? v : v * 1.8 + 32)}°`
  // the week's range bars share one scale for the city, so days compare at a glance
  const lo = Math.min(...c.week.map((w) => w[1])) - 2
  const hi = Math.max(...c.week.map((w) => w[0])) + 2

  return (
    <div className="gw-wrap" style={{ '--blur': `${blur}px`, '--frost': frost, ...style }}>
      <style>{`
        .gw-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; color: #fff; font: 400 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.gw-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .gw-sky { position: absolute; inset: 0; transition: background 600ms ease; overflow: hidden; }
        .gw-sun { position: absolute; right: 14%; top: 10%; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, #fff6c9 0 34%, #ffd45c 35% 48%, rgba(255,212,92,0) 72%); }
        .gw-cloud { position: absolute; left: -30%; width: 220px; height: 60px; border-radius: 999px; background: rgba(255,255,255,.85); filter: blur(6px); animation: gw-drift linear infinite; }
        .gw-cloud::before { content: ''; position: absolute; left: 40px; top: -30px; width: 100px; height: 80px; border-radius: 50%; background: inherit; }
        @keyframes gw-drift { to { left: 120%; } }
        .gw-flake { position: absolute; top: -10px; border-radius: 50%; background: #fff; opacity: .9; animation: gw-fall linear infinite; }
        @keyframes gw-fall { to { transform: translate(30px, 520px); } }
        .gw-drop { position: absolute; top: -40px; width: 2px; height: 34px; background: linear-gradient(transparent, rgba(225,238,255,.95)); animation: gw-rain linear infinite; transform: rotate(12deg); }
        @keyframes gw-rain { to { transform: translate(-110px, 560px) rotate(12deg); } }
        .gw-star { position: absolute; border-radius: 50%; background: #fff; animation: gw-twinkle 3s ease-in-out infinite alternate; }
        @keyframes gw-twinkle { from { opacity: .25; } to { opacity: 1; } }
        .gw-moon { position: absolute; right: 16%; top: 12%; width: 70px; height: 70px; border-radius: 50%; box-shadow: -16px 6px 0 0 #f4ecd2; transform: rotate(-20deg); }
        .gw-glass { background: rgba(255,255,255,var(--frost)); border: 1px solid rgba(255,255,255,.34); box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 12px 30px rgba(0,0,0,.12); -webkit-backdrop-filter: blur(var(--blur)) saturate(140%); backdrop-filter: blur(var(--blur)) saturate(140%); border-radius: 18px; }
        .gw { position: relative; height: 100%; display: grid; grid-template-columns: 180px 1fr; gap: 14px; padding: 14px; }
        .gw-side { padding: 10px; display: flex; flex-direction: column; gap: 4px; overflow: auto; }
        .gw-side h4 { margin: 2px 6px 6px; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; opacity: .75; }
        .gw-city { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 10px; border-radius: 12px; text-align: left; }
        .gw-city:hover { background: rgba(255,255,255,.12); }
        .gw-city[aria-current='true'] { background: rgba(255,255,255,.28); }
        .gw-city b { display: block; font-weight: 600; }
        .gw-city span span { font-size: 11px; opacity: .75; }
        .gw-city .gw-temp { opacity: 1; font-style: normal; font-size: 18px; font-weight: 300; }
        .gw-main { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .gw-now { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; }
        .gw-now h2 { margin: 0; font-size: 20px; font-weight: 600; }
        .gw-now p { margin: 2px 0 0; opacity: .85; display: flex; gap: 6px; align-items: center; }
        .gw-big { font-size: 56px; font-weight: 200; line-height: 1; letter-spacing: -0.03em; }
        .gw-units { display: flex; gap: 4px; margin-top: 6px; justify-content: flex-end; }
        .gw-chip { padding: 3px 9px; border-radius: 999px; font-weight: 600; font-size: 11px; }
        .gw-chip[aria-pressed='true'] { background: rgba(255,255,255,.4); box-shadow: inset 0 0 8px rgba(255,255,255,.4); }
        .gw-tabs { align-self: flex-start; display: flex; padding: 3px; border-radius: 999px; }
        .gw-tab { padding: 6px 14px; border-radius: 999px; font-weight: 600; font-size: 12px; opacity: .8; }
        .gw-tab[aria-selected='true'] { background: rgba(255,255,255,.34); opacity: 1; }
        .gw-panel { flex: 1; min-height: 0; padding: 12px 14px; }
        .gw-hours { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; height: 100%; align-items: center; }
        .gw-hours span { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; }
        .gw-hours b { font-size: 15px; font-weight: 600; }
        .gw-week { display: grid; gap: 6px; }
        .gw-day { display: grid; grid-template-columns: 40px 24px 36px 1fr 36px; align-items: center; gap: 8px; }
        .gw-day small { opacity: .75; text-align: right; }
        .gw-range { height: 5px; border-radius: 999px; background: rgba(255,255,255,.2); position: relative; }
        .gw-range i { position: absolute; top: 0; bottom: 0; border-radius: inherit; background: linear-gradient(90deg, #8fd3ff, #ffd36b); }
        .gw-radar { height: 100%; display: grid; place-items: center; }
        .gw-scope { position: relative; width: min(150px, 100%); aspect-ratio: 1; border-radius: 50%; border: 1px solid rgba(255,255,255,.45); background: repeating-radial-gradient(circle, transparent 0 24px, rgba(255,255,255,.18) 24px 25px); overflow: hidden; }
        .gw-sweep { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, rgba(255,255,255,.55), rgba(255,255,255,0) 22%); animation: gw-spin 3s linear infinite; }
        @keyframes gw-spin { to { transform: rotate(360deg); } }
        .gw-blip { position: absolute; width: 18px; height: 12px; border-radius: 50%; background: rgba(120,220,140,.8); filter: blur(2px); }
        @container (max-width: 640px) { .gw { grid-template-columns: 1fr; grid-template-rows: auto 1fr; } .gw-side { flex-direction: row; overflow-x: auto; padding: 6px; } .gw-side h4 { display: none; } .gw-city { flex: none; } .gw-big { font-size: 44px; } }
        @media (prefers-reduced-motion: reduce) { .gw-wrap * { animation: none !important; } }
      `}</style>

      <div className="gw-sky" style={{ background: SKY[c.scene] }} aria-hidden="true"><Scene kind={c.scene} /></div>

      <div className="gw">
        <aside className="gw-side gw-glass">
          <h4>Saved places</h4>
          {CITIES.map((x, n) => (
            <button key={x.name} className="gw-city" aria-current={n === city} onClick={() => setCity(n)}>
              <span><b>{x.name}</b><span>{x.cond}</span></span>
              <span className="gw-temp">{deg(x.t)}</span>
            </button>
          ))}
        </aside>

        <main className="gw-main">
          <section className="gw-now gw-glass">
            <div>
              <h2>{c.name}</h2>
              <p><Glyph kind={c.scene} size={16} /> {c.cond} · H {deg(c.hi)} L {deg(c.lo)}</p>
            </div>
            <div>
              <div className="gw-big">{deg(c.t)}</div>
              <div className="gw-units">
                {['C', 'F'].map((k) => (
                  <button key={k} className="gw-chip gw-glass" aria-pressed={u === k} onClick={() => setU(k)}>°{k}</button>
                ))}
              </div>
            </div>
          </section>

          <div className="gw-tabs gw-glass" role="tablist">
            {TABS.map((x, n) => <button key={x} role="tab" className="gw-tab" aria-selected={n === tab} onClick={() => setTab(n)}>{x}</button>)}
          </div>

          <section className="gw-panel gw-glass">
            {tab === 0 && (
              <div className="gw-hours">
                {c.hourly.map((v, n) => <span key={n}>{HOURS[n]}<Glyph kind={c.scene} size={18} /><b>{deg(v)}</b></span>)}
              </div>
            )}
            {tab === 1 && (
              <div className="gw-week">
                {c.week.map(([h, l], n) => (
                  <div key={n} className="gw-day">
                    <b>{DAYS[n]}</b>
                    <Glyph kind={c.scene} size={16} />
                    <small>{deg(l)}</small>
                    <span className="gw-range"><i style={{ left: `${((l - lo) / (hi - lo)) * 100}%`, right: `${100 - ((h - lo) / (hi - lo)) * 100}%` }} /></span>
                    <b>{deg(h)}</b>
                  </div>
                ))}
              </div>
            )}
            {tab === 2 && (
              <div className="gw-radar">
                <div className="gw-scope">
                  <div className="gw-sweep" />
                  {c.scene !== 'night' && c.scene !== 'sun' && <><i className="gw-blip" style={{ left: '30%', top: '36%' }} /><i className="gw-blip" style={{ left: '58%', top: '60%', width: 28 }} /></>}
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
