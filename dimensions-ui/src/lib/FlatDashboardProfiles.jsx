import { useState } from 'react'

// Flat UI profile dashboard: icon rail, slim top bar, a 2x3 grid of chart
// widgets (step pins, bars with selects, overlapping areas, year bars, a dotted
// area chart, donuts) and a scrolling column of rated profile cards.
// Solid fills only: no gradients or shadows.

const RAIL = [
  'M3 15l5-6 3 3 6-8M3 3v13h14',
  'M10 2l7 4v8l-7 4-7-4V6zM3 6l7 4 7-4M10 10v8',
  'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12.5 7.5c-.5-1-1.4-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.5-2.5-1.5M10 4.5v11',
  'M2 5h16v10H2zM2 9h16M5 12h3',
  'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8',
]

const PINS = [[87, 'blue'], [76, 'cyan'], [54, 'purple'], [37, 'pink'], [18, 'red'], [9, 'orange']]
const COLS = [[760, 70], [400, 36], [850, 82], [410, 40], [780, 74], [760, 66]]
const AREAS = [
  [20, 35, 30, 55, 45, 60, 70, 50, 62, 40],
  [10, 25, 40, 30, 75, 20, 45, 55, 40, 30],
]
const YEARS = [
  ['2019', [[88, 'blue'], [70, 'blue2']]],
  ['2018', [[0, 'blue'], [0, 'blue']]],
  ['2017', [[46, 'pink'], [66, 'purple']]],
  ['2016', [[0, 'blue'], [0, 'blue']]],
  ['2015', [[44, 'red'], [74, 'orange'], [52, 'orange2']]],
]
const WAVE = [{ x: 0, y: 30 }, { x: 1, y: 52 }, { x: 2, y: 82 }, { x: 3, y: 50 }, { x: 4, y: 86 }, { x: 5, y: 40 }, { x: 6, y: 58 }]
const WAVE_B = [10, 30, 45, 20, 50, 25, 30]
const DAYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa']
const DONUTS = [45, 51, 64, 75]
const PEOPLE = [
  ['Lorem Ipsum', 'Los Angeles', '4.7', 'lime', 'm'],
  ['Lorem Ipsum', 'Los Angeles', '4.8', 'orange', 'f'],
  ['Lorem Ipsum', 'Los Angeles', '5.0', 'purple', 'm'],
  ['Lorem Ipsum', 'Los Angeles', '4.7', 'cyan', 'f'],
  ['Dolor Amet', 'San Diego', '4.6', 'pink', 'm'],
  ['Sit Consect', 'Seattle', '4.9', 'blue', 'f'],
]

const Icon = ({ d, size = 18, sw = 1.6 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const Lorem = ({ children = 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed nonummy' }) => <p className="fx-lorem">{children}</p>

const poly = (arr, w, h, max = 100) => arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - (v / max) * h}`).join(' ')

const smooth = (arr, w, h, max = 100) => {
  const step = w / (arr.length - 1)
  const y = (v) => h - (v / max) * h
  let d = `M0 ${y(arr[0])}`
  arr.slice(1).forEach((v, i) => {
    const mx = (i + 0.5) * step
    d += ` C${mx} ${y(arr[i])} ${mx} ${y(v)} ${(i + 1) * step} ${y(v)}`
  })
  return d
}

function Avatar({ hair, kind }) {
  return (
    <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="#fff" stroke="#dfe3e8" />
      <path d="M8 36c1-7 6-10 12-10s11 3 12 10" fill={hair} />
      <circle cx="20" cy="17" r="7" fill="#fbd9bf" />
      {kind === 'f'
        ? <path d="M12 19c0-8 3-11 8-11s8 3 8 11c-2-4-5-6-8-6s-6 2-8 6z" fill="#3a2a22" />
        : <path d="M13 15c0-5 3-7 7-7s7 2 7 7c-2-2-4-3-7-3s-5 1-7 3z" fill="#3a2a22" />}
    </svg>
  )
}

export default function FlatDashboardProfiles({
  blue = '#1aa3e0',
  lime = '#9ccc3a',
  pink = '#e8458b',
  purple = '#8e5bb5',
  orange = '#ff8a1c',
  radius = 6,
  style,
}) {
  const [nav, setNav] = useState(2)
  const [series, setSeries] = useState(0)
  const [first, setFirst] = useState(0)
  const col = { blue, lime, pink, purple, orange, cyan: '#15b5d4', red: '#f2386b', blue2: '#4e7fd0', orange2: '#ffb347' }
  const shown = 4
  const maxFirst = PEOPLE.length - shown

  return (
    <div className="fx-wrap" style={{ '--blue': blue, '--lime': lime, '--pink': pink, '--purple': purple, '--orange': orange, '--r': `${radius}px`, ...style }}>
      <div className="fx">
      <style>{`
        .fx-wrap { container-type: inline-size; width: 100%; height: 100%; }
        .fx { display: grid; grid-template-columns: 64px minmax(0, 1fr); grid-template-rows: 56px minmax(0, 1fr); width: 100%; height: 100%; background: #eef1f4; color: #33373f; font: 400 11px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; overflow: hidden; }
        .fx * { box-sizing: border-box; }
        .fx button, .fx select { font: inherit; }
        .fx button { border: 0; cursor: pointer; }
        .fx-burger { background: #fff; display: grid; place-items: center; color: #3b3f47; border-right: 1px solid #eef1f4; }
        .fx-rail { background: #fff; display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 14px; }
        .fx-rail button { position: relative; width: 100%; height: 48px; background: transparent; color: #8f949c; display: grid; place-items: center; }
        .fx-rail button:hover { color: #3b3f47; }
        .fx-rail button[aria-current='page'] { color: var(--blue); }
        .fx-rail button[aria-current='page']::after { content: ''; position: absolute; right: 0; top: 8px; bottom: 8px; width: 3px; background: var(--blue); }
        .fx-top { background: #fff; display: flex; align-items: center; gap: 16px; padding: 0 18px 0 22px; min-width: 0; }
        .fx-logo { width: 26px; height: 26px; border: 1.5px solid #cfd4da; border-radius: 4px; display: grid; place-items: center; font-weight: 800; font-size: 12px; color: #3b3f47; }
        .fx-cta { margin-left: auto; background: var(--blue); color: #fff; padding: 7px 36px; border-radius: 99px; font-weight: 500; font-size: 12px; }
        .fx-cta:hover { background: color-mix(in srgb, var(--blue), black 12%); }
        .fx-icons { display: flex; align-items: center; gap: 20px; padding: 0 22px; margin-left: 18px; border-left: 1px solid #eef1f4; border-right: 1px solid #eef1f4; height: 100%; color: #b4b9c1; }
        .fx-bell { position: relative; }
        .fx-bell b { position: absolute; top: -6px; right: -7px; min-width: 13px; height: 13px; border-radius: 99px; background: var(--blue); color: #fff; font-size: 8px; display: grid; place-items: center; }
        .fx-user { display: flex; align-items: center; gap: 10px; font-size: 14px; white-space: nowrap; }
        .fx-body { display: grid; grid-template-columns: minmax(0, 1fr) 200px; gap: 18px; padding: 18px; min-height: 0; min-width: 0; }
        .fx-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 18px; min-height: 0; min-width: 0; }
        .fx-c { background: #fff; border-radius: var(--r); padding: 12px 14px; min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
        .fx-lorem { margin: 0; font-size: 7px; line-height: 1.5; color: #4b4f57; }
        .fx-h { margin: 0 0 8px; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; color: #33373f; }
        .fx-chart { flex: 1; min-height: 0; width: 100%; }
        .fx-ax { display: flex; justify-content: space-between; font-size: 7px; font-weight: 700; color: #33373f; }

        .fx-pins { position: relative; display: flex; justify-content: space-between; padding: 0 10px; margin: 4px 0 14px; }
        .fx-pins::before { content: ''; position: absolute; left: 10px; right: 10px; bottom: 4px; height: 2px; background: #d6dbe1; }
        .fx-pin { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .fx-pin span { color: #fff; font-size: 7.5px; font-weight: 700; padding: 2px 4px; border-radius: 2px; position: relative; }
        .fx-pin span::after { content: ''; position: absolute; left: 50%; bottom: -4px; border: 4px solid transparent; border-bottom: 0; border-top-color: inherit; transform: translateX(-50%); }
        .fx-pin i { width: 9px; height: 9px; border-radius: 50%; background: #fff; border: 2.5px solid; }
        .fx-gears { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .fx-gears > div { display: flex; gap: 8px; align-items: flex-start; color: #b4b9c1; }

        .fx-bars { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; flex: 1; min-height: 0; }
        .fx-colw { display: flex; flex-direction: column; min-height: 0; }
        .fx-cols { flex: 1; display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; align-items: end; min-height: 0; }
        .fx-col { height: 100%; background: #dfe3e8; display: flex; align-items: flex-end; }
        .fx-col i { width: 100%; background: var(--blue); display: block; transition: height 300ms; }
        .fx-sels { display: grid; gap: 10px; align-content: center; }
        .fx-sels select { appearance: none; -webkit-appearance: none; width: 100%; border: 1.5px solid var(--lime); border-radius: 3px; padding: 6px 22px 6px 8px; font-size: 10px; color: #33373f; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M0 0h10L5 6z' fill='%2333373f'/%3E%3C/svg%3E") no-repeat right 8px center / 8px 5px; cursor: pointer; }

        .fx-radios { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px; }
        .fx-radio { display: flex; gap: 8px; align-items: flex-start; background: transparent; text-align: left; padding: 0; }
        .fx-radio i { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid #c4c9d0; flex: none; display: grid; place-items: center; }
        .fx-radio[aria-checked='true'] i { border-color: var(--blue); }
        .fx-radio[aria-checked='true'] i::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--blue); }

        .fx-years { display: grid; gap: 4px; flex: 1; align-content: space-evenly; }
        .fx-yr { display: grid; grid-template-columns: 26px 1fr; gap: 8px; align-items: center; font-size: 8px; color: #33373f; }
        .fx-yr > div { border-top: 1px solid #e3e6ea; display: grid; gap: 1px; padding-top: 2px; min-height: 10px; }
        .fx-yr i { display: block; height: 4px; }

        .fx-steps { display: grid; grid-template-columns: 1.1fr 1fr; gap: 12px; flex: 1; min-height: 0; align-items: center; }
        .fx-list { display: grid; gap: 8px; }
        .fx-list > div { display: flex; gap: 10px; align-items: center; }
        .fx-dia { width: 16px; height: 16px; background: var(--lime); transform: rotate(45deg); display: grid; place-items: center; flex: none; margin: 0 4px; }
        .fx-dia b { transform: rotate(-45deg); color: #fff; font-size: 8px; }
        .fx-dgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; justify-items: center; }

        .fx-people { display: flex; flex-direction: column; gap: 14px; min-height: 0; position: relative; }
        .fx-arrow { position: absolute; left: 50%; transform: translateX(-50%); width: 36px; height: 36px; border-radius: 50%; background: #fff; color: #9097a1; display: grid; place-items: center; z-index: 1; border: 1px solid #e3e6ea; }
        .fx-arrow:disabled { opacity: .45; cursor: default; }
        .fx-arrow.up { top: -14px; }
        .fx-arrow.down { bottom: -14px; }
        .fx-person { background: #fff; border-radius: var(--r); padding: 10px 12px; flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; }
        .fx-person .fx-h { margin-bottom: 6px; }
        .fx-prow { display: flex; align-items: center; gap: 10px; }
        .fx-prow strong { display: block; font-size: 10px; font-weight: 700; }
        .fx-prow small { display: block; font-size: 8px; color: #6d727b; }
        .fx-loc { display: flex; align-items: center; gap: 3px; font-size: 7.5px; color: #6d727b; margin-top: 2px; }
        .fx-loc svg { color: var(--lime); }
        .fx-rate { margin-left: auto; text-align: center; }
        .fx-rate b { display: block; font-size: 17px; font-weight: 600; }

        @container (max-width: 1000px) {
          .fx-body { grid-template-columns: 1fr; }
          .fx-people { display: none; }
        }
        @container (max-width: 760px) {
          .fx-grid { grid-template-columns: 1fr; grid-template-rows: none; grid-auto-rows: 180px; overflow: auto; }
          .fx-icons { display: none; }
        }
        @container (max-width: 520px) {
          .fx { grid-template-columns: 1fr; }
          .fx-burger, .fx-rail { display: none; }
          .fx-body { padding: 12px; }
          .fx-user span { display: none; }
        }
      `}</style>

      <button className="fx-burger" aria-label="Menu"><Icon d="M3 5h14M3 10h14M3 15h14" size={22} /></button>

      <header className="fx-top">
        <div className="fx-logo">L</div>
        <button className="fx-cta">Button</button>
        <div className="fx-icons">
          <Icon d="M2 5h16v11H2zM2 5l8 6 8-6" />
          <span className="fx-bell"><Icon d="M5 14V9a5 5 0 0 1 10 0v5l1.5 2h-13zM8.5 18h3" /><b>3</b></span>
        </div>
        <div className="fx-user"><Avatar hair="#cfd4da" kind="m" /><span>Lorem Ipsum ▾</span></div>
      </header>

      <nav className="fx-rail" aria-label="Sections">
        {RAIL.map((d, i) => (
          <button key={i} aria-current={i === nav ? 'page' : undefined} onClick={() => setNav(i)}><Icon d={d} size={22} /></button>
        ))}
      </nav>

      <div className="fx-body">
        <div className="fx-grid">
          {/* 1. percentage pins on a line */}
          <section className="fx-c">
            <div className="fx-pins">
              {PINS.map(([v, c]) => (
                <div key={v} className="fx-pin">
                  <span style={{ background: col[c], borderColor: col[c] }}>{v}%</span>
                  <i style={{ borderColor: col[c] }} />
                </div>
              ))}
            </div>
            <div className="fx-gears">
              {[0, 1].map((i) => (
                <div key={i}>
                  <Icon d="M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8" size={20} />
                  <Lorem>Lorem ipsum dolor sit amet, consectetuer lorem sit</Lorem>
                </div>
              ))}
            </div>
          </section>

          {/* 2. column bars with selects */}
          <section className="fx-c">
            <div className="fx-bars">
              <div className="fx-colw">
                <div className="fx-cols">
                  {COLS.map(([n, h]) => <div key={n + '' + h} className="fx-col"><i style={{ height: `${h}%` }} /></div>)}
                </div>
                <div className="fx-ax" style={{ fontWeight: 400, fontSize: 7, marginTop: 4, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', textAlign: 'center' }}>
                  {COLS.map(([n], i) => <span key={i}>{n}</span>)}
                </div>
              </div>
              <div className="fx-sels">
                <select aria-label="Filter one" defaultValue="a"><option value="a">Lorem ipsum</option><option>Dolor sit</option><option>Amet</option></select>
                <select aria-label="Filter two" defaultValue="a"><option value="a">Lorem ipsum</option><option>Consectetur</option><option>Elit</option></select>
              </div>
            </div>
          </section>

          {/* 3. overlapping areas on a grid */}
          <section className="fx-c">
            <div className="fx-radios" role="radiogroup">
              {[0, 1].map((i) => (
                <button key={i} role="radio" className="fx-radio" aria-checked={series === i} onClick={() => setSeries(i)}>
                  <i /><Lorem />
                </button>
              ))}
            </div>
            <div className="fx-ax">{[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((n) => <span key={n}>{n}</span>)}</div>
            <svg className="fx-chart" viewBox="0 0 300 80" preserveAspectRatio="none" role="img" aria-label="Two overlapping area series">
              {Array.from({ length: 10 }, (_, i) => <line key={`v${i}`} x1={i * 33.3} x2={i * 33.3} y1="0" y2="80" stroke="#e3e6ea" vectorEffect="non-scaling-stroke" />)}
              {Array.from({ length: 4 }, (_, i) => <line key={`h${i}`} x1="0" x2="300" y1={i * 26.7} y2={i * 26.7} stroke="#e3e6ea" vectorEffect="non-scaling-stroke" />)}
              {[0, 1].map((k) => {
                const c = k ? lime : blue
                const on = k === series
                return (
                  <g key={k}>
                    <polygon points={`0,80 ${poly(AREAS[k], 300, 80)} 300,80`} fill={c} opacity={on ? 0.45 : 0.18} />
                    <polyline points={poly(AREAS[k], 300, 80)} fill="none" stroke={c} strokeWidth={on ? 2 : 1.3} vectorEffect="non-scaling-stroke" />
                  </g>
                )
              })}
            </svg>
          </section>

          {/* 4. bars by year */}
          <section className="fx-c">
            <h3 className="fx-h">Lorem ipsum dolor sit amet</h3>
            <div className="fx-years">
              {YEARS.map(([y, bars]) => (
                <div key={y} className="fx-yr">
                  <span>{y}</span>
                  <div>{bars.filter(([w]) => w).map(([w, c], i) => <i key={i} style={{ width: `${w}%`, background: col[c] }} />)}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. dotted smooth area chart */}
          <section className="fx-c">
            <h3 className="fx-h" style={{ textAlign: 'center' }}>Lorem ipsum dolor sit amet</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 6, flex: 1, minHeight: 0 }}>
              <div className="fx-ax" style={{ flexDirection: 'column', fontWeight: 400, fontSize: 7 }}>{[400, 300, 200, 100, 0].map((n) => <span key={n}>{n}</span>)}</div>
              <svg className="fx-chart" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="Weekly area chart">
                <path d={`${smooth(WAVE_B, 300, 100)} L300 100 L0 100 Z`} fill={purple} opacity=".35" />
                <path d={`${smooth(WAVE.map((p) => p.y), 300, 100)} L300 100 L0 100 Z`} fill={pink} opacity=".3" />
                <path d={smooth(WAVE.map((p) => p.y), 300, 100)} fill="none" stroke={pink} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className="fx-ax" style={{ fontWeight: 400, fontSize: 7.5, color: '#6d727b', paddingLeft: 26, marginTop: 4 }}>
              {DAYS.map((d) => <span key={d} style={d === 'th' ? { fontWeight: 800, color: '#33373f' } : undefined}>{d}</span>)}
            </div>
          </section>

          {/* 6. numbered list with donuts */}
          <section className="fx-c">
            <div className="fx-steps">
              <div className="fx-list">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n}><span className="fx-dia"><b>{n}</b></span><Lorem>Lorem ipsum dolor sit amet, consectetuer adipiscing</Lorem></div>
                ))}
              </div>
              <div className="fx-dgrid">
                {DONUTS.map((v, i) => {
                  const r = 20, c = 2 * Math.PI * r
                  const parts = [[v, blue], [18, pink], [100 - v - 18, i % 2 ? purple : lime]]
                  let off = 0
                  return (
                    <div key={v} style={{ position: 'relative', width: 52, height: 52 }}>
                      <svg viewBox="0 0 52 52" width="52" height="52" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
                        {parts.map(([p, color], k) => {
                          const len = (p / 100) * c
                          const el = <circle key={k} cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="7" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />
                          off += len
                          return el
                        })}
                      </svg>
                      <b style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 10 }}>{v}%</b>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>

        {/* profile cards with up / down paging */}
        <aside className="fx-people" aria-label="Team">
          <button className="fx-arrow up" aria-label="Previous" disabled={first === 0} onClick={() => setFirst((f) => Math.max(0, f - 1))}><Icon d="M5 12l5-5 5 5" sw={2} /></button>
          {PEOPLE.slice(first, first + shown).map(([name, city, rate, c, kind], i) => (
            <div key={first + i} className="fx-person">
              <h3 className="fx-h">Lorem ipsum dolor sit amet</h3>
              <div className="fx-prow">
                <Avatar hair={col[c]} kind={kind} />
                <div style={{ minWidth: 0 }}>
                  <strong>{name}</strong>
                  <small>Manager</small>
                  <span className="fx-loc"><Icon d="M10 18s6-5.5 6-10a6 6 0 0 0-12 0c0 4.5 6 10 6 10zM10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" size={9} sw={2} />{city}</span>
                </div>
                <div className="fx-rate">
                  <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.8z" fill="#f6a623" /></svg>
                  <b>{rate}</b>
                </div>
              </div>
            </div>
          ))}
          <button className="fx-arrow down" aria-label="Next" disabled={first >= maxFirst} onClick={() => setFirst((f) => Math.min(maxFirst, f + 1))}><Icon d="M5 8l5 5 5-5" sw={2} /></button>
        </aside>
      </div>
      </div>
    </div>
  )
}
