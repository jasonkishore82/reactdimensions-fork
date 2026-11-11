import { useState } from 'react'

// Bento analytics dashboard: tiles of different sizes for KPIs, a revenue
// chart, a conversion funnel, live visitors, top countries and a goal ring.
// The date-range pill re-flows every number; each tile has ghost buttons to
// expand it (it takes over the grid) and export; a slim rail switches boards.

const RANGES = ['Today', '7 days', '30 days', 'Quarter']
const DATA = {
  Today: { rev: 4820, orders: 132, conv: 3.4, aov: 36.5, bars: [12, 18, 9, 22, 30, 26, 34, 28, 40, 36, 44, 38], funnel: [8200, 3100, 920, 279], goal: 0.48 },
  '7 days': { rev: 31240, orders: 904, conv: 3.1, aov: 34.6, bars: [40, 52, 38, 61, 70, 58, 82, 76, 68, 90, 84, 96], funnel: [58e3, 21e3, 6400, 1800], goal: 0.71 },
  '30 days': { rev: 128400, orders: 3610, conv: 2.9, aov: 35.6, bars: [60, 66, 58, 72, 80, 76, 90, 84, 92, 98, 94, 100], funnel: [236e3, 84e3, 26e3, 6850], goal: 0.86 },
  Quarter: { rev: 392000, orders: 10840, conv: 3.2, aov: 36.2, bars: [50, 62, 70, 66, 78, 84, 80, 92, 88, 96, 100, 94], funnel: [702e3, 251e3, 79e3, 22e3], goal: 1.04 },
}
const COUNTRIES = [['Portugal', 0.34], ['Brazil', 0.22], ['Spain', 0.16], ['UK', 0.11], ['US', 0.09]]
const RAIL = [['Sales', 'M3 15l4-5 3 3 7-8'], ['Traffic', 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM3 10h14M10 3c2 2 3 4.5 3 7s-1 5-3 7c-2-2-3-4.5-3-7s1-5 3-7z'], ['Products', 'M3 6l7-3 7 3v8l-7 3-7-3zM3 6l7 3 7-3M10 9v8'], ['Team', 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17c0-3 2.2-5 5-5s5 2 5 5M13.5 9a2.5 2.5 0 1 0 0-5M14 12c2 .4 4 2 4 5']]

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n.toLocaleString())
const Icon = ({ d, size = 16 }) => <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={d} /></svg>

export default function BentoAnalytics({ accent = '#3b5bfd', style }) {
  const [range, setRange] = useState('7 days')
  const [board, setBoard] = useState(0)
  const [big, setBig] = useState(null)
  const [toast, setToast] = useState(null)
  const d = DATA[range]
  const R = 38, C = 2 * Math.PI * R

  const Tools = ({ id }) => (
    <span className="ba-tools">
      <button aria-label={big === id ? 'Collapse' : 'Expand'} onClick={() => setBig(big === id ? null : id)}><Icon d={big === id ? 'M8 3v5H3M12 17v-5h5' : 'M3 8V3h5M17 12v5h-5'} size={14} /></button>
      <button aria-label="Export" onClick={() => { setToast(`Exported ${id}`); setTimeout(() => setToast(null), 1300) }}><Icon d="M10 3v10M6 9l4 4 4-4M4 16h12" size={14} /></button>
    </span>
  )
  const tile = (id, cls, children) => (!big || big === id) && <section className={`ba-tile ${cls}${big === id ? ' ba-big' : ''}`}><Tools id={id} />{children}</section>

  return (
    <div className="ba-wrap" style={{ '--accent': accent, ...style }}>
      <style>{`
        .ba-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: hidden; background: #eef0f4; color: #141827; font: 500 12.5px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; display: grid; grid-template-columns: 60px 1fr; }
        :where(.ba-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .ba-rail { background: #141827; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 0; }
        .ba-rail i { width: 26px; height: 26px; border-radius: 8px; background: var(--accent); margin-bottom: 10px; }
        .ba-rail button { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: #8b93ad; }
        .ba-rail button[aria-current='page'] { background: rgba(255,255,255,.1); color: #fff; }
        .ba-main { overflow: auto; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px; }
        .ba-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
        .ba-head h2 { margin: 0; font-size: 18px; font-weight: 800; }
        .ba-range { display: flex; gap: 2px; background: #fff; padding: 3px; border-radius: 999px; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
        .ba-range button { padding: 6px 12px; border-radius: 999px; color: #6b7287; font-weight: 600; }
        .ba-range button[aria-pressed='true'] { background: #141827; color: #fff; }
        .ba-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 104px; gap: 12px; }
        .ba-tile { position: relative; background: #fff; border-radius: 18px; padding: 14px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 1px 2px rgba(20,24,39,.05); overflow: hidden; min-width: 0; }
        .ba-tile.ba-big { grid-column: 1 / -1; grid-row: span 3; }
        .ba-tile small { color: #6b7287; font-weight: 600; }
        .ba-tile b.kpi { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .ba-up { color: #12a150; font-weight: 700; font-size: 11.5px; }
        .ba-tools { position: absolute; right: 8px; top: 8px; display: flex; gap: 2px; opacity: .55; transition: opacity 150ms; }
        .ba-tile:hover .ba-tools { opacity: 1; }
        .ba-tools button { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; color: #6b7287; }
        .ba-tools button:hover { background: #eef0f4; color: #141827; }
        .ba-chart { grid-column: span 2; grid-row: span 2; }
        .ba-bars { flex: 1; display: flex; align-items: flex-end; gap: 6px; padding-top: 8px; }
        .ba-bars i { flex: 1; border-radius: 6px 6px 2px 2px; background: color-mix(in srgb, var(--accent) 22%, #fff); transition: height 400ms ease; }
        .ba-bars i:last-child { background: var(--accent); }
        .ba-funnel { grid-column: span 2; grid-row: span 2; }
        .ba-step { display: grid; grid-template-columns: 70px 1fr 54px; align-items: center; gap: 8px; margin-top: 6px; }
        .ba-step span:first-child { color: #6b7287; font-weight: 600; }
        .ba-step i { height: 22px; border-radius: 7px; background: var(--accent); transition: width 400ms ease; opacity: var(--o); }
        .ba-step b { text-align: right; font-variant-numeric: tabular-nums; }
        .ba-live { background: #141827; color: #fff; }
        .ba-live small { color: #a5adc6; }
        .ba-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #2ee67c; margin-right: 6px; animation: ba-pulse 1.4s ease-in-out infinite; }
        @keyframes ba-pulse { 50% { opacity: .3; } }
        .ba-countries { grid-column: span 2; grid-row: span 2; gap: 6px; }
        .ba-c { display: grid; grid-template-columns: 70px 1fr 34px; align-items: center; gap: 8px; }
        .ba-c i { height: 8px; border-radius: 4px; background: #eef0f4; overflow: hidden; }
        .ba-c i::after { content: ''; display: block; height: 100%; width: var(--w); background: var(--accent); border-radius: inherit; }
        .ba-goal { grid-row: span 2; align-items: center; justify-content: center; text-align: center; }
        .ba-goal svg { transform: rotate(-90deg); }
        .ba-toast { position: absolute; right: 20px; bottom: 18px; background: #141827; color: #fff; padding: 8px 12px; border-radius: 10px; font-weight: 600; }
        @container (max-width: 680px) { .ba-wrap { grid-template-columns: 1fr; } .ba-rail { display: none; } .ba-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      <nav className="ba-rail" aria-label="Dashboards">
        <i />
        {RAIL.map(([l, ic], n) => <button key={l} aria-label={l} title={l} aria-current={n === board ? 'page' : undefined} onClick={() => setBoard(n)}><Icon d={ic} size={18} /></button>)}
      </nav>

      <main className="ba-main" style={{ position: 'relative' }}>
        <div className="ba-head">
          <h2>{RAIL[board][0]}</h2>
          <div className="ba-range" role="group" aria-label="Date range">
            {RANGES.map((r) => <button key={r} aria-pressed={r === range} onClick={() => setRange(r)}>{r}</button>)}
          </div>
        </div>

        <div className="ba-grid">
          {tile('revenue', '', <><small>Revenue</small><b className="kpi">${fmt(d.rev)}</b><span className="ba-up">▲ 12.4%</span></>)}
          {tile('orders', '', <><small>Orders</small><b className="kpi">{fmt(d.orders)}</b><span className="ba-up">▲ 6.1%</span></>)}
          {tile('conversion', '', <><small>Conversion</small><b className="kpi">{d.conv}%</b><span className="ba-up">▲ 0.3 pts</span></>)}
          {tile('live', 'ba-live', <><small><span className="ba-dot" />Live now</small><b className="kpi">{Math.round(d.orders / 9) + 41}</b><small>visitors on site</small></>)}
          {tile('chart', 'ba-chart', <><small>Revenue · {range}</small><div className="ba-bars">{d.bars.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div></>)}
          {tile('funnel', 'ba-funnel', <><small>Funnel</small>{['Visits', 'Product', 'Cart', 'Paid'].map((s, i) => (
            <div key={s} className="ba-step"><span>{s}</span><i style={{ width: `${(d.funnel[i] / d.funnel[0]) * 100}%`, '--o': 1 - i * 0.2 }} /><b>{fmt(d.funnel[i])}</b></div>
          ))}</>)}
          {tile('countries', 'ba-countries', <><small>Top countries</small>{COUNTRIES.map(([c, v]) => <div key={c} className="ba-c"><span>{c}</span><i style={{ '--w': `${v * 250}%` }} /><b>{Math.round(v * 100)}%</b></div>)}</>)}
          {tile('goal', 'ba-goal', <>
            <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
              <circle cx="48" cy="48" r={R} fill="none" stroke="#eef0f4" strokeWidth="10" />
              <circle cx="48" cy="48" r={R} fill="none" stroke={accent} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${Math.min(1, d.goal) * C} ${C}`} style={{ transition: 'stroke-dasharray 500ms' }} />
            </svg>
            <b style={{ fontSize: 18 }}>{Math.round(d.goal * 100)}%</b><small>of {range.toLowerCase()} goal</small>
          </>)}
          {tile('aov', '', <><small>Avg. order</small><b className="kpi">${d.aov}</b><span className="ba-up">▲ 2.0%</span></>)}
        </div>
        {toast && <div className="ba-toast" role="status">{toast} · CSV</div>}
      </main>
    </div>
  )
}
