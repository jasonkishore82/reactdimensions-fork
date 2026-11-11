import { useRef, useState } from 'react'
import { useOnScreen } from '../ui/onscreen.js'

// Glassmorphism banking app on a near-black canvas lit by two slow light
// leaks (amber and teal) instead of the usual purple orbs. A frosted balance
// card with a sparkline, a glass bank card you can reveal or freeze, glass
// action tiles, a floating nav pill and an icon rail that opens on hover.

const RAIL = [
  ['Home', 'M3 10l7-6 7 6v7H3zM8 17v-5h4v5'],
  ['Cards', 'M2.5 5h15v10h-15zM2.5 8.5h15M5 12.5h3'],
  ['Activity', 'M2.5 10h3l2-5 3 10 2-5h5'],
  ['Settings', 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4'],
]
const TABS = ['Overview', 'Cards', 'Activity']
const ACTIVITY = [
  ['Corner Bakery', 'Food', -6.4, 'B'],
  ['Salary · Northwind', 'Income', 3240, 'N'],
  ['Metro card', 'Transport', -25, 'M'],
  ['Record Store', 'Shopping', -38.5, 'R'],
  ['Rent', 'Home', -1150, 'H'],
  ['Refund · Camera Co.', 'Income', 89, 'C'],
]
const SPARK = [42, 48, 45, 53, 50, 61, 58, 66, 63, 72, 70, 78]

const Icon = ({ d, size = 18 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)
const money = (v) => `${v < 0 ? '−' : '+'}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function GlassFinance({ blur = 20, frost = 0.08, glowA = '#ffb547', glowB = '#2dd4bf', style }) {
  const root = useRef(null)
  const visible = useOnScreen(root)
  const [tab, setTab] = useState(0)
  const [rail, setRail] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [frozen, setFrozen] = useState(false)
  const [sent, setSent] = useState(null)

  const Card = ({ big }) => (
    <div className={`gf-card gf-glass${big ? ' big' : ''}${frozen ? ' frozen' : ''}`}>
      <div className="gf-card-top"><b>Glassbank</b><span>{frozen ? 'Frozen' : 'Debit'}</span></div>
      <i className="gf-chip" />
      <div className="gf-num">{reveal ? '4026 1180 7742 5319' : '•••• •••• •••• 5319'}</div>
      <div className="gf-card-bot"><span>ALEX MORGAN</span><span>09/29</span></div>
    </div>
  )

  return (
    <div ref={root} className="gf-wrap" data-paused={visible ? undefined : ''} style={{ '--blur': `${blur}px`, '--frost': frost, '--ga': glowA, '--gb': glowB, ...style }}>
      <style>{`
        .gf-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; background: #07090f; color: #f2f4f8; font: 400 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.gf-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .gf-leak { position: absolute; width: 70%; height: 46%; border-radius: 50%; filter: blur(70px); opacity: .55; pointer-events: none; }
        .gf-leak.a { background: var(--ga); left: -12%; top: -14%; animation: gf-a 16s ease-in-out infinite alternate; }
        .gf-leak.b { background: var(--gb); right: -16%; bottom: -12%; animation: gf-b 20s ease-in-out infinite alternate; }
        .gf-grain { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px); background-size: 3px 3px; pointer-events: none; }
        @keyframes gf-a { to { transform: translate(18%, 22%) rotate(12deg); } }
        @keyframes gf-b { to { transform: translate(-20%, -18%) rotate(-10deg); } }
        .gf-glass { background: rgba(255,255,255,var(--frost)); border: 1px solid rgba(255,255,255,.14); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); -webkit-backdrop-filter: blur(var(--blur)) saturate(160%); backdrop-filter: blur(var(--blur)) saturate(160%); }
        .gf { position: relative; height: 100%; display: grid; grid-template-columns: 64px 1fr; }
        .gf-rail { margin: 12px 0 12px 12px; border-radius: 18px; padding: 10px 8px; display: flex; flex-direction: column; gap: 6px; width: 52px; overflow: hidden; transition: width 240ms ease; z-index: 3; }
        .gf-rail:hover { width: 150px; }
        .gf-rail-btn { display: flex; align-items: center; gap: 12px; padding: 9px 9px; border-radius: 12px; white-space: nowrap; color: rgba(242,244,248,.65); }
        .gf-rail-btn:hover { color: #fff; }
        .gf-rail-btn[aria-current='page'] { background: rgba(255,255,255,.12); color: #fff; }
        .gf-rail-btn svg { flex: none; }
        .gf-rail-btn span { opacity: 0; transition: opacity 200ms; }
        .gf-rail:hover .gf-rail-btn span { opacity: 1; }
        .gf-logo { width: 34px; height: 34px; margin: 0 0 8px 0; border-radius: 10px; background: linear-gradient(135deg, var(--ga), var(--gb)); }
        .gf-main { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; overflow: auto; }
        .gf-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .gf-head h2 { margin: 0; font-size: 18px; font-weight: 600; }
        .gf-head small { color: rgba(242,244,248,.6); }
        .gf-pill { position: relative; display: grid; grid-template-columns: repeat(3, 84px); padding: 4px; border-radius: 999px; }
        .gf-pill button { position: relative; z-index: 1; padding: 7px 0; font-weight: 600; font-size: 12px; color: rgba(242,244,248,.7); }
        .gf-pill button[aria-selected='true'] { color: #0b0d14; }
        .gf-pill i { position: absolute; top: 4px; bottom: 4px; left: 4px; width: 84px; border-radius: 999px; background: #f2f4f8; transition: transform 300ms cubic-bezier(.3,1.3,.5,1); }
        .gf-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 12px; }
        .gf-panel { border-radius: 20px; padding: 14px; }
        .gf-bal small { color: rgba(242,244,248,.6); text-transform: uppercase; letter-spacing: .12em; font-size: 10px; }
        .gf-bal b { display: block; font-size: 30px; font-weight: 600; letter-spacing: -0.02em; margin: 2px 0; font-variant-numeric: tabular-nums; }
        .gf-bal .gf-delta { font-style: normal; color: var(--gb); font-weight: 600; font-size: 12px; }
        .gf-spark { width: 100%; height: 56px; margin-top: 8px; overflow: visible; }
        .gf-card { position: relative; border-radius: 18px; padding: 14px; aspect-ratio: 1.6; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.04)); overflow: hidden; transition: filter 300ms; }
        .gf-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 40%, rgba(255,255,255,.18) 50%, transparent 60%); pointer-events: none; }
        .gf-card.frozen { filter: grayscale(1) brightness(.75); }
        .gf-card-top { display: flex; justify-content: space-between; align-items: center; }
        .gf-card-top span { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; opacity: .7; }
        .gf-chip { width: 32px; height: 24px; border-radius: 5px; background: linear-gradient(135deg, #f7d58b, #c9a253); }
        .gf-num { font: 600 15px/1 ui-monospace, Menlo, monospace; letter-spacing: .06em; }
        .gf-card-bot { display: flex; justify-content: space-between; font-size: 10.5px; letter-spacing: .1em; opacity: .8; }
        .gf-card-actions { display: flex; gap: 8px; margin-top: 10px; }
        .gf-small { border-radius: 10px; padding: 6px 10px; font-weight: 600; font-size: 12px; }
        .gf-small:hover { background: rgba(255,255,255,.16); }
        .gf-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .gf-act { border-radius: 16px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; font-weight: 600; font-size: 12px; transition: transform 120ms, background 150ms; }
        .gf-act:hover { transform: translateY(-2px); background: rgba(255,255,255,.14); }
        .gf-act i { width: 34px; height: 34px; border-radius: 12px; display: grid; place-items: center; color: #0b0d14; }
        .gf-list { display: grid; gap: 4px; }
        .gf-row { display: grid; grid-template-columns: 30px 1fr auto; gap: 10px; align-items: center; padding: 6px 4px; border-radius: 10px; }
        .gf-row i { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-style: normal; font-weight: 700; background: rgba(255,255,255,.1); }
        .gf-row small { display: block; color: rgba(242,244,248,.55); font-size: 11px; }
        .gf-row b { font-variant-numeric: tabular-nums; font-weight: 600; }
        .gf-row b.in { color: var(--gb); }
        .gf-toast { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); border-radius: 999px; padding: 8px 14px; font-weight: 600; z-index: 4; }
        @container (max-width: 640px) { .gf-grid { grid-template-columns: 1fr; } .gf { grid-template-columns: 1fr; } .gf-rail { display: none; } .gf-pill { grid-template-columns: repeat(3, 76px); } .gf-pill i { width: 76px; } }
        @media (prefers-reduced-motion: reduce) { .gf-wrap * { animation: none !important; } }
        .gf-wrap[data-paused] * { animation-play-state: paused !important; }
      `}</style>

      <div className="gf-leak a" aria-hidden="true" />
      <div className="gf-leak b" aria-hidden="true" />
      <div className="gf-grain" aria-hidden="true" />

      <div className="gf">
        <nav className="gf-rail gf-glass" aria-label="Main">
          <div className="gf-logo" />
          {RAIL.map(([label, d], n) => (
            <button key={label} className="gf-rail-btn" aria-current={n === rail ? 'page' : undefined} onClick={() => { setRail(n); if (n < 3) setTab(n) }}>
              <Icon d={d} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <main className="gf-main">
          <header className="gf-head">
            <div><small>Good evening</small><h2>Alex Morgan</h2></div>
            <div className="gf-pill gf-glass" role="tablist">
              <i style={{ transform: `translateX(${tab * 100}%)` }} />
              {TABS.map((x, n) => <button key={x} role="tab" aria-selected={n === tab} onClick={() => { setTab(n); setRail(n) }}>{x}</button>)}
            </div>
          </header>

          {tab === 0 && (
            <div className="gf-grid">
              <section className="gf-panel gf-glass gf-bal">
                <small>Total balance</small>
                <b>$12,480.36</b>
                <span className="gf-delta">▲ 4.2% this month</span>
                <svg className="gf-spark" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
                  <defs><linearGradient id="gf-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={glowB} stopOpacity=".35" /><stop offset="1" stopColor={glowB} stopOpacity="0" /></linearGradient></defs>
                  <polygon points={`0,60 ${SPARK.map((v, i) => `${(i / (SPARK.length - 1)) * 100},${60 - (v - 35) * 1.2}`).join(' ')} 100,60`} fill="url(#gf-fill)" />
                  <polyline points={SPARK.map((v, i) => `${(i / (SPARK.length - 1)) * 100},${60 - (v - 35) * 1.2}`).join(' ')} fill="none" stroke={glowB} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
                </svg>
              </section>
              <section>
                <Card />
              </section>
              <section className="gf-actions" style={{ gridColumn: '1 / -1' }}>
                {[['Send', glowA, 'M3 10h12M11 5l5 5-5 5'], ['Request', glowB, 'M17 10H5M9 5l-5 5 5 5'], ['Top up', '#f2f4f8', 'M10 4v12M4 10h12']].map(([label, c, d]) => (
                  <button key={label} className="gf-act gf-glass" onClick={() => { setSent(label); setTimeout(() => setSent(null), 1400) }}>
                    <i style={{ background: c }}><Icon d={d} /></i>{label}
                  </button>
                ))}
              </section>
            </div>
          )}

          {tab === 1 && (
            <div className="gf-grid">
              <section><Card big />
                <div className="gf-card-actions">
                  <button className="gf-small gf-glass" onClick={() => setReveal(!reveal)}>{reveal ? 'Hide number' : 'Show number'}</button>
                  <button className="gf-small gf-glass" aria-pressed={frozen} onClick={() => setFrozen(!frozen)}>{frozen ? 'Unfreeze' : 'Freeze card'}</button>
                </div>
              </section>
              <section className="gf-panel gf-glass gf-bal">
                <small>Spent this month</small>
                <b>$1,219.90</b>
                <span className="gf-delta" style={{ color: glowA }}>of $2,000 limit</span>
                <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,.12)', marginTop: 12, overflow: 'hidden' }}>
                  <div style={{ width: '61%', height: '100%', background: `linear-gradient(90deg, ${glowB}, ${glowA})` }} />
                </div>
              </section>
            </div>
          )}

          {tab === 2 && (
            <section className="gf-panel gf-glass gf-list">
              {ACTIVITY.map(([name, cat, v, l]) => (
                <div key={name} className="gf-row">
                  <i>{l}</i>
                  <span>{name}<small>{cat}</small></span>
                  <b className={v > 0 ? 'in' : ''}>{money(v)}</b>
                </div>
              ))}
            </section>
          )}
        </main>
      </div>

      {sent && <div className="gf-toast gf-glass" role="status">{sent} · opening…</div>}
    </div>
  )
}
