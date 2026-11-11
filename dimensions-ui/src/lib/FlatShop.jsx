import { useState } from 'react'

// Flat UI shop catalogue: products on flat pastel squares, bold prices, a
// solid "Add to bag" bar, outlined quantity steppers, a scrolling row of
// category pills and a plain filter sidebar of checkboxes and swatches.

const PRODUCTS = [
  { name: 'Stoneware Mug', price: 24, cat: 'Kitchen', bg: '#fde2d4', ink: '#c2502b', shape: 'mug', color: 'Terracotta' },
  { name: 'Arc Desk Lamp', price: 89, cat: 'Lighting', bg: '#dbe7ff', ink: '#2f56c4', shape: 'lamp', color: 'Blue' },
  { name: 'Lounge Chair', price: 240, cat: 'Furniture', bg: '#d9f2e3', ink: '#1f8a55', shape: 'chair', color: 'Green' },
  { name: 'Bud Vase', price: 32, cat: 'Decor', bg: '#fff1c7', ink: '#b7870f', shape: 'vase', color: 'Yellow' },
  { name: 'Dome Pendant', price: 120, cat: 'Lighting', bg: '#ece6ff', ink: '#6a4bd1', shape: 'pendant', color: 'Purple' },
  { name: 'Side Table', price: 150, cat: 'Furniture', bg: '#ffe1ec', ink: '#c23d72', shape: 'table', color: 'Pink' },
]

const CATS = ['All', 'Kitchen', 'Lighting', 'Furniture', 'Decor']
const PRICES = [
  ['Under $50', (p) => p < 50],
  ['$50 to $150', (p) => p >= 50 && p <= 150],
  ['Over $150', (p) => p > 150],
]
const SWATCHES = [
  ['Terracotta', '#e0724a'],
  ['Blue', '#4a74e0'],
  ['Green', '#2fa36b'],
  ['Yellow', '#e6b325'],
  ['Purple', '#8a6be8'],
  ['Pink', '#e35d92'],
]

function Product({ shape, ink }) {
  const s = { fill: ink }
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {shape === 'mug' && (<><rect x="28" y="34" width="36" height="40" rx="5" {...s} /><path d="M64 42h6a8 8 0 0 1 0 16h-6" fill="none" stroke={ink} strokeWidth="6" /></>)}
      {shape === 'lamp' && (<><path d="M30 34l22-12 8 14-22 12z" {...s} /><rect x="44" y="40" width="5" height="34" {...s} /><rect x="32" y="72" width="30" height="6" rx="3" {...s} /></>)}
      {shape === 'chair' && (<><rect x="30" y="26" width="34" height="30" rx="8" {...s} /><rect x="26" y="52" width="44" height="12" rx="5" {...s} /><rect x="30" y="64" width="5" height="16" {...s} /><rect x="61" y="64" width="5" height="16" {...s} /></>)}
      {shape === 'vase' && <path d="M43 24h14v8c0 4 9 10 9 24 0 14-7 22-16 22s-16-8-16-22c0-14 9-20 9-24z" {...s} />}
      {shape === 'pendant' && (<><rect x="48.5" y="14" width="3" height="28" {...s} /><path d="M26 66a24 24 0 0 1 48 0z" {...s} /><rect x="44" y="66" width="12" height="6" rx="3" {...s} /></>)}
      {shape === 'table' && (<><ellipse cx="50" cy="40" rx="26" ry="7" {...s} /><rect x="36" y="44" width="5" height="34" {...s} /><rect x="59" y="44" width="5" height="34" {...s} /></>)}
    </svg>
  )
}

export default function FlatShop({ buttonColor = '#111111', radius = 4, showFilters = true, style }) {
  const [cat, setCat] = useState('All')
  const [prices, setPrices] = useState([])
  const [swatch, setSwatch] = useState(null)
  const [qty, setQty] = useState({})
  const [bag, setBag] = useState(2)

  const items = PRODUCTS.filter(
    (p) =>
      (cat === 'All' || p.cat === cat) &&
      (!prices.length || prices.some((i) => PRICES[i][1](p.price))) &&
      (!swatch || p.color === swatch),
  )
  const q = (name) => qty[name] ?? 1
  const setQ = (name, n) => setQty({ ...qty, [name]: Math.max(1, Math.min(9, n)) })

  return (
    <div className={`fs${showFilters ? '' : ' fs-nofilters'}`} style={{ '--btn': buttonColor, '--r': `${radius}px`, ...style }}>
      <style>{`
        .fs { container-type: inline-size; display: grid; grid-template-rows: auto auto 1fr; width: 100%; height: 100%; background: #fff; color: #111; font: 400 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; overflow: hidden; }
        .fs * { box-sizing: border-box; }
        .fs button { font: inherit; cursor: pointer; }
        .fs-top { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px 8px; }
        .fs-top b { font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
        .fs-bag { border: 0; background: var(--btn); color: #fff; font-weight: 700; padding: 7px 12px; border-radius: 999px; }
        .fs-pills { display: flex; gap: 8px; overflow-x: auto; padding: 4px 20px 12px; scrollbar-width: none; }
        .fs-pill { flex: none; border: 1.5px solid #111; background: #fff; color: #111; font-weight: 600; padding: 6px 14px; border-radius: 999px; }
        .fs-pill[aria-pressed='true'] { background: #111; color: #fff; }
        .fs-body { display: grid; grid-template-columns: 170px 1fr; min-height: 0; border-top: 1px solid #eee; }
        .fs-nofilters .fs-body { grid-template-columns: 1fr; }
        .fs-nofilters .fs-filters { display: none; }
        .fs-filters { padding: 14px 16px 14px 20px; border-right: 1px solid #eee; overflow: auto; }
        .fs-filters h4 { margin: 0 0 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #5e5e5e; }
        .fs-filters section + section { margin-top: 14px; padding-top: 14px; border-top: 1px solid #eee; }
        .fs-check { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; }
        .fs-check input { appearance: none; width: 16px; height: 16px; border: 1.5px solid #111; border-radius: 3px; margin: 0; display: grid; place-items: center; cursor: pointer; }
        .fs-check input:checked { background: #111; }
        .fs-check input:checked::after { content: ''; width: 8px; height: 4px; border: 2px solid #fff; border-top: 0; border-right: 0; transform: translateY(-1px) rotate(-45deg); }
        .fs-swatches { display: flex; flex-wrap: wrap; gap: 8px; }
        .fs-sw { width: 22px; height: 22px; border-radius: 50%; border: 0; padding: 0; outline-offset: 2px; }
        .fs-sw[aria-pressed='true'] { outline: 2px solid #111; }
        .fs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; padding: 14px 20px 20px; overflow: auto; align-content: start; }
        .fs-card { display: flex; flex-direction: column; gap: 6px; }
        .fs-img { aspect-ratio: 1; border-radius: var(--r); display: grid; place-items: center; }
        .fs-img svg { width: 62%; height: 62%; }
        .fs-name { font-weight: 600; }
        .fs-price { font-weight: 800; font-size: 15px; }
        .fs-row { display: flex; gap: 6px; }
        .fs-step { display: flex; border: 1.5px solid #111; border-radius: var(--r); }
        .fs-step button { width: 26px; border: 0; background: #fff; color: #111; font-weight: 700; font-size: 15px; }
        .fs-step button:hover { background: #f1f1f1; }
        .fs-step span { width: 20px; display: grid; place-items: center; font-weight: 700; }
        .fs-add { flex: 1; border: 0; background: var(--btn); color: #fff; font-weight: 700; padding: 8px 6px; border-radius: var(--r); transition: background 120ms; }
        .fs-add:hover { background: color-mix(in srgb, var(--btn), white 22%); }
        .fs-empty { color: #777; padding: 20px; }
        @container (max-width: 560px) { .fs-body { grid-template-columns: 1fr; } .fs-filters { display: none; } }
      `}</style>

      <header className="fs-top">
        <b>FLAT/HOME</b>
        <button className="fs-bag">Bag · {bag}</button>
      </header>

      <nav className="fs-pills">
        {CATS.map((c) => (
          <button key={c} className="fs-pill" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
        ))}
      </nav>

      <div className="fs-body">
        <aside className="fs-filters">
          <section>
            <h4>Price</h4>
            {PRICES.map(([label], i) => (
              <label key={label} className="fs-check">
                <input
                  type="checkbox"
                  checked={prices.includes(i)}
                  onChange={() => setPrices(prices.includes(i) ? prices.filter((x) => x !== i) : [...prices, i])}
                />
                {label}
              </label>
            ))}
          </section>
          <section>
            <h4>Colour</h4>
            <div className="fs-swatches">
              {SWATCHES.map(([name, c]) => (
                <button
                  key={name}
                  className="fs-sw"
                  title={name}
                  aria-label={name}
                  aria-pressed={swatch === name}
                  style={{ background: c }}
                  onClick={() => setSwatch(swatch === name ? null : name)}
                />
              ))}
            </div>
          </section>
        </aside>

        <div className="fs-grid">
          {items.length === 0 && <p className="fs-empty">No products match these filters.</p>}
          {items.map((p) => (
            <article key={p.name} className="fs-card">
              <div className="fs-img" style={{ background: p.bg }}><Product shape={p.shape} ink={p.ink} /></div>
              <span className="fs-name">{p.name}</span>
              <span className="fs-price">${p.price}</span>
              <div className="fs-row">
                <div className="fs-step">
                  <button aria-label="Fewer" onClick={() => setQ(p.name, q(p.name) - 1)}>−</button>
                  <span>{q(p.name)}</span>
                  <button aria-label="More" onClick={() => setQ(p.name, q(p.name) + 1)}>+</button>
                </div>
                <button className="fs-add" onClick={() => setBag(bag + q(p.name))}>Add to bag</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
