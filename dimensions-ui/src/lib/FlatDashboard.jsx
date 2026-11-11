import { useState } from 'react'

// Flat UI analytics dashboard: solid colour panels, no gradients or shadows.
// A dark sidebar with flat icons, a brand-coloured top bar with tab pills,
// and colour-block KPI tiles over a flat bar chart.

const NAV = [
  ['Overview', 'M3 10h4v7H3zM8 4h4v13H8zM13 7h4v10h-4z'],
  ['Revenue', 'M3 15l4-5 3 3 7-8M13 5h4v4'],
  ['Customers', 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17c0-3 2.2-5 5-5s5 2 5 5M13.5 9a2.5 2.5 0 1 0 0-5M14 12c2 .4 4 2 4 5'],
  ['Orders', 'M3 4h2l2 9h9l2-6H6M8 17h.01M15 17h.01'],
  ['Settings', 'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8'],
]

const TABS = ['Today', 'Week', 'Month', 'Year']

const DATA = {
  Today: { kpi: ['$4.2k', '128', '3.4%', '12'], bars: [30, 45, 38, 60, 52, 70, 64, 82] },
  Week: { kpi: ['$31k', '904', '3.1%', '67'], bars: [55, 62, 48, 70, 66, 74, 90, 58] },
  Month: { kpi: ['$128k', '3.6k', '2.9%', '240'], bars: [40, 52, 61, 58, 72, 80, 76, 94] },
  Year: { kpi: ['$1.4m', '41k', '3.3%', '2.8k'], bars: [62, 58, 70, 74, 69, 81, 88, 96] },
}

const LABELS = ['Revenue', 'Orders', 'Conversion', 'Refunds']

const RECENT = [
  ['Order #4821', '$240', 0],
  ['Order #4820', '$89', 1],
  ['Refund #311', '−$32', 3],
  ['Order #4819', '$150', 0],
]

const Icon = ({ d }) => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

export default function FlatDashboard({
  brand = '#2f6bff',
  sidebar = '#16224a',
  kpiColors = '#2f6bff, #12b886, #f59f00, #f03e3e',
  radius = 6,
  style,
}) {
  const [nav, setNav] = useState(0)
  const [tab, setTab] = useState(1)
  const colors = kpiColors.split(',').map((c) => c.trim())
  const d = DATA[TABS[tab]]

  return (
    <div className="fd-wrap" style={{ '--brand': brand, '--side': sidebar, '--r': `${radius}px`, ...style }}>
      <div className="fd">
      <style>{`
        .fd-wrap { container-type: inline-size; width: 100%; height: 100%; }
        .fd { display: grid; grid-template-columns: 188px 1fr; width: 100%; height: 100%; background: #eef1f6; color: #16224a; font: 400 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; overflow: hidden; }
        .fd * { box-sizing: border-box; }
        .fd button { font: inherit; cursor: pointer; border: 0; }
        .fd-side { background: var(--side); color: #c9d3f5; padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; }
        .fd-logo { color: #fff; font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px; padding: 2px 8px 16px; }
        .fd-logo i { width: 18px; height: 18px; background: var(--brand); border-radius: 4px; display: block; }
        .fd-nav { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: var(--r); background: transparent; color: inherit; text-align: left; }
        .fd-nav:hover { color: #fff; }
        .fd-nav[aria-current='page'] { background: color-mix(in srgb, var(--brand) 55%, var(--side)); color: #fff; }
        .fd-main { display: grid; grid-template-rows: auto auto 1fr; min-width: 0; }
        .fd-top { background: var(--brand); color: #fff; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 18px; }
        .fd-top h2 { margin: 0; font-size: 16px; font-weight: 700; }
        .fd-tabs { display: flex; gap: 2px; }
        .fd-tab { padding: 6px 12px; border-radius: 999px; background: transparent; color: #fff; font-weight: 600; }
        .fd-tab[aria-selected='true'] { background: #fff; color: var(--brand); }
        .fd-btn { background: var(--brand); color: #fff; font-weight: 600; padding: 8px 14px; border-radius: var(--r); transition: background 120ms; }
        .fd-btn:hover { background: color-mix(in srgb, var(--brand), black 18%); }
        .fd-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 14px 18px 0; }
        .fd-kpi { color: #fff; border-radius: var(--r); padding: 12px 14px; }
        .fd-kpi span { display: block; font-size: 12px; opacity: .85; }
        .fd-kpi b { display: block; font-size: 22px; font-weight: 800; margin-top: 4px; }
        .fd-row { display: grid; grid-template-columns: 1.7fr 1fr; gap: 12px; padding: 12px 18px 16px; min-height: 0; }
        .fd-panel { background: #fff; border-radius: var(--r); padding: 14px; display: flex; flex-direction: column; min-height: 0; }
        .fd-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .fd-head h3 { margin: 0; font-size: 14px; }
        .fd-bars { flex: 1; display: flex; align-items: flex-end; gap: 8px; min-height: 60px; border-bottom: 2px solid #e3e8f2; }
        .fd-bar { flex: 1; background: var(--brand); border-radius: 3px 3px 0 0; transition: height 300ms ease; }
        .fd-bar:last-child { background: #f59f00; }
        .fd-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        .fd-list li { display: flex; align-items: center; gap: 10px; }
        .fd-list i { width: 10px; height: 10px; border-radius: 2px; flex: none; }
        .fd-list span { flex: 1; }
        .fd-list b { font-weight: 700; }
        @container (max-width: 760px) {
          .fd { grid-template-columns: 56px 1fr; }
          .fd-side .fd-label, .fd-logo span { display: none; }
          .fd-nav { justify-content: center; padding: 10px 0; }
          .fd-logo { justify-content: center; padding: 2px 0 16px; }
          .fd-row { grid-template-columns: 1fr; }
          .fd-row .fd-panel:last-child { display: none; }
        }
        @container (max-width: 560px) {
          .fd-kpis { grid-template-columns: repeat(2, 1fr); }
          .fd-top { flex-wrap: wrap; }
          .fd-top h2 { display: none; }
          .fd-tab { padding: 6px 9px; }
        }
      `}</style>

      <aside className="fd-side">
        <div className="fd-logo"><i /><span>Flatline</span></div>
        {NAV.map(([label, d], i) => (
          <button key={label} className="fd-nav" aria-current={i === nav ? 'page' : undefined} title={label} onClick={() => setNav(i)}>
            <Icon d={d} />
            <span className="fd-label">{label}</span>
          </button>
        ))}
      </aside>

      <main className="fd-main">
        <header className="fd-top">
          <h2>{NAV[nav][0]}</h2>
          <div className="fd-tabs" role="tablist">
            {TABS.map((t, i) => (
              <button key={t} role="tab" className="fd-tab" aria-selected={i === tab} onClick={() => setTab(i)}>{t}</button>
            ))}
          </div>
        </header>

        <section className="fd-kpis">
          {LABELS.map((label, i) => (
            <div key={label} className="fd-kpi" style={{ background: colors[i % colors.length] }}>
              <span>{label}</span>
              <b>{d.kpi[i]}</b>
            </div>
          ))}
        </section>

        <section className="fd-row">
          <div className="fd-panel">
            <div className="fd-head">
              <h3>Revenue by week</h3>
              <button className="fd-btn">Export</button>
            </div>
            <div className="fd-bars">
              {d.bars.map((h, i) => <div key={i} className="fd-bar" style={{ height: `${h}%` }} />)}
            </div>
          </div>
          <div className="fd-panel">
            <div className="fd-head"><h3>Recent</h3></div>
            <ul className="fd-list">
              {RECENT.map(([name, amount, c]) => (
                <li key={name}>
                  <i style={{ background: colors[c % colors.length] }} />
                  <span>{name}</span>
                  <b>{amount}</b>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      </div>
    </div>
  )
}
