import { useState } from 'react'

// Flat UI panel dashboard: white top bar with tabs, a text sidebar, solid colour
// KPI tiles (orange / blue / green / purple), gauge, bar and area charts, and a
// calendar rail with an event card. Solid fills only: no gradients or shadows.

const TABS = [
  ['Lorem', 'M10 3l7 4-7 4-7-4zM3 11l7 4 7-4'],
  ['Ipsum', 'M4 12V9a6 6 0 0 1 12 0v3M3 12h3v5H3zM14 12h3v5h-3z'],
  ['Dolor', 'M3 4h14v12H3zM3 8h14M8 8v8'],
  ['Tempor', 'M2 10h4l2-5 3 10 2-5h5'],
  ['Minim', 'M3 16l5-6 3 3 6-8M3 3v13h14'],
]

const SIDE = ['Consectetur', 'Adipiscing', 'Incididunt', 'Exercitation', 'Reprehenderit']

const KPIS = [
  ['Elit', '8,000', 'orange'],
  ['Amet', '7,230', 'blue'],
  ['Enim', '3,080', 'green'],
  ['Sunt', '9,500', 'purple'],
]

const GAUGES = [
  ['Duis', 77, 'Ullamco', 'orange'],
  ['Enim', 29, 'Laboris', 'blue'],
  ['Nisi', 86, 'Commodo', 'green'],
]

const BARS = [['Jan', 8], ['Feb', 5], ['Mar', 6], ['Apr', 9], ['May', 8], ['Jun', 5]]

const AREA = [30, 55, 90, 50, 62, 40, 78, 48, 70, 35, 46, 28]
const AREA_X = ['Elit', 'Amet', 'Nisi', 'Enim', 'Esse', 'Sunt', 'Duis']

const HBARS = [['Lorem', 28.5, 58], ['Ipsum', 36.7, 74], ['Dolor', 11.4, 42], ['Irure', 56.9, 92], ['Minim', 41.2, 82]]
const MINI = [['Magna', 25], ['Nulla', 46], ['Dulre', 82]]
const RINGS = [85, 71, 68]

const Icon = ({ d, size = 18 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

function Gauge({ value, color, size = 74, stroke = 7, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eceef4" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`} />
      </svg>
      <div className="fp-gv">{children}</div>
    </div>
  )
}

const areaPath = (pts, w, h) => {
  const step = w / (pts.length - 1)
  const y = (v) => h - (v / 100) * h
  let d = `M0 ${y(pts[0])}`
  pts.slice(1).forEach((v, i) => {
    const x0 = i * step, x1 = (i + 1) * step, mx = (x0 + x1) / 2
    d += ` C${mx} ${y(pts[i])} ${mx} ${y(v)} ${x1} ${y(v)}`
  })
  return d
}

const CAL = [
  [26, 27, 28, 29, 30, 1, 2],
  [3, 4, 5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14, 15, 16],
  [17, 18, 19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28, 29, 30],
  [31, 1, 2, 3, 4, 5, 6],
]

export default function FlatDashboardPanels({
  orange = '#f5a04a',
  blue = '#5aa9d6',
  green = '#4cb98a',
  purple = '#8a58b0',
  radius = 6,
  style,
}) {
  const [tab, setTab] = useState(0)
  const [side, setSide] = useState(2)
  const [picked, setPicked] = useState(30)
  const col = { orange, blue, green, purple }
  const W = 300, H = 90

  return (
    <div className="fp-wrap" style={{ '--orange': orange, '--blue': blue, '--green': green, '--purple': purple, '--r': `${radius}px`, ...style }}>
      <div className="fp">
      <style>{`
        .fp-wrap { container-type: inline-size; width: 100%; height: 100%; }
        .fp { display: grid; grid-template-rows: 56px minmax(0, 1fr); width: 100%; height: 100%; background: #eceef4; color: #3a4056; font: 400 11px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; overflow: hidden; }
        .fp * { box-sizing: border-box; }
        .fp button { font: inherit; border: 0; cursor: pointer; }
        .fp-bar { background: #fff; display: flex; align-items: center; gap: 28px; padding: 0 18px; min-width: 0; }
        .fp-user { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 15px; letter-spacing: .04em; text-transform: uppercase; color: #2a2f45; flex: none; }
        .fp-hex { width: 30px; height: 30px; background: var(--purple); color: #fff; display: grid; place-items: center; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
        .fp-tabs { display: flex; gap: 22px; flex: 1; min-width: 0; }
        .fp-tab { background: transparent; color: #7b8196; display: flex; align-items: center; gap: 8px; text-transform: uppercase; font-size: 10px; font-weight: 600; letter-spacing: .06em; padding: 6px 0; border-bottom: 2px solid transparent; }
        .fp-tab[aria-selected='true'] { color: var(--purple); border-bottom-color: var(--purple); }
        .fp-acts { display: flex; gap: 16px; color: #a7adbf; flex: none; }
        .fp-body { display: grid; grid-template-columns: 170px minmax(0, 1fr) 220px; gap: 0; min-height: 0; }
        .fp-side { background: #fff; padding: 18px 0 0 18px; display: flex; flex-direction: column; margin: 4px 0 0; min-height: 0; }
        .fp-side h2 { margin: 0 0 20px; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; display: flex; align-items: center; gap: 10px; color: #2a2f45; }
        .fp-side h2 svg { color: var(--purple); }
        .fp-item { background: transparent; text-align: left; padding: 11px 0; color: #4a5068; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #eef0f5; }
        .fp-item[aria-current='true'] { background: #f1e6f6; color: var(--purple); padding-left: 8px; margin-left: -8px; }
        .fp-add { color: var(--purple); background: transparent; text-align: left; padding: 11px 0; font-size: 9.5px; font-weight: 700; text-transform: uppercase; }
        .fp-main { padding: 14px; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto 1fr 1fr; gap: 14px; min-height: 0; min-width: 0; }
        .fp-kpis { grid-column: 1 / 3; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .fp-kpi { color: #fff; border-radius: var(--r); padding: 12px 14px 14px; min-width: 0; }
        .fp-kpi small { display: flex; justify-content: space-between; align-items: center; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
        .fp-kpi small i { width: 16px; height: 16px; background: rgba(255,255,255,.9); border-radius: 3px; display: grid; place-items: center; }
        .fp-kpi div { font-size: 20px; font-weight: 700; margin-top: 6px; display: flex; align-items: center; gap: 12px; }
        .fp-kpi div span { font-weight: 300; opacity: .85; }
        .fp-card { background: #fff; border-radius: var(--r); padding: 12px 14px; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; }
        .fp-h { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #2a2f45; margin: 0 0 10px; display: flex; justify-content: space-between; align-items: center; }
        .fp-h svg { color: #c4c9d8; }
        .fp-gauges { display: flex; justify-content: space-around; align-items: flex-start; flex: 1; min-height: 0; }
        .fp-g { text-align: center; }
        .fp-g h5 { margin: 8px 0 3px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #2a2f45; }
        .fp-g p { margin: 0 auto; max-width: 84px; font-size: 6.5px; line-height: 1.5; color: #b3b8c8; }
        .fp-gv { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
        .fp-gv b { font-size: 19px; font-weight: 500; line-height: 1; color: #2a2f45; }
        .fp-gv span { font-size: 6px; text-transform: uppercase; color: #a7adbf; letter-spacing: .04em; margin-top: 2px; }
        .fp-legend { display: flex; gap: 24px; font-size: 7px; text-transform: uppercase; color: #a7adbf; margin-bottom: 4px; }
        .fp-legend b { display: block; font-size: 11px; font-weight: 500; color: #3a4056; letter-spacing: 0; }
        .fp-cols { flex: 1; display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; align-items: end; min-height: 40px; }
        .fp-col { display: flex; flex-direction: column-reverse; gap: 3px; justify-content: flex-start; height: 100%; }
        .fp-col i { height: 4px; border-radius: 1px; display: block; flex: none; }
        .fp-xl { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; text-align: center; font-size: 7px; color: #a7adbf; margin-top: 6px; text-transform: uppercase; }
        .fp-area { flex: 1; min-height: 0; width: 100%; }
        .fp-rings { display: flex; justify-content: space-around; margin-top: 8px; flex: none; }
        .fp-hb { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
        .fp-hb li { display: grid; grid-template-columns: 46px 1fr 30px; gap: 8px; align-items: center; font-size: 8px; text-transform: uppercase; letter-spacing: .04em; }
        .fp-hb li > i { height: 5px; background: #eceef4; border-radius: 3px; display: block; }
        .fp-hb li > i b { display: block; height: 100%; background: var(--purple); border-radius: 3px; }
        .fp-hb li > span:last-child { text-align: right; color: #7b8196; }
        .fp-mini { display: flex; justify-content: space-around; margin-top: auto; padding-top: 8px; }
        .fp-mini div { text-align: center; font-size: 6.5px; text-transform: uppercase; color: #8a90a4; }
        .fp-mini b { font-size: 9px; font-weight: 600; color: #3a4056; }
        .fp-rail { display: flex; flex-direction: column; min-height: 0; background: #fff; margin-top: 4px; }
        .fp-cal { padding: 16px 18px 12px; flex: 1.7; min-height: 0; overflow: hidden; }
        .fp-cal header { display: flex; justify-content: space-between; align-items: flex-start; }
        .fp-cal h3 { margin: 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #2a2f45; }
        .fp-cal small { font-size: 7px; color: #a7adbf; text-transform: uppercase; }
        .fp-sq { width: 24px; height: 24px; border-radius: 4px; background: var(--green); display: grid; place-items: center; color: #fff; }
        .fp-mon { display: flex; justify-content: space-between; align-items: center; color: #b3b8c8; font-weight: 700; font-size: 9px; letter-spacing: .06em; margin: 10px 8px 6px; }
        .fp-mon b { color: #2a2f45; }
        .fp-cg { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 5px; text-align: center; font-size: 8.5px; }
        .fp-cg .h { font-size: 6.5px; text-transform: uppercase; color: #8a90a4; margin-bottom: 4px; }
        .fp-d { background: transparent; color: #2a2f45; padding: 3px 0; font-size: 8.5px; font-weight: 600; }
        .fp-d.o { color: #cfd3df; }
        .fp-d.w { background: var(--orange); color: #fff; }
        .fp-d.w.s { border-radius: 99px 0 0 99px; }
        .fp-d.w.e { border-radius: 0 99px 99px 0; }
        .fp-d.p { background: var(--blue); color: #fff; border-radius: 50%; }
        .fp-ev { background: var(--blue); color: #fff; padding: 14px 18px; flex: 1; }
        .fp-ev small { display: block; font-size: 7.5px; text-transform: uppercase; opacity: .9; }
        .fp-ev strong { display: block; font-size: 20px; font-weight: 500; margin: 6px 0 2px; color: #1f3a4d; }
        .fp-btn { background: var(--purple); color: #fff; border-radius: 99px; padding: 7px 0; width: 100%; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
        .fp-btn:hover { background: color-mix(in srgb, var(--purple), black 14%); }
        .fp-ev .fp-btn { margin-top: 14px; background: #7a5aa6; }
        .fp-new { background: var(--green); color: #fff; padding: 14px 18px; flex: 1; text-align: center; display: flex; flex-direction: column; justify-content: space-between; }
        .fp-new small { display: flex; justify-content: space-between; font-size: 7.5px; text-transform: uppercase; opacity: .9; }
        .fp-new strong { font-size: 17px; font-weight: 700; text-transform: uppercase; }

        @container (max-width: 1100px) {
          .fp-body { grid-template-columns: 170px minmax(0, 1fr); }
          .fp-rail { display: none; }
        }
        @container (max-width: 800px) {
          .fp-body { grid-template-columns: 1fr; }
          .fp-side { display: none; }
          .fp-tabs { gap: 12px; }
          .fp-tab span { display: none; }
          .fp-main { grid-template-columns: 1fr; grid-template-rows: auto; grid-auto-rows: minmax(150px, auto); overflow: auto; }
          .fp-kpis { grid-column: 1; grid-template-columns: repeat(2, 1fr); }
        }
        @container (max-width: 520px) {
          .fp-user span { display: none; }
          .fp-acts { display: none; }
        }
      `}</style>

      <header className="fp-bar">
        <div className="fp-user">
          <div className="fp-hex"><Icon d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c0-3.3 2.7-5 6-5s6 1.7 6 5" size={16} /></div>
          <span>John Smith</span>
        </div>
        <div className="fp-tabs" role="tablist">
          {TABS.map(([label, d], i) => (
            <button key={label} role="tab" className="fp-tab" aria-selected={i === tab} onClick={() => setTab(i)}>
              <Icon d={d} size={16} /><span>{label}</span>
            </button>
          ))}
        </div>
        <div className="fp-acts">
          <Icon d="M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12zM14 14l4 4" />
          <Icon d="M5 14V9a5 5 0 0 1 10 0v5l1.5 2h-13zM8.5 18h3" />
          <Icon d="M2 5h16v11H2zM2 5l8 6 8-6" />
        </div>
      </header>

      <div className="fp-body">
        <aside className="fp-side">
          <h2><Icon d="M3 4h14v12H3zM3 8h14M8 8v8" size={20} />Dolor</h2>
          {SIDE.map((s, i) => (
            <button key={s} className="fp-item" aria-current={i === side} onClick={() => setSide(i)}>{s}</button>
          ))}
          <button className="fp-add">+ Add</button>
        </aside>

        <main className="fp-main">
          <section className="fp-kpis">
            {KPIS.map(([label, val, c]) => (
              <div key={label} className="fp-kpi" style={{ background: col[c] }}>
                <small>{label}<i><Icon d="M10 15V5M6 9l4-4 4 4" size={10} /></i></small>
                <div><span>$</span>{val}</div>
              </div>
            ))}
          </section>

          <section className="fp-card">
            <h3 className="fp-h">Labore dolore <Icon d="M4 6h12M4 10h12M4 14h12" size={12} /></h3>
            <div className="fp-gauges">
              {GAUGES.map(([name, v, sub, c]) => (
                <div key={name} className="fp-g">
                  <Gauge value={v} color={col[c]} size={72}><b>{v}</b><span>{sub}</span></Gauge>
                  <h5>{name}</h5>
                  <p>Ut labore et dolore magna aliqua ullamco laboris nisi ut aliquip.</p>
                </div>
              ))}
            </div>
          </section>

          <section className="fp-card">
            <h3 className="fp-h">Magna aliqua <Icon d="M4 4h12v12H4z" size={12} /></h3>
            <div className="fp-legend">
              <div><span style={{ color: 'var(--orange)' }}>▼</span> Ullamco laboris<b>52602</b></div>
              <div><span style={{ color: 'var(--green)' }}>▲</span> Minim veniam<b>63175</b></div>
            </div>
            <div className="fp-cols">
              {BARS.map(([m, n], i) => (
                <div key={m} className="fp-col">
                  {Array.from({ length: n }, (_, k) => <i key={k} style={{ background: i % 2 ? 'var(--purple)' : 'var(--green)' }} />)}
                </div>
              ))}
            </div>
            <div className="fp-xl">{BARS.map(([m]) => <span key={m}>{m}</span>)}</div>
          </section>

          <section className="fp-card">
            <h3 className="fp-h">Velit esse <Icon d="M3 16l5-6 3 3 6-8" size={12} /></h3>
            <svg className="fp-area" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Trend">
              {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="0" x2={W} y1={(H / 4) * i} y2={(H / 4) * i} stroke="#eceef4" vectorEffect="non-scaling-stroke" />)}
              <path d={`${areaPath(AREA, W, H)} L${W} ${H} L0 ${H} Z`} fill="var(--orange)" opacity=".75" />
            </svg>
            <div className="fp-xl" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>{AREA_X.map((m) => <span key={m}>{m}</span>)}</div>
            <div className="fp-rings">
              {RINGS.map((v, i) => (
                <Gauge key={i} value={v} color="var(--orange)" size={44} stroke={4}><b style={{ fontSize: 10 }}>{v}</b></Gauge>
              ))}
            </div>
          </section>

          <section className="fp-card">
            <h3 className="fp-h">Lorem ipsum <Icon d="M10 3l2 5 5 .5-4 3.5 1.2 5L10 14l-4.2 3L7 12 3 8.5 8 8z" size={12} /></h3>
            <ul className="fp-hb">
              {HBARS.map(([n, v, w]) => (
                <li key={n}><span>{n}</span><i><b style={{ width: `${w}%` }} /></i><span>{v}%</span></li>
              ))}
            </ul>
            <div className="fp-mini">
              {MINI.map(([n, v]) => (
                <div key={n}>
                  <Gauge value={v} color="var(--purple)" size={40} stroke={4}><b style={{ fontSize: 8 }}>{v}%</b></Gauge>
                  <div style={{ marginTop: 4 }}>{n}</div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="fp-rail">
          <div className="fp-cal">
            <header>
              <div><h3>Calendar</h3><small>05 Mar, 2020</small></div>
              <div className="fp-sq"><Icon d="M4 4h12v12H4zM8 4v12" size={12} /></div>
            </header>
            <div className="fp-mon"><span>‹</span><b>MAY</b><span>›</span></div>
            <div className="fp-cg">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <span key={d} className="h">{d}</span>)}
              {CAL.flatMap((row, r) => row.map((n, c) => {
                const other = (r === 0 && n > 20) || (r >= 4 && n < 10) || (r === 5 && n < 10)
                const week = r === 3 && c <= 4
                const sel = !other && n === picked
                return (
                  <button key={`${r}-${c}`}
                    className={`fp-d${other ? ' o' : ''}${week ? ' w' : ''}${week && c === 0 ? ' s' : ''}${week && c === 4 ? ' e' : ''}${sel && !week ? ' p' : ''}`}
                    onClick={() => !other && setPicked(n)}>{n}</button>
                )
              }))}
            </div>
          </div>
          <div className="fp-ev">
            <small>Saturday, 23</small>
            <strong>18:00 AM</strong>
            <small>18:3V0 AM</small>
            <button className="fp-btn">Send message to mom</button>
          </div>
          <div className="fp-new">
            <small><span>Monday, 25</span><span>+</span></small>
            <strong>New event</strong>
            <button className="fp-btn">Add</button>
          </div>
        </aside>
      </div>
      </div>
    </div>
  )
}
