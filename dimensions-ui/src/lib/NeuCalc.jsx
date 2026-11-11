import { useEffect, useRef, useState } from 'react'

// Neumorphic calculator. Keys are raised from the same surface and sink in
// when pressed; the display is carved into the panel. A recessed toggle
// switches Basic / Scientific, and a history tape sits in a recessed column.
// Works with the keyboard too (digits, + − × ÷, Enter, Backspace, Escape).

// Works out the soft highlight, shadow and text colours from one surface
// colour, so any surface keeps the pressed/raised look and readable text.
function soften(surface) {
  const h = surface.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const light = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.5
  const mix = (c, pct) => `color-mix(in srgb, ${surface}, ${c} ${pct}%)`
  return light
    ? { base: surface, hi: mix('white', 70), lo: mix('#1b2433', 24), ink: mix('#0d1320', 84), muted: mix('#0d1320', 62) }
    : { base: surface, hi: mix('white', 9), lo: mix('black', 40), ink: mix('white', 90), muted: mix('white', 64) }
}

const OPS = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => (b === 0 ? NaN : a / b) }
const SCI = [
  ['sin', (x) => Math.sin((x * Math.PI) / 180)],
  ['cos', (x) => Math.cos((x * Math.PI) / 180)],
  ['√', (x) => Math.sqrt(x)],
  ['x²', (x) => x * x],
  ['π', () => Math.PI],
  ['1/x', (x) => 1 / x],
]
const KEYS = ['AC', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '=']

const show = (n) => {
  if (!Number.isFinite(n)) return 'Error'
  const s = Number.parseFloat(n.toPrecision(12)).toString()
  return s.length > 12 ? n.toExponential(6) : s
}

export default function NeuCalc({ surface = '#e6ebf2', accent = '#ff7a45', showHistory = true, style }) {
  const t = soften(surface)
  const [cur, setCur] = useState('0')
  const [acc, setAcc] = useState(null)
  const [op, setOp] = useState(null)
  const [fresh, setFresh] = useState(false)
  const [sci, setSci] = useState(false)
  const [history, setHistory] = useState([['12 × 8', '96'], ['250 ÷ 4', '62.5']])
  const [pressed, setPressed] = useState(null)
  const root = useRef(null)

  const val = () => Number.parseFloat(cur)

  const press = (k) => {
    setPressed(k)
    setTimeout(() => setPressed(null), 120)
    if (/^[0-9]$/.test(k)) {
      setCur(fresh || cur === '0' ? k : cur.length < 14 ? cur + k : cur)
      setFresh(false)
    } else if (k === '.') {
      if (fresh) { setCur('0.'); setFresh(false) } else if (!cur.includes('.')) setCur(cur + '.')
    } else if (k === 'AC') {
      setCur('0'); setAcc(null); setOp(null); setFresh(false)
    } else if (k === '⌫') {
      setCur(cur.length > 1 && !fresh ? cur.slice(0, -1) : '0')
    } else if (k === '±') {
      setCur(cur.startsWith('-') ? cur.slice(1) : cur === '0' ? cur : '-' + cur)
    } else if (k === '%') {
      setCur(show(val() / 100))
    } else if (OPS[k]) {
      if (op && acc !== null && !fresh) {
        const r = OPS[op](acc, val())
        setAcc(r); setCur(show(r))
      } else setAcc(val())
      setOp(k); setFresh(true)
    } else if (k === '=') {
      if (op === null || acc === null) return
      const r = OPS[op](acc, val())
      setHistory([[`${show(acc)} ${op} ${cur}`, show(r)], ...history].slice(0, 8))
      setCur(show(r)); setAcc(null); setOp(null); setFresh(true)
    } else {
      const f = SCI.find((s) => s[0] === k)
      if (f) { setCur(show(f[1](val()))); setFresh(true) }
    }
  }

  useEffect(() => {
    const el = root.current
    const map = { '*': '×', x: '×', '/': '÷', '-': '−', '+': '+', Enter: '=', '=': '=', Backspace: '⌫', Escape: 'AC', '.': '.', ',': '.', '%': '%' }
    const onKey = (e) => {
      const k = /^[0-9]$/.test(e.key) ? e.key : map[e.key]
      if (k) { e.preventDefault(); press(k) }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  })


  return (
    <div ref={root} tabIndex={0} className="nc-wrap" aria-label="Calculator" style={{ '--base': t.base, '--hi': t.hi, '--lo': t.lo, '--ink': t.ink, '--muted': t.muted, '--accent': accent, ...style }}>
      <style>{`
        .nc-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: var(--base); color: var(--ink); font: 600 15px/1 system-ui, -apple-system, 'Segoe UI', sans-serif; outline: none; }
        :where(.nc-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .nc-up { background: var(--base); box-shadow: 5px 5px 11px var(--lo), -5px -5px 11px var(--hi); }
        .nc-in { background: var(--base); box-shadow: inset 5px 5px 10px var(--lo), inset -5px -5px 10px var(--hi); }
        .nc { display: flex; gap: 22px; justify-content: center; padding: 18px; box-sizing: border-box; min-height: 100%; align-items: center; }
        .nc-body { width: 300px; display: flex; flex-direction: column; gap: 12px; }
        .nc-top { display: flex; justify-content: space-between; align-items: center; }
        .nc-mode { position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 999px; width: 190px; }
        .nc-mode button { position: relative; z-index: 1; padding: 7px 0; font-size: 12px; color: var(--muted); }
        .nc-mode button[aria-selected='true'] { color: var(--accent); }
        .nc-mode i { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px); border-radius: 999px; transition: transform 260ms cubic-bezier(.3,1.3,.5,1); }
        .nc-op { color: var(--muted); font-size: 12px; min-width: 20px; text-align: right; }
        .nc-screen { border-radius: 20px; padding: 10px 18px; text-align: right; }
        .nc-screen small { display: block; color: var(--muted); font-size: 12.5px; font-weight: 500; height: 16px; }
        .nc-screen b { display: block; font-size: 34px; font-weight: 300; letter-spacing: -0.02em; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
        .nc-keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 11px; }
        .nc-key { height: 40px; border-radius: 14px; transition: box-shadow 90ms, transform 90ms; }
        .nc-key.down, .nc-key:active { box-shadow: inset 4px 4px 8px var(--lo), inset -4px -4px 8px var(--hi); transform: scale(.98); }
        .nc-key.op { color: var(--accent); font-size: 20px; }
        .nc-key.op.active { color: var(--base); background: var(--accent); box-shadow: inset 3px 3px 6px color-mix(in srgb, var(--accent), black 25%); }
        .nc-key.fn { color: var(--muted); font-size: 14px; }
        .nc-key.sci { font-size: 13px; color: var(--muted); height: 32px; border-radius: 11px; }
        .nc-sci { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
        .nc-key.eq { background: var(--accent); color: #fff; font-size: 20px; }
        .nc-tape { width: 180px; align-self: stretch; max-height: 380px; border-radius: 20px; padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow: auto; }
        .nc-tape h4 { margin: 0; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
        .nc-tape button { text-align: right; padding: 6px 4px; border-radius: 10px; }
        .nc-tape button:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
        .nc-tape small { display: block; color: var(--muted); font-size: 11.5px; font-weight: 500; margin-bottom: 4px; }
        .nc-tape b { font-size: 17px; }
        @container (max-width: 560px) { .nc-tape { display: none; } }
      `}</style>

      <div className="nc">
        <div className="nc-body">
          <div className="nc-top">
            <div className="nc-mode nc-in" role="tablist" aria-label="Mode">
              <i className="nc-up" style={{ transform: `translateX(${sci ? 100 : 0}%)` }} />
              <button role="tab" aria-selected={!sci} onClick={() => setSci(false)}>Basic</button>
              <button role="tab" aria-selected={sci} onClick={() => setSci(true)}>Scientific</button>
            </div>
            <span className="nc-op">{op ?? ''}</span>
          </div>
          <output className="nc-screen nc-in" aria-live="polite">
            <small>{acc !== null && op ? `${show(acc)} ${op}` : ''}</small>
            <b>{cur}</b>
          </output>
          {sci && (
            <div className="nc-sci">
              {SCI.map(([k]) => (
                <button key={k} className={`nc-key nc-up sci${pressed === k ? ' down' : ''}`} onClick={() => press(k)} aria-label={k}>{k}</button>
              ))}
            </div>
          )}
          <div className="nc-keys">
            {KEYS.map((k) => {
              const cls = ['nc-key', 'nc-up']
              if (OPS[k]) cls.push('op')
              if (OPS[k] && op === k && fresh) cls.push('active')
              if (['AC', '±', '%', '⌫'].includes(k)) cls.push('fn')
              if (k === '=') cls.push('eq')
              if (pressed === k) cls.push('down')
              return <button key={k} className={cls.join(' ')} onClick={() => press(k)} aria-label={k === '⌫' ? 'Delete' : k}>{k}</button>
            })}
          </div>
        </div>
        {showHistory && (
          <aside className="nc-tape nc-in">
            <h4>History</h4>
            {history.map(([e, r], i) => (
              <button key={i} onClick={() => { setCur(r); setFresh(true) }} title="Use this result">
                <small>{e} =</small><b>{r}</b>
              </button>
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}
