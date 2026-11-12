import { useState } from 'react'

// Minimal sales dashboard: greyscale, hairline borders, one dark action and
// small green/red deltas as the only colour. Sidebar with grouped nav and
// badges; KPI cards; a segmented gauge for channels; revenue vs target with
// a hover tooltip; hatched bars for top products; a visitor heatmap; and
// recent activity. The period menu re-flows every number.

const PERIODS = {
  'Last week': { k: 0.25, trend: [14, 16, 15, 19, 21, 18, 20], target: [17, 18, 18, 19, 20, 20, 21] },
  'Last month': { k: 1, trend: [18.5, 13.5, 16.5, 17, 22.5, 19.5, 17, 11], target: [17, 19.5, 20.5, 20, 22, 21, 21.5, 23] },
  'Last quarter': { k: 3.1, trend: [15, 17, 16, 19, 21, 23, 22, 24], target: [16, 17, 18, 19, 20, 21, 22, 23] },
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']
const NAV = [
  ['Main', [['Overview', 'M3 9l7-6 7 6v8H3z'], ['Products', 'M3 6l7-3 7 3v8l-7 3-7-3zM3 6l7 3 7-3M10 9v8'], ['Orders', 'M4 6h12l-1 10H5zM7 6V5a3 3 0 0 1 6 0v1'], ['Customers', 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17c0-3 2.2-5 5-5s5 2 5 5M13.5 9a2.5 2.5 0 1 0 0-5M14 12c2 .4 4 2 4 5'], ['Messages', 'M3 4h14v10H8l-4 3v-3H3z', 2]]],
  ['Other', [['Email', 'M3 5h14v10H3zM3 5l7 6 7-6', 3], ['Analytics', 'M10 3v7h7A7 7 0 1 1 10 3zM13 3a4 4 0 0 1 4 4h-4z'], ['Integrations', 'M7 3v5M13 3v5M5 8h10v3a5 5 0 0 1-10 0zM10 16v2']]],
  ['Account', [['Team', 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17c0-3 2.2-5 5-5s5 2 5 5'], ['Settings', 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4']]],
]
const HEAT = [[1, 0, 2, 4, 3, 1, 0, 2, 1, 4], [2, 4, 1, 2, 3, 1, 4, 2, 1, 1], [0, 1, 4, 2, 3, 1, 4, 4, 2, 0]]
const SLOTS = ['09–12', '12–15', '15–18']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const SHADES = ['#f3f3f2', '#e2e2e0', '#bdbdba', '#7d7d7a', '#232323']

const Icon = ({ d, size = 18 }) => <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={d} /></svg>
const money = (n, dp = 0) => `$${n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
const Delta = ({ v }) => <span className={`md-delta ${v >= 0 ? 'up' : 'down'}`}>{v >= 0 ? '↗' : '↘'} {Math.abs(v)}%</span>

function smooth(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`
  }
  return d
}

export default function MinDashboard({ brand = 'Tally', user = 'Sam Rivera', style }) {
  const [nav, setNav] = useState('Overview')
  const [period, setPeriod] = useState('Last month')
  const [hover, setHover] = useState(3)
  const [heat, setHeat] = useState(null)
  const [range, setRange] = useState('Daily')
  const [toast, setToast] = useState(null)
  const P = PERIODS[period]
  const k = P.k

  const kpis = [
    ['Total sales', money(Math.round(1256940 * k)), `+${money(Math.round(456 * k))}`, 12, 'vs previous', 'M4 4h6l7 7-6 6-7-7zM7.5 7.5h.01'],
    ['Orders', Math.round(6432 * k).toLocaleString(), 'orders', -1.8, 'product sales', 'M4 6h12M4 10h12M4 14h12'],
    ['Customers', Math.round(173247 * Math.min(1, 0.6 + k * 0.4)).toLocaleString(), 'people', 1.8, 'new customers', 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17c0-3 2.2-5 5-5s5 2 5 5'],
    ['Interactions', Math.round(3247 * k).toLocaleString(), '', -2.8, 'vs previous', 'M4 10a6 6 0 0 1 12 0v3a2 2 0 0 1-2 2h-1v-5h3M4 10v3a2 2 0 0 0 2 2h1v-5H4'],
  ]
  const channels = [['Website', 5762, 1.8, 1378975, '#1f1f1f'], ['Marketplace', 6843, -2.8, 778975, '#9a9a97'], ['Store', 2123, -2.8, 412340, '#d4d4d1']]
  const totalSold = channels.reduce((a, c) => a + c[1], 0)

  // chart geometry
  const W = 520, H = 170, L = 34, B = 22
  const xs = (i) => L + (i / (P.trend.length - 1)) * (W - L - 8)
  const ys = (v) => H - B - ((v - 8) / 18) * (H - B - 10)
  const months = MONTHS.slice(0, P.trend.length)
  const hv = Math.min(hover, P.trend.length - 1)

  // gauge: 26 segments in an arc, coloured by channel share
  const SEG = 26
  let acc = 0
  const segColour = Array.from({ length: SEG }, (_, i) => {
    const f = (i + 0.5) / SEG
    acc = 0
    for (const c of channels) { acc += c[1] / totalSold; if (f <= acc) return c[4] }
    return channels[2][4]
  })

  const exportCsv = () => { setToast('Exported overview.csv'); setTimeout(() => setToast(null), 1500) }

  return (
    <div className="md-wrap" style={style}>
      <style>{`
        .md-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: auto; background: #f1f1f0; color: #1a1a1a; font: 400 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.md-wrap) button, :where(.md-wrap) input { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .md-shell { display: grid; grid-template-columns: 210px 1fr; gap: 12px; padding: 12px; min-height: 100%; box-sizing: border-box; }
        .md-card { background: #fff; border: 1px solid #e6e6e4; border-radius: 12px; }
        .md-side { display: flex; flex-direction: column; padding: 12px; gap: 4px; }
        .md-brand { display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid #ececea; border-radius: 10px; margin-bottom: 10px; }
        .md-logo { width: 32px; height: 32px; border-radius: 8px; background: #1a1a1a; display: grid; place-items: center; }
        .md-logo i { width: 14px; height: 14px; border-radius: 3px; background: #fff; transform: rotate(45deg); }
        .md-brand b { display: block; font-size: 14px; }
        .md-brand small { color: #6b6b6b; }
        .md-side h4 { margin: 12px 8px 4px; font-size: 11px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: #6b6b6b; }
        .md-nav { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border-radius: 8px; color: #3d3d3d; text-align: left; font-size: 13.5px; }
        .md-nav:hover { background: #f5f5f4; }
        .md-nav[aria-current='page'] { background: #fff; color: #111; font-weight: 600; box-shadow: inset 0 0 0 1px #e6e6e4, inset 3px 0 0 #111; }
        .md-badge { margin-left: auto; min-width: 18px; height: 18px; border-radius: 999px; background: #c0352b; color: #fff; font-size: 11px; font-weight: 600; display: grid; place-items: center; }
        .md-user { margin-top: auto; display: flex; gap: 10px; align-items: center; padding: 8px; border: 1px solid #ececea; border-radius: 10px; }
        .md-av { width: 32px; height: 32px; border-radius: 50%; background: #d8d8d5; display: grid; place-items: center; font-weight: 600; font-size: 12px; flex: none; }
        .md-user b { display: block; font-size: 13px; }
        .md-user small { color: #6b6b6b; }
        .md-main { padding: 12px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .md-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 1px solid #ececea; }
        .md-search { display: flex; align-items: center; gap: 8px; border: 1px solid #e6e6e4; border-radius: 8px; padding: 7px 10px; flex: 1 1 160px; max-width: 260px; color: #6b6b6b; }
        .md-search input { flex: 1; min-width: 0; cursor: text; color: #1a1a1a; outline: none; }
        .md-search input::placeholder { color: #6b6b6b; }
        .md-avs { margin-left: auto; display: flex; }
        .md-avs span { width: 26px; height: 26px; border-radius: 50%; border: 2px solid #fff; margin-left: -8px; display: grid; place-items: center; font-size: 10px; font-weight: 600; }
        .md-ctl { display: flex; align-items: center; gap: 6px; border: 1px solid #e6e6e4; border-radius: 8px; padding: 7px 10px; }
        .md-ctl select { appearance: none; border: 0; background: transparent; font: inherit; color: #1a1a1a; cursor: pointer; padding-right: 4px; outline: none; }
        .md-bell { position: relative; }
        .md-bell::after { content: ''; position: absolute; top: 5px; right: 7px; width: 6px; height: 6px; border-radius: 50%; background: #c0352b; }
        .md-export { display: flex; align-items: center; gap: 6px; background: #1a1a1a; color: #fff; border-radius: 8px; padding: 8px 12px; font-weight: 600; }
        .md-wrap .md-export { color: #fff; }
        .md-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .md-kpi { padding: 10px; }
        .md-kpi h3, .md-panel h3 { margin: 0 0 8px; display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #3d3d3d; }
        .md-kpi-in { border: 1px solid #ececea; border-radius: 9px; padding: 10px; position: relative; }
        .md-kpi-in b { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .md-kpi-in .md-unit { color: #6b6b6b; margin-left: 6px; font-size: 13px; }
        .md-kpi-in .md-plus { color: #12803c; font-weight: 600; font-size: 12px; margin-left: 6px; }
        .md-kpi-in p { margin: 6px 0 0; display: flex; align-items: center; gap: 8px; color: #6b6b6b; }
        .md-go { position: absolute; right: 10px; top: 10px; color: #6b6b6b; }
        .md-delta { font-weight: 600; font-size: 11.5px; padding: 2px 6px; border-radius: 6px; }
        .md-delta.up { color: #12803c; background: #eaf6ee; }
        .md-delta.down { color: #b42318; background: #fbeceb; }
        .md-row { display: grid; grid-template-columns: 0.9fr 1.6fr; gap: 10px; }
        .md-row2 { display: grid; grid-template-columns: 0.9fr 0.8fr 0.8fr; gap: 10px; }
        .md-panel { padding: 14px; min-width: 0; }
        .md-ph { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
        .md-ph h3 { margin: 0; }
        .md-gauge { display: grid; place-items: center; margin: 6px 0 4px; position: relative; }
        .md-gauge div { position: absolute; bottom: 8px; text-align: center; }
        .md-gauge b { display: block; font-size: 22px; font-weight: 600; }
        .md-gauge small { color: #6b6b6b; }
        .md-chan { display: grid; grid-template-columns: 1fr auto auto; gap: 4px 12px; align-items: center; padding: 7px 0; border-top: 1px solid #f0f0ee; }
        .md-chan i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
        .md-chan small { display: block; color: #6b6b6b; margin-left: 16px; }
        .md-chan b { font-variant-numeric: tabular-nums; }
        .md-big { display: flex; align-items: center; gap: 10px; margin: 8px 0 2px; }
        .md-big b { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
        .md-legend { display: flex; gap: 14px; color: #3d3d3d; font-size: 12px; }
        .md-legend i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; }
        .md-chart { position: relative; margin-top: 6px; }
        .md-chart svg { width: 100%; height: auto; display: block; overflow: visible; }
        .md-tip { position: absolute; background: #1a1a1a; color: #fff; border-radius: 8px; padding: 8px 10px; font-size: 12px; pointer-events: none; white-space: nowrap; transform: translateX(-50%); }
        .md-tip div { display: flex; justify-content: space-between; gap: 18px; color: #c9c9c6; }
        .md-tip div b { color: #fff; }
        .md-seg { display: flex; gap: 2px; padding: 2px; border: 1px solid #e6e6e4; border-radius: 8px; }
        .md-seg button { padding: 4px 8px; border-radius: 6px; font-size: 12px; color: #6b6b6b; }
        .md-seg button[aria-pressed='true'] { background: #1a1a1a; color: #fff; }
        .md-bars { display: flex; gap: 6px; align-items: flex-end; height: 150px; margin-top: 10px; border-bottom: 1px solid #ececea; }
        .md-bars div { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; }
        .md-bars span { display: block; border-radius: 6px 6px 0 0; position: relative; transition: height 300ms; }
        .md-bars span b { position: absolute; left: 8px; bottom: 6px; font-size: 15px; font-weight: 600; }
        .md-bars small { text-align: center; color: #6b6b6b; padding-top: 6px; }
        .md-labels { display: flex; gap: 6px; }
        .md-labels small { flex: 1; text-align: center; color: #6b6b6b; padding-top: 6px; }
        .md-vis { display: grid; grid-template-columns: 1fr auto; gap: 6px 10px; margin: 10px 0; color: #3d3d3d; }
        .md-vis b { font-variant-numeric: tabular-nums; }
        .md-heat { display: grid; grid-template-columns: 46px repeat(10, 1fr); gap: 3px; font-size: 11px; color: #6b6b6b; align-items: center; }
        .md-heat button { aspect-ratio: 1.4; border-radius: 4px; border: 1px solid #e6e6e4; }
        .md-heat button:focus-visible { outline: 2px solid #1a1a1a; outline-offset: 1px; }
        .md-heat-days { grid-column: 2 / -1; display: grid; grid-template-columns: repeat(5, 1fr); text-align: center; }
        .md-act { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid #ececea; border-radius: 9px; margin-top: 8px; }
        .md-thumb { width: 34px; height: 34px; border-radius: 50%; background: #f1f1f0; display: grid; place-items: center; flex: none; }
        .md-act b { display: block; font-size: 13.5px; font-weight: 600; }
        .md-act small { color: #6b6b6b; }
        .md-act small span { color: #b42318; }
        .md-act strong { margin-left: auto; font-variant-numeric: tabular-nums; }
        .md-toast { position: absolute; right: 18px; bottom: 18px; background: #1a1a1a; color: #fff; padding: 8px 12px; border-radius: 8px; font-weight: 600; }
        @container (max-width: 1240px) { .md-kpis { grid-template-columns: repeat(2, 1fr); } .md-row { grid-template-columns: 1fr; } .md-row > :last-child { order: -1; } .md-row2 { grid-template-columns: 1fr 1fr; } .md-row2 > :first-child { grid-column: 1 / -1; } }
        @container (max-width: 760px) { .md-shell { grid-template-columns: 1fr; } .md-side { display: none; } .md-kpis { grid-template-columns: 1fr 1fr; } .md-avs { display: none; } }
        @container (max-width: 520px) { .md-row, .md-row2, .md-kpis { grid-template-columns: 1fr; } .md-search { width: 100%; } }
        @media (prefers-reduced-motion: reduce) { .md-bars span { transition: none; } }
      `}</style>

      <div className="md-shell">
        <aside className="md-card md-side" aria-label="Main navigation">
          <div className="md-brand"><span className="md-logo" aria-hidden="true"><i /></span><span><b>{brand}</b><small>Marketing &amp; Sales</small></span></div>
          {NAV.map(([group, items]) => (
            <div key={group}>
              <h4>{group}</h4>
              {items.map(([label, d, badge]) => (
                <button key={label} className="md-nav" aria-current={label === nav ? 'page' : undefined} onClick={() => setNav(label)}>
                  <Icon d={d} />{label}{badge && <span className="md-badge" aria-label={`${badge} unread`}>{badge}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="md-user"><span className="md-av" aria-hidden="true">{user.split(' ').map((w) => w[0]).join('')}</span><span><b>{user}</b><small>{user.split(' ')[0].toLowerCase()}@tally.app</small></span></div>
        </aside>

        <main className="md-card md-main">
          <div className="md-top">
            <label className="md-search"><Icon d="M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM17 17l-3.5-3.5" size={16} /><input placeholder="Search" aria-label="Search" /></label>
            <div className="md-avs" role="group" aria-label="Team online">
              {[['A', '#e9c46a'], ['R', '#bfd7ea'], ['M', '#f4a3a8'], ['K', '#cdeac0']].map(([l, c]) => <span key={l} style={{ background: c }} aria-hidden="true">{l}</span>)}
              <span style={{ background: '#1a1a1a', color: '#fff' }} aria-hidden="true">+</span>
            </div>
            <label className="md-ctl"><Icon d="M4 5h12v11H4zM4 8h12M8 3v3M12 3v3" size={16} /><select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">{Object.keys(PERIODS).map((p) => <option key={p}>{p}</option>)}</select></label>
            <button className="md-ctl" onClick={() => setToast('Filters coming soon')}><Icon d="M4 6h12M6 10h8M8 14h4" size={16} />Filter</button>
            <button className="md-ctl md-bell" aria-label="Notifications"><Icon d="M5 14V9a5 5 0 0 1 10 0v5l1.5 2h-13zM8.5 18h3" size={16} /></button>
            <button className="md-export" onClick={exportCsv}><Icon d="M10 13V3M6 7l4-4 4 4M4 13v3h12v-3" size={16} />Export</button>
          </div>

          <section className="md-kpis">
            {kpis.map(([label, val, unit, d, note, ic]) => (
              <div key={label} className="md-card md-kpi">
                <h3><Icon d={ic} size={15} />{label}</h3>
                <div className="md-kpi-in">
                  <b>{val}</b>{unit && (unit.startsWith('+') ? <span className="md-plus">{unit}</span> : <span className="md-unit">{unit}</span>)}
                  <span className="md-go" aria-hidden="true">↗</span>
                  <p><Delta v={d} />{note}</p>
                </div>
              </div>
            ))}
          </section>

          <div className="md-row">
            <section className="md-card md-panel" aria-labelledby="md-ch">
              <div className="md-ph"><h3 id="md-ch"><Icon d="M3 14a7 7 0 0 1 14 0M10 14l3-4" size={15} />Channel performance</h3></div>
              <div className="md-gauge">
                <svg viewBox="0 0 220 120" width="220" height="120" aria-hidden="true">
                  {segColour.map((c, i) => {
                    const a = Math.PI + (i + 0.5) * (Math.PI / SEG)
                    const x = 110 + Math.cos(a) * 82, y = 112 + Math.sin(a) * 82
                    return <rect key={i} x={x - 4} y={y - 15} width="8" height="30" rx="4" fill={c} transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`} />
                  })}
                </svg>
                <div><b>{Math.round(totalSold * k).toLocaleString()}</b><small>Products sold</small></div>
              </div>
              {channels.map(([n, sold, d, rev, c]) => (
                <div key={n} className="md-chan">
                  <span><i style={{ background: c, boxShadow: c === '#d4d4d1' ? 'inset 0 0 0 1px #9a9a97' : 'none' }} />{n}<small>{Math.round(sold * k).toLocaleString()} sold</small></span>
                  <Delta v={d} />
                  <b>{money(Math.round(rev * k))}</b>
                </div>
              ))}
            </section>

            <section className="md-card md-panel" aria-labelledby="md-avg">
              <div className="md-ph">
                <h3 id="md-avg"><Icon d="M4 16V9M9 16V5M14 16v-4" size={15} />Average sales</h3>
                <div className="md-legend"><span><i style={{ background: '#1a1a1a' }} />Revenue</span><span><i style={{ background: '#bdbdba' }} />Target</span></div>
              </div>
              <div className="md-big"><b>{money(Math.round(1389652 * k))}</b><Delta v={1.8} /></div>
              <div className="md-chart" onMouseLeave={() => setHover(3)}>
                <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Revenue against target, ${months[hv]}: revenue ${money(P.trend[hv] * 1000)}, target ${money(P.target[hv] * 1000)}`}>
                  {[10, 15, 20, 25].map((v) => <g key={v}><line x1={L} x2={W} y1={ys(v)} y2={ys(v)} stroke="#f0f0ee" /><text x={L - 6} y={ys(v) + 4} textAnchor="end" fontSize="10" fill="#6b6b6b">${v}k</text></g>)}
                  <rect x={xs(hv) - 12} y={ys(P.trend[hv])} width="24" height={H - B - ys(P.trend[hv])} rx="6" fill="#ececea" />
                  <path d={`${smooth(P.target.map((v, i) => [xs(i), ys(v)]))} L${xs(P.target.length - 1)},${H - B} L${xs(0)},${H - B}Z`} fill="#f7f7f6" />
                  <path d={smooth(P.target.map((v, i) => [xs(i), ys(v)]))} fill="none" stroke="#bdbdba" strokeWidth="1.5" strokeDasharray="4 4" />
                  <path d={smooth(P.trend.map((v, i) => [xs(i), ys(v)]))} fill="none" stroke="#1a1a1a" strokeWidth="2" />
                  <circle cx={xs(hv)} cy={ys(P.trend[hv])} r="4" fill="#fff" stroke="#1a1a1a" strokeWidth="2" />
                  {months.map((m, i) => <text key={m} x={xs(i)} y={H - 4} textAnchor="middle" fontSize="10.5" fill={i === hv ? '#1a1a1a' : '#6b6b6b'}>{m}</text>)}
                  {months.map((m, i) => <rect key={`h${m}`} x={xs(i) - (W - L) / months.length / 2} y="0" width={(W - L) / months.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />)}
                </svg>
                <div className="md-tip" style={{ left: `clamp(70px, ${(xs(hv) / W) * 100}%, calc(100% - 70px))`, top: `max(0px, calc(${(ys(Math.max(P.trend[hv], P.target[hv])) / H) * 100}% - 78px))` }}>
                  <b>{months[hv]} 2026</b>
                  <div>Target <b>{money(Math.round(P.target[hv] * 1000))}</b></div>
                  <div>Revenue <b>{money(Math.round(P.trend[hv] * 1000))}</b></div>
                </div>
              </div>
            </section>
          </div>

          <div className="md-row2">
            <section className="md-card md-panel" aria-labelledby="md-ra">
              <div className="md-ph"><h3 id="md-ra"><Icon d="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 6v4l3 2" size={15} />Recent activity</h3></div>
              {[['Linen overshirt', 'Qty 2', '5 min ago', 1500, 'M6 4l4 2 4-2 3 3-2 2v7H5V9L3 7z'], ['Canvas tote', 'Qty 6', '24 min ago', 480, 'M5 7h10l-1 9H6zM8 7a2 2 0 0 1 4 0'], ['Wool beanie', 'Qty 3', '1 h ago', 210, 'M4 13a6 6 0 0 1 12 0zM3 13h14v2H3z']].map(([n, q, t, p, ic]) => (
                <div key={n} className="md-act"><span className="md-thumb"><Icon d={ic} /></span><span><b>{n}</b><small>{q} · <span>{t}</span></small></span><strong>{money(p)}</strong></div>
              ))}
            </section>

            <section className="md-card md-panel" aria-labelledby="md-top">
              <div className="md-ph">
                <h3 id="md-top"><Icon d="M3 6l7-3 7 3v8l-7 3-7-3z" size={15} />Top products</h3>
                <div className="md-seg" role="group" aria-label="Range">{['Daily', 'Weekly'].map((r) => <button key={r} aria-pressed={r === range} onClick={() => setRange(r)}>{r}</button>)}</div>
              </div>
              <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
                <defs>
                  {[['md-h1', '#2b2b2b', '#454545'], ['md-h2', '#a3a3a0', '#bcbcb9'], ['md-h3', '#d9d9d6', '#e8e8e6']].map(([id, a, b]) => (
                    <pattern key={id} id={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill={a} /><rect width="3" height="8" fill={b} /></pattern>
                  ))}
                </defs>
              </svg>
              <div className="md-bars" role="img" aria-label={`Shoes ${range === 'Daily' ? 180 : 1140}, Jackets ${range === 'Daily' ? 87 : 610}, T-shirts ${range === 'Daily' ? 56 : 402}`}>
                {[[180, 1140, 'md-h1', '#fff'], [87, 610, 'md-h2', '#1a1a1a'], [56, 402, 'md-h3', '#1a1a1a']].map(([d, w, pat, ink]) => {
                  const v = range === 'Daily' ? d : w
                  const max = range === 'Daily' ? 200 : 1300
                  return <div key={pat}><span style={{ height: `${(v / max) * 100}%` }}><svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, borderRadius: '6px 6px 0 0' }} aria-hidden="true"><rect width="100%" height="100%" fill={`url(#${pat})`} rx="6" /></svg><b style={{ color: ink, position: 'absolute', zIndex: 1 }}>{v}</b></span></div>
                })}
              </div>
              <div className="md-labels"><small>Shoes</small><small>Jackets</small><small>T-shirts</small></div>
            </section>

            <section className="md-card md-panel" aria-labelledby="md-vis">
              <div className="md-ph"><h3 id="md-vis"><Icon d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5zM10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" size={15} />Visitors</h3></div>
              <div className="md-big"><b>{Math.round(3247 * k).toLocaleString()}</b><Delta v={1.8} /></div>
              <div className="md-vis"><span>Marketplace</span><b>{Math.round(300 * k)}</b><span>Website</span><b>{Math.round(250 * k)}</b><span>Store</span><b>{Math.round(400 * k)}</b></div>
              <div className="md-heat" role="grid" aria-label="Visitors by time of day">
                <span /><div className="md-heat-days" role="row">{DAYS.map((d) => <span key={d} role="columnheader">{d}</span>)}</div>
                {HEAT.map((row, r) => (
                  <div key={r} role="row" style={{ display: 'contents' }}>
                    <span role="rowheader">{SLOTS[r]}</span>
                    {row.map((v, c) => {
                      const n = Math.round((v * 22 + 6 + r * 3) * k)
                      return <button key={c} role="gridcell" aria-label={`${DAYS[Math.floor(c / 2)]} ${SLOTS[r]}: ${n} visitors`} style={{ background: SHADES[v] }} onMouseEnter={() => setHeat(`${DAYS[Math.floor(c / 2)]} ${SLOTS[r]} · ${n} visitors`)} onFocus={() => setHeat(`${DAYS[Math.floor(c / 2)]} ${SLOTS[r]} · ${n} visitors`)} onMouseLeave={() => setHeat(null)} />
                    })}
                  </div>
                ))}
              </div>
              <p role="status" style={{ margin: '8px 0 0', minHeight: 18, color: '#3d3d3d', fontSize: 12 }}>{heat ?? 'Hover a cell to see visitors'}</p>
            </section>
          </div>
        </main>
      </div>
      {toast && <div className="md-toast" role="status">{toast}</div>}
    </div>
  )
}
