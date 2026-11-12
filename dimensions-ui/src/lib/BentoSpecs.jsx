import { useEffect, useRef, useState } from 'react'

// Bento product spec sheet: one big number per tile (battery, chip, camera,
// display, weight, materials). The model pill animates every value to the
// new model, "Compare" slides up a drawer with all three side by side, and
// "Buy" sits in a sticky tile at the bottom.

const MODELS = {
  Air: { price: 799, battery: 22, chip: 'N3', cores: 6, camera: 48, zoom: 2, display: 6.1, nits: 2000, weight: 168, material: 'Aluminium', colours: ['#d9d4c7', '#2f3a4a', '#c8d9c2'] },
  Pro: { price: 1099, battery: 27, chip: 'N3 Pro', cores: 8, camera: 48, zoom: 5, display: 6.3, nits: 2600, weight: 199, material: 'Titanium', colours: ['#c9c2b6', '#3a3a3c', '#d8cfc4'] },
  Max: { price: 1299, battery: 33, chip: 'N3 Pro', cores: 8, camera: 64, zoom: 8, display: 6.9, nits: 3000, weight: 227, material: 'Titanium', colours: ['#b8b0a2', '#1f1f21', '#6b7a8f'] },
}
const ROWS = [['Price', (m) => `$${m.price}`], ['Battery', (m) => `${m.battery} h`], ['Chip', (m) => `${m.chip} · ${m.cores}-core`], ['Camera', (m) => `${m.camera} MP · ${m.zoom}× zoom`], ['Display', (m) => `${m.display}″ · ${m.nits} nits`], ['Weight', (m) => `${m.weight} g`], ['Frame', (m) => m.material]]

// Animates a number toward its new value.
function Num({ value, decimals = 0 }) {
  const [v, setV] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    let raf, start
    const a = from.current
    const tick = (t) => {
      start ??= t
      const k = Math.min(1, (t - start) / 600)
      const cur = a + (value - a) * (1 - (1 - k) ** 3)
      setV(cur)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value])
  return <>{v.toFixed(decimals)}</>
}

export default function BentoSpecs({ product = 'Nova', accent = '#ff9f43', style }) {
  const [model, setModel] = useState('Pro')
  const [compare, setCompare] = useState(false)
  const [colour, setColour] = useState(0)
  const m = MODELS[model]

  return (
    <div className="bs-wrap" style={{ '--accent': accent, ...style }}>
      <style>{`
        .bs-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; background: #000; color: #f5f5f7; font: 500 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.bs-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .bs-scroll { position: absolute; inset: 0; overflow: auto; padding: 12px 16px 80px; }
        .bs-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
        .bs-head h2 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
        .bs-pill { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: #1c1c1e; }
        .bs-pill button { padding: 6px 14px; border-radius: 999px; color: #a1a1a6; font-weight: 700; }
        .bs-pill button[aria-pressed='true'] { background: #f5f5f7; color: #000; }
        .bs { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 98px; gap: 12px; }
        .bs-tile { background: #1c1c1e; border-radius: 24px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; }
        .bs-tile small { color: #a1a1a6; font-weight: 600; }
        .bs-num { font-size: 36px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; font-variant-numeric: tabular-nums; }
        .bs-num span { font-size: 16px; color: #a1a1a6; margin-left: 3px; letter-spacing: 0; }
        .bs-grad { background: linear-gradient(90deg, var(--accent), #ff5e8a); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .bs-battery { grid-column: span 2; grid-row: span 2; }
        .bs-battery .bs-num { font-size: 72px; }
        .bs-cell { height: 18px; border-radius: 6px; border: 2px solid #3a3a3c; padding: 2px; width: 70%; }
        .bs-cell i { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #30d158, #a8f07a); transition: width 600ms ease; }
        .bs-chip { grid-column: span 2; flex-direction: row; align-items: center; gap: 16px; justify-content: flex-start; }
        .bs-die { width: 76px; height: 76px; border-radius: 16px; background: linear-gradient(135deg, #2c2c2e, #0d0d0f); border: 1px solid #3a3a3c; display: grid; place-items: center; font-weight: 900; font-size: 18px; flex: none; box-shadow: inset 0 0 0 6px #161618; }
        .bs-camera .bs-lens { position: absolute; right: -16px; top: -16px; width: 78px; height: 78px; border-radius: 50%; background: radial-gradient(circle, #3b4b7a 0 18%, #0a0a0c 20% 46%, #2a2a2e 48% 60%, #141416 62%); }
        .bs-display { background: linear-gradient(160deg, #1c1c1e, #2a1d3a); }
        .bs-material { grid-column: span 2; flex-direction: row; align-items: center; justify-content: space-between; }
        .bs-swatches { display: flex; gap: 10px; }
        .bs-swatches button { width: 30px; height: 30px; border-radius: 50%; box-shadow: inset 0 -4px 8px rgba(0,0,0,.25), 0 0 0 1px rgba(255,255,255,.28); outline-offset: 3px; }
        .bs-swatches button[aria-checked='true'] { outline: 2px solid #f5f5f7; }
        .bs-buy { position: absolute; left: 16px; right: 16px; bottom: 14px; z-index: 3; background: rgba(28,28,30,.86); backdrop-filter: blur(14px); border-radius: 20px; padding: 7px 7px 7px 16px; display: flex; align-items: center; gap: 10px; border: 1px solid #2c2c2e; }
        .bs-buy b { font-size: 15px; }
        .bs-buy small { display: block; color: #a1a1a6; }
        .bs-buy .bs-cmp { margin-left: auto; padding: 10px 14px; border-radius: 14px; font-weight: 700; color: #f5f5f7; }
        .bs-buy .bs-cmp:hover { background: #2c2c2e; }
        .bs-buy .bs-go { padding: 10px 18px; border-radius: 14px; background: var(--accent); color: #000; font-weight: 800; }
        .bs-wrap .bs-go { color: #000; }
        .bs-drawer { position: absolute; left: 0; right: 0; bottom: 0; z-index: 4; background: #111113; border-radius: 26px 26px 0 0; border-top: 1px solid #2c2c2e; padding: 16px 18px 18px; transform: translateY(105%); transition: transform 380ms cubic-bezier(.2,.9,.2,1); max-height: 86%; overflow: auto; }
        .bs-drawer.open { transform: none; }
        .bs-drawer h3 { margin: 0 0 10px; display: flex; justify-content: space-between; }
        .bs-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .bs-table th, .bs-table td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #222224; }
        .bs-table th { color: #a1a1a6; font-weight: 600; }
        .bs-table td.on { color: var(--accent); font-weight: 700; }
        @container (max-width: 680px) { .bs { grid-template-columns: repeat(2, 1fr); } .bs-battery .bs-num { font-size: 60px; } }
      `}</style>

      <div className="bs-scroll">
        <div className="bs-head">
          <h2>{product} {model}</h2>
          <div className="bs-pill" role="group" aria-label="Model">
            {Object.keys(MODELS).map((k) => <button key={k} aria-pressed={k === model} onClick={() => setModel(k)}>{k}</button>)}
          </div>
        </div>
        <div className="bs">
          <section className="bs-tile bs-battery">
            <small>Battery life</small>
            <div className="bs-num bs-grad"><Num value={m.battery} /><span>hours</span></div>
            <div className="bs-cell"><i style={{ width: `${(m.battery / 33) * 100}%` }} /></div>
          </section>
          <section className="bs-tile bs-chip">
            <div className="bs-die">{m.chip.split(' ')[0]}</div>
            <div><small>Chip</small><div className="bs-num" style={{ fontSize: 28 }}>{m.chip}</div><small><Num value={m.cores} />-core CPU</small></div>
          </section>
          <section className="bs-tile bs-camera">
            <span className="bs-lens" aria-hidden="true" />
            <small>Main camera</small>
            <div className="bs-num"><Num value={m.camera} /><span>MP</span></div>
          </section>
          <section className="bs-tile">
            <small>Optical zoom</small>
            <div className="bs-num bs-grad"><Num value={m.zoom} />×</div>
          </section>
          <section className="bs-tile bs-display">
            <small>Display</small>
            <div className="bs-num"><Num value={m.display} decimals={1} /><span>in</span></div>
          </section>
          <section className="bs-tile">
            <small>Peak brightness</small>
            <div className="bs-num"><Num value={m.nits} /><span>nits</span></div>
          </section>
          <section className="bs-tile bs-material">
            <div><small>Frame</small><div className="bs-num" style={{ fontSize: 30 }}>{m.material}</div><small><Num value={m.weight} /> g</small></div>
            <div className="bs-swatches" role="radiogroup" aria-label="Colour">
              {m.colours.map((c, i) => <button key={c} role="radio" aria-checked={i === colour} aria-label={`Colour ${i + 1}`} style={{ background: c }} onClick={() => setColour(i)} />)}
            </div>
          </section>
        </div>
      </div>

      <div className="bs-buy">
        <div><b>{product} {model}</b><small>From ${m.price} or ${Math.round(m.price / 24)}/mo</small></div>
        <button className="bs-cmp" aria-expanded={compare} onClick={() => setCompare(true)}>Compare</button>
        <button className="bs-go">Buy</button>
      </div>

      <section className={`bs-drawer${compare ? ' open' : ''}`} aria-hidden={!compare}>
        <h3>Compare models <button onClick={() => setCompare(false)} tabIndex={compare ? 0 : -1} aria-label="Close">✕</button></h3>
        <table className="bs-table">
          <thead><tr><th />{Object.keys(MODELS).map((k) => <th key={k} style={{ color: k === model ? accent : undefined }}>{k}</th>)}</tr></thead>
          <tbody>
            {ROWS.map(([label, get]) => (
              <tr key={label}><th>{label}</th>{Object.entries(MODELS).map(([k, mm]) => <td key={k} className={k === model ? 'on' : ''}>{get(mm)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
