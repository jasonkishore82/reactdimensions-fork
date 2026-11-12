import { useState } from 'react'

// Dark glassmorphism finance dashboard floating in a dim, warm room. The room
// is drawn in code (a window of cool light, plant leaves, a lantern glow and
// a few bokeh lights), so the heavy blur behind the glass reads like a photo.
// A glass browser bar, an icon rail with an orange active pill, stat chips,
// an interactive two-line chart, a profile card with a bank card, goals,
// savings bars and the last transaction.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const SERIES = {
  Groceries: { color: '#ff6a2b', data: [38, 55, 62, 44, 22, 18] },
  Investments: { color: '#f4efe8', data: [20, 24, 40, 58, 52, 30] },
  Hobbies: { color: '#4fd1c5', data: [30, 28, 34, 30, 40, 46] },
}
const FILTERS = ['All', ...Object.keys(SERIES)]
const RAIL = [
  'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z',
  'M2.5 5h15v10h-15zM2.5 8.5h15M5 12h3',
  'M3 15l4-5 3 3 7-8',
  'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4',
]
const ACTIONS = [
  ['Transfer', 'M4 7h11l-3-3M16 13H5l3 3'],
  ['Receive', 'M14 6l-8 8M6 8v6h6'],
  ['Bills', 'M5 3h10v14l-2.5-1.5L10 17l-2.5-1.5L5 17zM8 8h4M8 11h4'],
  ['Top up', 'M10 4v12M4 10h12'],
]

const Icon = ({ d, size = 18 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={d} /></svg>
)

// Smooth path through points (Catmull-Rom to cubic Bézier).
function smooth(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`
  }
  return d
}

function Room() {
  return (
    <svg className="gdb-room" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="gdb-lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffb257" /><stop offset=".35" stopColor="#c25a1c" stopOpacity=".7" /><stop offset="1" stopColor="#c25a1c" stopOpacity="0" /></radialGradient>
        <linearGradient id="gdb-win" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8aa3a6" /><stop offset="1" stopColor="#40564f" /></linearGradient>
      </defs>
      <rect width="400" height="260" fill="#1b1a1c" />
      <rect x="0" y="200" width="400" height="60" fill="#241f1c" />
      {/* window with cool daylight and greenery outside */}
      <rect x="318" y="0" width="82" height="210" fill="url(#gdb-win)" opacity=".55" />
      {[0, 1, 2].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={322 + c * 38} y={6 + r * 66} width="34" height="60" fill="#9fb8b3" opacity={0.18 + ((r + c) % 2) * 0.08} />))}
      {[[340, 190, 26], [372, 176, 22], [356, 150, 18]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#3f6b45" opacity=".75" />)}
      {/* shelf with books */}
      <rect x="150" y="40" width="120" height="4" fill="#3a332e" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={200 + i * 7} y={22 + (i % 3) * 2} width="5" height={18 - (i % 3) * 2} fill={['#6e5a46', '#8a7a62', '#4b4038'][i % 3]} />)}
      {/* plant leaves on the left */}
      {[[40, 70, -30], [70, 50, 20], [30, 120, -60], [90, 100, 40], [55, 150, -20], [20, 40, 10], [100, 140, 70]].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx="34" ry="16" fill={i % 2 ? '#2c4a35' : '#22392a'} transform={`rotate(${r} ${x} ${y})`} />
      ))}
      <rect x="40" y="170" width="70" height="60" rx="8" fill="#5a4a3c" />
      {/* lantern glow */}
      <circle cx="80" cy="222" r="70" fill="url(#gdb-lamp)" />
      <rect x="70" y="205" width="20" height="28" rx="3" fill="#2a211b" stroke="#6b4a2a" />
      <circle cx="80" cy="220" r="5" fill="#ffd38a" />
      {/* bokeh */}
      {[[180, 120, 10, '#ff9b4a'], [240, 80, 14, '#ffcb7a'], [210, 170, 8, '#ff7a3a'], [290, 130, 12, '#e8d2b0']].map(([x, y, r, c], i) => <circle key={i} cx={x} cy={y} r={r} fill={c} opacity=".35" />)}
    </svg>
  )
}

export default function GlassDashboard({ accent = '#ff6a2b', blur = 26, frost = 0.06, style }) {
  const [rail, setRail] = useState(0)
  const [filter, setFilter] = useState('All')
  const [menu, setMenu] = useState(false)
  const [hover, setHover] = useState(1)
  const [goals, setGoals] = useState([['Build a house', 78], ['House savings', 97]])

  const W = 300, H = 110, PAD = 12
  const x = (i) => PAD + (i / (MONTHS.length - 1)) * (W - PAD * 2)
  const y = (v) => H - 8 - (v / 70) * (H - 20)
  const shown = filter === 'All' ? Object.keys(SERIES) : [filter]
  const lead = SERIES[shown[0]]

  return (
    <div className="gdb-wrap" style={{ '--accent': accent, '--blur': `${blur}px`, '--frost': frost, ...style }}>
      <style>{`
        .gdb-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; background: #111; color: #f4efe8; font: 400 12.5px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.gdb-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .gdb-room { position: absolute; inset: 0; width: 100%; height: 100%; }
        .gdb-g { background: rgba(255,255,255,var(--frost)); border: 1px solid rgba(255,255,255,.16); box-shadow: inset 0 1px 0 rgba(255,255,255,.1); -webkit-backdrop-filter: blur(var(--blur)) saturate(140%); backdrop-filter: blur(var(--blur)) saturate(140%); }
        .gdb-g2 { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.14); border-radius: 16px; }
        .gdb-url { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: min(460px, 70%); display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 999px; font-size: 11.5px; z-index: 2; }
        .gdb-url span { flex: 1; text-align: center; background: rgba(255,255,255,.08); border-radius: 999px; padding: 4px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gdb-rail { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 8px; padding: 10px 7px; border-radius: 999px; z-index: 2; }
        .gdb-rail button { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; color: rgba(244,239,232,.75); transition: background 150ms; }
        .gdb-rail button:hover { background: rgba(255,255,255,.08); }
        .gdb-rail button[aria-current='page'] { background: var(--accent); color: #fff; box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 50%, transparent); }
        .gdb-panel { position: absolute; left: 70px; right: 12px; top: 48px; bottom: 12px; border-radius: 26px; padding: 16px 18px; overflow: auto; display: grid; grid-template-columns: 1.7fr 1fr; gap: 14px; align-content: start; }
        .gdb-panel h1 { grid-column: 1 / -1; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
        .gdb-h { display: flex; align-items: center; justify-content: space-between; margin: 2px 0 8px; }
        .gdb-h h3 { margin: 0; font-size: 15px; font-weight: 600; }
        .gdb-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 12px; }
        .gdb-stat { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .gdb-stat i { width: 34px; height: 34px; border-radius: 50%; border: 1px solid rgba(255,255,255,.35); display: grid; place-items: center; flex: none; }
        .gdb-stat small { display: block; color: rgba(244,239,232,.6); font-size: 11px; }
        .gdb-stat b { font-weight: 600; font-size: 13.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .gdb-drop { position: relative; }
        .gdb-drop > button { border: 1px solid rgba(255,255,255,.3); border-radius: 999px; padding: 5px 12px; font-size: 11.5px; }
        .gdb-menu { position: absolute; right: 0; top: 32px; z-index: 5; border-radius: 12px; padding: 4px; min-width: 140px; background: rgba(30,28,28,.86); }
        .gdb-menu button { display: block; width: 100%; text-align: left; padding: 6px 10px; border-radius: 8px; }
        .gdb-menu button:hover, .gdb-menu button[aria-selected='true'] { background: rgba(255,255,255,.1); }
        .gdb-chart { padding: 12px 14px; }
        .gdb-chart-top { display: flex; justify-content: space-between; gap: 10px; }
        .gdb-chart-top b { display: block; font-weight: 600; }
        .gdb-chart-top small { color: rgba(244,239,232,.6); }
        .gdb-legend { text-align: right; font-size: 11px; color: rgba(244,239,232,.75); }
        .gdb-legend span { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
        .gdb-legend i { width: 7px; height: 7px; border-radius: 50%; }
        .gdb-svg { width: 100%; height: auto; display: block; margin-top: 4px; overflow: visible; }
        .gdb-months { display: grid; grid-template-columns: repeat(6, 1fr); text-align: center; font-size: 11px; color: rgba(244,239,232,.75); }
        .gdb-side { padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 10px; grid-row: span 2; }
        .gdb-avatar { width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(135deg, #c27a4a, #5b3a2a); display: grid; place-items: center; font-weight: 700; font-size: 17px; border: 2px solid rgba(255,255,255,.4); }
        .gdb-badge { font-size: 9.5px; border: 1px solid rgba(255,255,255,.35); border-radius: 999px; padding: 2px 8px; margin-top: -16px; background: rgba(20,20,20,.6); }
        .gdb-side h4 { margin: 0; font-size: 14px; font-weight: 600; }
        .gdb-acts { display: grid; grid-template-columns: repeat(4, 1fr); width: 100%; text-align: center; font-size: 10.5px; }
        .gdb-acts button { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 0; border-radius: 10px; }
        .gdb-acts button:hover { background: rgba(255,255,255,.08); }
        .gdb-card { width: 100%; aspect-ratio: 1.6; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(135deg, #1f4f5a, #0f2a33 60%, #101418); position: relative; overflow: hidden; box-shadow: 0 10px 24px rgba(0,0,0,.35); }
        .gdb-card::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px); background-size: 6px 6px; }
        .gdb-card::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 28%; background: rgba(0,0,0,.45); }
        .gdb-card > * { position: relative; z-index: 1; }
        .gdb-card-top { display: flex; justify-content: space-between; align-items: center; }
        .gdb-card-top b { font-style: italic; font-weight: 800; letter-spacing: .02em; }
        .gdb-chip { width: 26px; height: 20px; border-radius: 4px; background: linear-gradient(135deg, #f6d27a, #b99140); }
        .gdb-card small { font-size: 10px; opacity: .75; display: block; }
        .gdb-card strong { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .gdb-bottom { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr 1.2fr 1.2fr; gap: 12px; align-items: stretch; }
        .gdb-goal { padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; text-align: left; }
        .gdb-goal b { font-size: 24px; font-weight: 600; }
        .gdb-bar { height: 6px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
        .gdb-bar i { display: block; height: 100%; background: var(--accent); border-radius: inherit; transition: width 400ms ease; }
        .gdb-save { padding: 12px; display: flex; justify-content: space-between; gap: 8px; }
        .gdb-save b { display: block; font-size: 17px; font-weight: 600; margin: 2px 0 6px; font-variant-numeric: tabular-nums; }
        .gdb-save b span { color: var(--accent); }
        .gdb-up { display: inline-block; background: #5eead4; color: #0b2b27; font-weight: 700; font-size: 10px; border-radius: 999px; padding: 2px 7px; }
        .gdb-bars { display: flex; align-items: flex-end; gap: 6px; font-size: 9.5px; color: rgba(244,239,232,.7); text-align: center; }
        .gdb-bars i { display: block; width: 16px; background: var(--accent); border-radius: 3px 3px 0 0; margin-bottom: 3px; }
        .gdb-tx { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
        .gdb-tx-row { display: flex; align-items: center; gap: 8px; }
        .gdb-tx-row i { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, #8aa3a6, #40564f); flex: none; }
        .gdb-tx-row span { flex: 1; }
        .gdb-plus { color: #5eead4; font-weight: 700; font-size: 11px; border: 1px solid rgba(94,234,212,.4); border-radius: 999px; padding: 1px 7px; }
        .gdb-tx small { display: flex; justify-content: space-between; color: rgba(244,239,232,.55); font-size: 10.5px; }
        .gdb-all { display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,.2); border-radius: 12px; padding: 7px 10px; }
        .gdb-all:hover { background: rgba(255,255,255,.06); }
        @container (max-width: 820px) { .gdb-panel { grid-template-columns: 1fr; } .gdb-side { grid-row: auto; } .gdb-bottom { grid-template-columns: 1fr 1fr; } }
        @container (max-width: 480px) { .gdb-rail { display: none; } .gdb-panel { left: 10px; right: 10px; } .gdb-stats { grid-template-columns: 1fr; } .gdb-url { width: 86%; } }
      `}</style>

      <Room />

      <div className="gdb-url gdb-g">
        <Icon d="M12 5l-5 5 5 5" size={14} />
        <span>🔒 fernbank.app/dashboard</span>
        <Icon d="M4 10a6 6 0 1 0 2-4.5M4 4v3h3" size={14} />
      </div>

      <nav className="gdb-rail gdb-g" aria-label="Main">
        {RAIL.map((d, n) => (
          <button key={n} aria-label={['Dashboard', 'Cards', 'Reports', 'Settings'][n]} aria-current={n === rail ? 'page' : undefined} onClick={() => setRail(n)}><Icon d={d} /></button>
        ))}
        <button aria-label="Sign out"><Icon d="M8 4H4v12h4M12 6l4 4-4 4M16 10H8" /></button>
      </nav>

      <main className="gdb-panel gdb-g">
        <h1>My Dashboard</h1>

        <div>
          <section className="gdb-stats gdb-g2">
            {[['Total balance', '$67,893.98', 'M10 3v14M13.5 6.5c0-1.4-1.6-2.5-3.5-2.5S6.5 5.1 6.5 6.5 8 9 10 9.5s3.5 1.1 3.5 2.5-1.6 2.5-3.5 2.5-3.5-1.1-3.5-2.5'], ['Earnings', '$99,865.65', 'M3 6h14v9H3zM13 10.5h.01M3 9h14'], ['Expenses', '$5,646.69', 'M3 10l14-6-5 14-2-6z']].map(([l, v, d]) => (
              <div key={l} className="gdb-stat"><i><Icon d={d} size={16} /></i><div><small>{l}</small><b>{v}</b></div></div>
            ))}
          </section>

          <div className="gdb-h" style={{ marginTop: 12 }}>
            <h3>Statistics</h3>
            <div className="gdb-drop">
              <button aria-expanded={menu} onClick={() => setMenu(!menu)}>{filter === 'All' ? 'All transactions' : filter} ▾</button>
              {menu && (
                <div className="gdb-menu gdb-g" role="listbox">
                  {FILTERS.map((f) => <button key={f} role="option" aria-selected={f === filter} onClick={() => { setFilter(f); setMenu(false) }}>{f === 'All' ? 'All transactions' : f}</button>)}
                </div>
              )}
            </div>
          </div>

          <section className="gdb-chart gdb-g2">
            <div className="gdb-chart-top">
              <div><b>Top contributors</b><small>Half-year earnings and spending</small></div>
              <div className="gdb-legend">
                {Object.entries(SERIES).map(([k, s]) => <span key={k} style={{ opacity: shown.includes(k) ? 1 : 0.35 }}>{k}<i style={{ background: s.color }} /></span>)}
              </div>
            </div>
            <svg className="gdb-svg" viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHover(1)}>
              {shown.map((k) => (
                <path key={k} d={smooth(SERIES[k].data.map((v, i) => [x(i), y(v)]))} fill="none" stroke={SERIES[k].color} strokeWidth={k === shown[0] ? 3 : 1.6} strokeLinecap="round" opacity={k === shown[0] ? 1 : 0.8} />
              ))}
              <line x1={x(hover)} x2={x(hover)} y1="16" y2={H - 8} stroke="rgba(255,255,255,.35)" strokeDasharray="2 3" />
              <circle cx={x(hover)} cy={y(lead.data[hover])} r="5" fill="#fff" stroke={lead.color} strokeWidth="3" />
              <g transform={`translate(${Math.min(Math.max(x(hover) - 30, 0), W - 60)}, ${Math.max(y(lead.data[hover]) - 34, 0)})`}>
                <rect width="60" height="24" rx="5" fill="rgba(20,20,20,.75)" stroke="rgba(255,255,255,.35)" />
                <text x="30" y="9.5" textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,.7)">{shown[0]}</text>
                <text x="30" y="19" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">${(lead.data[hover] * 1.37).toFixed(2)}</text>
              </g>
              {MONTHS.map((_, i) => <rect key={i} x={x(i) - 25} y="0" width="50" height={H} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />)}
            </svg>
            <div className="gdb-months">{MONTHS.map((m, i) => <span key={m} style={{ color: i === hover ? '#fff' : undefined }}>{m}</span>)}</div>
          </section>
        </div>

        <aside className="gdb-side gdb-g2">
          <div className="gdb-avatar">MR</div>
          <span className="gdb-badge">Exclusive card</span>
          <h4>Maya Rios</h4>
          <div className="gdb-acts">
            {ACTIONS.map(([l, d]) => <button key={l}><Icon d={d} size={16} />{l}</button>)}
          </div>
          <div className="gdb-card">
            <div className="gdb-card-top"><b>FERN</b><i className="gdb-chip" /></div>
            <div><small>Total balance</small><strong>$65,498.23</strong></div>
          </div>
        </aside>

        <div className="gdb-bottom">
          {goals.map(([name, pct], n) => (
            <button key={name} className="gdb-goal gdb-g2" onClick={() => setGoals(goals.map((g, k) => (k === n ? [g[0], Math.min(100, g[1] + 1)] : g)))} title="Add 1%">
              <b>{pct}%</b>
              <span className="gdb-bar"><i style={{ width: `${pct}%` }} /></span>
              <span>{name}</span>
            </button>
          ))}
          <section className="gdb-save gdb-g2">
            <div>
              <small style={{ color: 'rgba(244,239,232,.7)' }}>Business savings</small>
              <b><span>$</span>43,945.23</b>
              <span className="gdb-up">↑ 53.6%</span>
            </div>
            <div className="gdb-bars">
              {[['Feb', 18], ['Mar', 34], ['Apr', 58]].map(([m, h]) => <span key={m}><i style={{ height: h }} />{m}</span>)}
            </div>
          </section>
          <section className="gdb-tx gdb-g2">
            <div className="gdb-tx-row"><i /><span>Noor Ackerman</span><b className="gdb-plus">+ $900</b></div>
            <small><span>Nov 02 · 12:02</span><span>Bonus salary</span></small>
            <button className="gdb-all">See all transactions <Icon d="M4 10h12M12 6l4 4-4 4" size={14} /></button>
          </section>
        </div>
      </main>
    </div>
  )
}
