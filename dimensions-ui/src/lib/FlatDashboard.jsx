import { useState } from 'react'

// Flat UI commerce dashboard: soft grey-blue canvas, white panels, one blue accent.
// Light sidebar with a pill nav, search + sales chart in the centre, and an
// activity rail on the right. No gradients, no shadows.

const NAV = [
  ['Dashboard', 'M3 10h4v7H3zM8 4h4v13H8zM13 7h4v10h-4z'],
  ['Products', 'M10 2l7 4v8l-7 4-7-4V6zM3 6l7 4 7-4M10 10v8'],
  ['Funnels', 'M3 4h14l-5 6v6l-4-2v-4z'],
  ['Orders', 'M3 4h2l2 9h9l2-6H6M8 17h.01M15 17h.01'],
  ['Membership', 'M3 5h14v10H3zM6 9h4M6 12h7'],
  ['Content', 'M5 2h7l4 4v12H5zM12 2v4h4M8 10h5M8 13h5'],
  ['Settings', 'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8'],
]

const RANGES = ['Last year', 'Last 6 months', 'Last 30 days']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// [previous, current] heights in %
const SERIES = {
  'Last year': {
    total: '$549,735.00', delta: '$15,686.65',
    bars: [[38, 48], [46, 66], [70, 100], [48, 72], [66, 88], [52, 64], [36, 46], [60, 70], [74, 92], [40, 60], [22, 34], [14, 24]],
  },
  'Last 6 months': {
    total: '$312,408.00', delta: '$9,120.40',
    bars: [[52, 70], [40, 58], [64, 90], [44, 62], [58, 80], [34, 52], [48, 66], [60, 84], [42, 60], [56, 76], [30, 48], [26, 40]],
  },
  'Last 30 days': {
    total: '$48,210.00', delta: '$2,310.10',
    bars: [[30, 42], [44, 60], [38, 54], [56, 74], [50, 70], [62, 88], [46, 64], [58, 80], [40, 58], [66, 92], [52, 72], [36, 50]],
  },
}

const STATS = [
  ['Daily Visitors', '31,512', '27%', true, 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c0-3.3 2.7-5 6-5s6 1.7 6 5'],
  ['Total Orders', '23,50', '47%', true, 'M4 6h12l-1 11H5zM7 6a3 3 0 0 1 6 0'],
  ['Conversion Rate', '10.5%', '32%', true, 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17c0-3 2.2-5 5-5s5 2 5 5M13.5 9a2.5 2.5 0 1 0 0-5M14 12c2 .4 4 2 4 5'],
  ['Average Orders', '11,654', '34%', false, 'M3 4h2l2 9h9l2-6H6M8 17h.01M15 17h.01'],
]

const FUNNELS = [
  { name: 'iPhone XR 256 GB', sub: 'iPhone XR Black', orders: 10, inv: '573', price: '$ 2,318.90', sale: '$ 3,318.90', today: '$ 7,318.90', swatch: '#8fd6b0' },
  { name: 'iPhone XR 256 GB', sub: 'iPhone XR Black', orders: 20, inv: '453', price: '$ 4,338', sale: '$ 3,318.90', today: '$ 6,638.12', swatch: '#2b2f3a' },
]

const CHANNELS = [
  ['Direct', '$1,24,685', 65.6, 66, true],
  ['Organic Search', '$1,24,685', 45.2, 45, true],
  ['Referral', '$1,24,685', 15.6, 16, false],
  ['Social', '$1,24,685', 25.2, 25, false],
]

const SPARK = Array.from({ length: 46 }, (_, i) => {
  const v = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1
  return Math.round(18 + v * 50 + (i % 7 === 3 ? 28 : 0))
})

const Bench = () => (
  <svg viewBox="0 0 170 150" width="100%" style={{ maxHeight: 150 }} fill="none" stroke="#1b2240" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 140V92M30 140V100M18 98h70M24 80h12M18 80v18" />
    <path d="M42 98h58" />
    <rect x="40" y="46" width="30" height="40" rx="14" fill="#1b2240" />
    <circle cx="58" cy="32" r="12" fill="#fff" />
    <path d="M46 28c2-12 22-14 26-2" fill="#1b2240" />
    <path d="M52 84l36 6 18 26-6 12M70 86l-8 22 20 10" fill="#fff" />
    <path d="M100 118l22 12M96 72l26-8-4 14-24 6z" fill="#4f6ef0" stroke="#4f6ef0" />
    <path d="M12 60c4-4 8 4 12 0M126 94c4-4 8 4 12 0" />
  </svg>
)

const Icon = ({ d, size = 18 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

export default function FlatDashboard({
  brand = '#3b72f0',
  sidebar = '#f4f6fa',
  radius = 8,
  style,
}) {
  const [nav, setNav] = useState(0)
  const [range, setRange] = useState(0)
  const s = SERIES[RANGES[range]]

  return (
    <div className="fd-wrap" style={{ '--brand': brand, '--side': sidebar, '--r': `${radius}px`, ...style }}>
      <div className="fd">
      <style>{`
        .fd-wrap { container-type: inline-size; width: 100%; height: 100%; }
        .fd { display: grid; grid-template-columns: minmax(150px, 18%) minmax(0, 1fr) minmax(230px, 25%); width: 100%; height: 100%; background: #f5f7fb; color: #2a3350; font: 400 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; overflow: hidden; }
        .fd * { box-sizing: border-box; }
        .fd button, .fd input { font: inherit; }
        .fd button { cursor: pointer; border: 0; }
        .fd-muted { color: #8a93ab; }
        .fd-up { color: #12a150; }
        .fd-down { color: #e5484d; }

        .fd-side { background: var(--side); display: flex; flex-direction: column; min-height: 0; }
        .fd-top { padding: 20px 14px 0 24px; flex: none; }
        .fd-logo { background: #fff; border-radius: var(--r); margin-bottom: 28px; padding: 14px 14px; display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; color: #1b2240; }
        .fd-logo i { width: 24px; height: 24px; border-radius: 50%; background: var(--brand); display: grid; place-items: center; color: #fff; font-style: normal; font-size: 12px; font-weight: 800; }
        .fd-navs { display: flex; flex-direction: column; gap: 10px; padding: 0 14px 22px 24px; flex: 1; min-height: 0; overflow: hidden; }
        .fd-nav { position: relative; display: flex; align-items: center; gap: 14px; padding: 11px 14px; border-radius: var(--r); background: transparent; color: #8a93ab; text-align: left; font-weight: 500; font-size: 11px; transition: background 120ms, color 120ms; }
        .fd-nav:hover { color: #2a3350; }
        .fd-nav[aria-current='page'] { background: var(--brand); color: #fff; font-weight: 600; box-shadow: 0 8px 16px -4px color-mix(in srgb, var(--brand) 45%, transparent); }
        .fd-nav[aria-current='page']::before { content: ''; position: absolute; left: -24px; top: -4px; bottom: -4px; width: 3px; background: var(--brand); }
        .fd-bottom { background: #eef1f8; padding: 18px 14px 18px 24px; display: flex; flex-direction: column; gap: 16px; align-items: stretch; flex: none; }
        .fd-upgrade { background: var(--brand); color: #fff; font-weight: 700; font-size: 10px; letter-spacing: .03em; padding: 12px 8px; border-radius: var(--r); text-transform: uppercase; box-shadow: 0 8px 16px -4px color-mix(in srgb, var(--brand) 45%, transparent); }
        .fd-upgrade:hover { background: color-mix(in srgb, var(--brand), black 12%); }

        .fd-main { background: #fff; padding: 22px 24px; overflow: hidden; display: flex; flex-direction: column; gap: 18px; min-width: 0; min-height: 0; }
        .fd-search { display: flex; align-items: center; gap: 10px; background: #f1f4f9; border-radius: var(--r); padding: 0 14px; height: 38px; color: #8a93ab; flex: none; }
        .fd-search input { flex: 1; min-width: 0; background: transparent; border: 0; outline: 0; color: #2a3350; }
        .fd-search input::placeholder { color: #8a93ab; }

        .fd-sales { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex: none; }
        .fd-eyebrow { font-size: 12px; letter-spacing: .02em; text-transform: uppercase; color: #6b7590; }
        .fd-total { font-size: 22px; font-weight: 800; color: #1b2240; margin-top: 2px; }
        .fd-delta { font-size: 12px; font-weight: 700; margin-top: 2px; }
        .fd-select { background: #e8effd; color: var(--brand); font-weight: 600; font-size: 11px; text-transform: uppercase; padding: 9px 12px; border-radius: var(--r); display: flex; align-items: center; gap: 8px; }

        .fd-chart { flex: 1; min-height: 90px; display: grid; grid-template-rows: 1fr auto; gap: 8px; }
        .fd-bars { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; align-items: end; min-height: 0; }
        .fd-pair { display: flex; align-items: flex-end; justify-content: center; height: 100%; }
        .fd-bar { width: 40%; max-width: 18px; border-radius: 3px; transition: height 300ms ease; }
        .fd-bar.prev { background: #f3f5f9; width: 50%; max-width: 26px; margin-right: -10px; }
        .fd-bar.cur { background: var(--brand); }
        .fd-months { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; text-align: center; font-size: 10px; color: #8a93ab; }

        .fd-sec { font-size: 11px; letter-spacing: .03em; text-transform: uppercase; color: #6b7590; margin: 0 0 10px; font-weight: 500; }
        .fd-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; flex: none; }
        .fd-stat { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .fd-chip { width: 42px; height: 42px; border-radius: 12px; background: #f1f4f9; color: var(--brand); display: grid; place-items: center; flex: none; }
        .fd-stat span { display: block; font-size: 11px; color: #8a93ab; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fd-stat b { font-size: 16px; font-weight: 600; color: #1b2240; margin-right: 4px; }
        .fd-stat small { font-size: 9px; font-weight: 700; }

        .fd-table { display: grid; gap: 8px; flex: none; }
        .fd-row { display: grid; grid-template-columns: 1.6fr repeat(4, 1fr); align-items: center; gap: 8px; background: #f6f8fb; border-radius: var(--r); padding: 12px 14px; }
        .fd-prod { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .fd-thumb { width: 22px; height: 34px; border-radius: 4px; flex: none; }
        .fd-prod a { color: var(--brand); font-weight: 600; font-size: 13px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fd-prod small { color: #8a93ab; font-size: 11px; white-space: nowrap; }
        .fd-cell span { display: block; font-size: 11px; color: #8a93ab; }
        .fd-cell b { font-size: 12px; font-weight: 600; color: #1b2240; white-space: nowrap; }

        .fd-rail { padding: 22px 22px 22px 20px; display: flex; flex-direction: column; gap: 16px; min-width: 0; min-height: 0; overflow: hidden; }
        .fd-who { display: flex; justify-content: flex-end; align-items: center; gap: 16px; color: #8a93ab; flex: none; height: 38px; }
        .fd-av { width: 30px; height: 30px; border-radius: 50%; background: #f4b6a6; border: 3px solid #fff; display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #7a2e1d; }
        .fd-actrow { display: flex; justify-content: space-between; align-items: center; flex: none; }
        .fd-pill { background: #fff; border-radius: var(--r); padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #6b7590; display: flex; gap: 8px; align-items: center; }
        .fd-live { background: var(--brand); color: #fff; border-radius: var(--r); padding: 14px 14px 12px; flex: none; }
        .fd-live p { margin: 0; font-size: 12px; opacity: .92; }
        .fd-live strong { display: block; font-size: 18px; font-weight: 600; margin: 8px 0 2px; }
        .fd-spark { display: flex; align-items: flex-end; gap: 2px; height: 44px; margin: 10px 0 14px; }
        .fd-spark i { flex: 1; background: rgba(255,255,255,.55); border-radius: 1px; }
        .fd-bg { display: none; }
        .fd-live button { background: transparent; color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 0; display: block; margin-left: auto; }
        .fd-card { background: #fff; border-radius: var(--r); padding: 14px; flex: none; }
        .fd-card .fd-badge { width: 28px; height: 28px; border-radius: 50%; background: #2bd4a4; color: #fff; display: grid; place-items: center; font-size: 10px; font-weight: 700; margin-bottom: 8px; }
        .fd-card h4 { margin: 0 0 4px; font-size: 13px; font-weight: 500; }
        .fd-card p { margin: 0 0 12px; font-size: 11px; font-weight: 500; color: #3a4260; }
        .fd-card-foot { display: flex; justify-content: space-between; align-items: center; font-size: 10px; text-transform: uppercase; color: var(--brand); font-weight: 600; }
        .fd-card-foot button { background: #e8effd; color: var(--brand); font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 8px 10px; border-radius: var(--r); }
        .fd-chan { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
        .fd-chan li > div { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin-bottom: 6px; }
        .fd-chan li > div b { font-weight: 500; color: #1b2240; }
        .fd-track { height: 2px; background: #dfe5f0; }
        .fd-track i { display: block; height: 100%; background: var(--brand); }

        @container (max-width: 1040px) {
          .fd { grid-template-columns: 56px minmax(0, 1fr); }
          .fd-rail { display: none; }
          .fd-top { padding: 14px 8px 0; }
          .fd-navs { padding: 0 8px; }
          .fd-side .fd-label, .fd-logo span { display: none; }
          .fd-logo { justify-content: center; padding: 8px 0; margin-bottom: 18px; }
          .fd-nav { justify-content: center; padding: 10px 0; }
          .fd-nav[aria-current='page']::before { left: -8px; }
          .fd-bottom { display: none; }
        }
        @container (max-width: 700px) {
          .fd-main { padding: 16px; gap: 14px; }
          .fd-stats { grid-template-columns: repeat(2, 1fr); }
          .fd-row { grid-template-columns: 1.4fr 1fr 1fr; }
          .fd-row .fd-cell:nth-of-type(n+3) { display: none; }
        }
        @container (max-width: 480px) {
          .fd { grid-template-columns: 1fr; }
          .fd-side { display: none; }
          .fd-table { display: none; }
        }
      `}</style>

      <aside className="fd-side">
        <div className="fd-top">
          <div className="fd-logo"><i>C</i><span>Commerce</span></div>
        </div>
        <div className="fd-navs">
          {NAV.map(([label, d], i) => (
            <button key={label} className="fd-nav" aria-current={i === nav ? 'page' : undefined} title={label} onClick={() => setNav(i)}>
              <Icon d={d} size={16} />
              <span className="fd-label">{label}</span>
            </button>
          ))}
        </div>
        <div className="fd-bottom">
          <Bench />
          <button className="fd-upgrade">Upgrade your plan</button>
        </div>
      </aside>

      <main className="fd-main">
        <label className="fd-search">
          <Icon d="M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12zM14 14l4 4" size={16} />
          <input placeholder="Search..." aria-label="Search" />
        </label>

        <div className="fd-sales">
          <div>
            <div className="fd-eyebrow">Total sales</div>
            <div className="fd-total">{s.total}</div>
            <div className="fd-delta fd-up">↑ {s.delta}</div>
          </div>
          <button className="fd-select" onClick={() => setRange((range + 1) % RANGES.length)} title="Change range">
            {RANGES[range]} <span aria-hidden="true" style={{ fontSize: 8 }}>▼</span>
          </button>
        </div>

        <div className="fd-chart">
          <div className="fd-bars">
            {s.bars.map(([p, c], i) => (
              <div key={i} className="fd-pair">
                <div className="fd-bar prev" style={{ height: `${p}%` }} />
                <div className="fd-bar cur" style={{ height: `${c}%` }} />
              </div>
            ))}
          </div>
          <div className="fd-months">{MONTHS.map((m) => <span key={m}>{m}</span>)}</div>
        </div>

        <div>
          <h3 className="fd-sec">Growing at superhuman rate</h3>
          <div className="fd-stats">
            {STATS.map(([label, value, pct, up, icon]) => (
              <div key={label} className="fd-stat">
                <div className="fd-chip"><Icon d={icon} /></div>
                <div style={{ minWidth: 0 }}>
                  <span>{label}</span>
                  <b>{value}</b>
                  <small className={up ? 'fd-up' : 'fd-down'}>{up ? '↑' : '↓'} {pct}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="fd-sec">Top funnels</h3>
          <div className="fd-table">
            {FUNNELS.map((f, i) => (
              <div key={i} className="fd-row">
                <div className="fd-prod">
                  <div className="fd-thumb" style={{ background: f.swatch }} />
                  <div style={{ minWidth: 0 }}>
                    <a>{f.name}</a>
                    <small>{f.sub} · {f.orders} orders</small>
                  </div>
                </div>
                <div className="fd-cell"><span>Inventory</span><b>{f.inv}</b></div>
                <div className="fd-cell"><span>Price</span><b>{f.price}</b></div>
                <div className="fd-cell"><span>Sale</span><b>{f.sale}</b></div>
                <div className="fd-cell"><span>Today</span><b>{f.today}</b></div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <aside className="fd-rail">
        <div className="fd-who">
          <Icon d="M10 4v.01M10 10v.01M10 16v.01" size={16} />
          <Icon d="M5 14V9a5 5 0 0 1 10 0v5l1.5 2h-13zM8.5 18h3" size={16} />
          <div className="fd-av">JD</div>
        </div>

        <div className="fd-actrow">
          <span className="fd-eyebrow">Activity</span>
          <div className="fd-pill"><span style={{ color: 'var(--brand)' }}>⟳</span> Insight <span style={{ fontSize: 8 }}>▼</span></div>
        </div>

        <div className="fd-live">
          <p>Active Visitors right now</p>
          <strong>3467</strong>
          <p style={{ fontSize: 11, opacity: .7 }}>Page view per minute</p>
          <div className="fd-spark">{SPARK.map((h, i) => <i key={i} style={{ height: `${h * 3}%` }} />)}</div>
          <button>Real-time report ▸</button>
        </div>

        <div className="fd-card">
          <div className="fd-badge">MS</div>
          <h4>In the last 30 days</h4>
          <p>45.1% of your abandoned checkout recovery email were successful.</p>
          <div className="fd-card-foot">
            <span>Last 30 days ▾</span>
            <button>Check data ▸</button>
          </div>
        </div>

        <div>
          <h3 className="fd-eyebrow" style={{ margin: '0 0 12px', fontWeight: 500 }}>Revenue by channel</h3>
          <ul className="fd-chan">
            {CHANNELS.map(([name, amount, pct, w, up]) => (
              <li key={name}>
                <div>
                  <span>{name}</span>
                  <b>{amount}</b>
                  <b className={up ? 'fd-up' : 'fd-down'}>{pct}%</b>
                </div>
                <div className="fd-track"><i style={{ width: `${w}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      </div>
    </div>
  )
}
