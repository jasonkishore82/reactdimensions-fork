import { useRef, useState } from 'react'
import { useLens, specular } from '../liquid/lens.js'

// Liquid glass control centre: rounded glass tiles over a bold wallpaper,
// each bending what's behind it. Toggles ripple when switched, brightness and
// volume are glass tubes you drag (brightness really dims the wallpaper), and
// a shortcut tray slides out from the edge.

const CONNECT = [
  ['Wi-Fi', 'M3 8a10 10 0 0 1 14 0M5.5 11a6.5 6.5 0 0 1 9 0M8 14a3 3 0 0 1 4 0M10 16.5h.01', '#2f80ff'],
  ['Bluetooth', 'M6 6l8 8-4 3V3l4 3-8 8', '#2f80ff'],
  ['Airplane', 'M2.5 11l7-1.5L13 3l1.5.5-1.5 6.5 4 1v2l-4-.5-1 4.5h-1.5L9.5 12 2.5 12.5z', '#ff9f0a'],
  ['Cellular', 'M4 15v-2M8 15v-5M12 15V7M16 15V4', '#30d158'],
]
const SMALL = [
  ['Torch', 'M7 3h6l-1 5v9H8V8z'],
  ['Timer', 'M10 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM10 8v3l2 1M8 2h4'],
  ['Camera', 'M3 6h3l1.5-2h5L14 6h3v10H3zM10 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  ['Calculator', 'M5 3h10v14H5zM7 6h6M7 10h.01M10 10h.01M13 10h.01M7 13h.01M10 13h.01M13 13h.01'],
]

const Icon = ({ d, size = 20 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={d} /></svg>
)

function Tile({ className = '', strength, radius = 26, children, ...rest }) {
  const ref = useRef(null)
  const glass = useLens(ref, { radius, depth: 16, strength, soften: 2.5 })
  return (
    <>
      {glass.filter}
      <div
        ref={ref}
        className={`lc-tile ${className}`}
        style={glass.style}
        onPointerMove={specular}
        onKeyDown={(e) => { if (rest.role === 'button' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); rest.onClick?.(e) } }}
        {...rest}
      >
        {children}
      </div>
    </>
  )
}

function Tube({ label, icon, value, onChange, strength }) {
  const ref = useRef(null)
  const glass = useLens(ref, { radius: 26, depth: 18, strength, soften: 2.5 })
  const set = (e) => {
    const r = ref.current.getBoundingClientRect()
    onChange(Math.round(Math.min(100, Math.max(0, ((r.bottom - e.clientY) / r.height) * 100))))
  }
  return (
    <>
      {glass.filter}
      <div
        ref={ref}
        className="lc-tile lc-tube"
        style={glass.style}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e) }}
        onPointerMove={(e) => { specular(e); if (e.buttons) set(e) }}
        onKeyDown={(e) => { if (e.key === 'ArrowUp') onChange(Math.min(100, value + 5)); if (e.key === 'ArrowDown') onChange(Math.max(0, value - 5)) }}
      >
        <span className="lc-fill" style={{ height: `${value}%` }} />
        <span className="lc-tube-icon"><Icon d={icon} /></span>
      </div>
    </>
  )
}

export default function LiquidControl({ strength = 60, accent = '#2f80ff', style }) {
  const [on, setOn] = useState({ 'Wi-Fi': true, Bluetooth: true, Airplane: false, Cellular: true, Focus: false, Torch: false })
  const [ripple, setRipple] = useState(null)
  const [bright, setBright] = useState(78)
  const [vol, setVol] = useState(45)
  const [playing, setPlaying] = useState(true)
  const [tray, setTray] = useState(false)
  const trayRef = useRef(null)
  const trayGlass = useLens(trayRef, { radius: 24, depth: 24, strength: strength * 1.3, soften: 4 })

  const flip = (k) => {
    setOn({ ...on, [k]: !on[k] })
    setRipple(`${k}-${Date.now()}`)
  }

  return (
    <div className="lc-wrap" style={{ '--accent': accent, ...style }}>
      {trayGlass.filter}
      <style>{`
        .lc-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; color: #fff; font: 600 12px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif; background: #ff6a3d; }
        :where(.lc-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .lc-wall { position: absolute; inset: 0; overflow: hidden; }
        .lc-wall i { position: absolute; border-radius: 50%; }
        .lc-wall b { position: absolute; left: 4%; bottom: -6%; font: 900 clamp(120px, 26cqw, 260px)/0.8 system-ui, sans-serif; letter-spacing: -0.06em; color: #ffd166; white-space: nowrap; }
        .lc-dim { position: absolute; inset: 0; background: #000; pointer-events: none; transition: opacity 120ms; }
        .lc-grid { position: relative; margin: 18px auto; width: min(520px, 100% - 28px); display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 86px; gap: 12px; }
        .lc-tile { position: relative; border-radius: 26px; background: rgba(20,20,28,.18); box-shadow: inset 0 1px 1px rgba(255,255,255,.75), inset 0 0 0 1px rgba(255,255,255,.2), 0 10px 26px rgba(0,0,0,.18); overflow: hidden; text-shadow: 0 1px 2px rgba(0,0,0,.3); }
        .lc-tile::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: radial-gradient(circle at var(--gx, 25%) var(--gy, 0%), rgba(255,255,255,.5), transparent 45%); mix-blend-mode: soft-light; }
        .lc-connect { grid-column: span 2; grid-row: span 2; display: grid; grid-template-columns: 1fr 1fr; place-items: center; padding: 10px; }
        .lc-round { position: relative; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.22); transition: background 200ms, color 200ms; overflow: hidden; }
        .lc-round[aria-pressed='true'] { background: #fff; color: var(--c); text-shadow: none; }
        .lc-ripple { position: absolute; inset: 0; border-radius: 50%; background: rgba(255,255,255,.7); animation: lc-ripple 550ms ease-out forwards; pointer-events: none; }
        @keyframes lc-ripple { from { transform: scale(.2); opacity: .9; } to { transform: scale(2.2); opacity: 0; } }
        .lc-music { grid-column: span 2; display: flex; align-items: center; gap: 10px; padding: 12px; }
        .lc-art { width: 56px; height: 56px; border-radius: 14px; background: conic-gradient(from 200deg, #ff5d73, #ffd166, #06d6a0, #118ab2, #ff5d73); flex: none; }
        .lc-music b { display: block; font-size: 13px; }
        .lc-music span { opacity: .85; font-weight: 500; }
        .lc-music .lc-pp { margin-left: auto; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.25); }
        .lc-tube { grid-row: span 2; cursor: ns-resize; touch-action: none; }
        .lc-fill { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,.92); transition: height 80ms; }
        .lc-tube-icon { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); color: #3a3a3c; text-shadow: none; }
        .lc-focus { grid-column: span 2; display: flex; align-items: center; gap: 12px; padding: 0 16px; text-align: left; transition: background 200ms; }
        .lc-focus[aria-pressed='true'] { background: rgba(255,255,255,.85); color: #5e5ce6; text-shadow: none; }
        .lc-focus small { display: block; opacity: .8; font-weight: 500; }
        .lc-small { display: grid; place-items: center; transition: background 200ms; }
        .lc-small[aria-pressed='true'] { background: rgba(255,255,255,.9); color: #111; text-shadow: none; }
        .lc-handle { position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 18px; height: 80px; border-radius: 10px 0 0 10px; background: rgba(255,255,255,.35); z-index: 3; }
        .lc-tray { position: absolute; right: 12px; top: 50%; width: 76px; padding: 10px 0; border-radius: 24px; display: flex; flex-direction: column; align-items: center; gap: 10px; transform: translate(130%, -50%); transition: transform 380ms cubic-bezier(.2,.9,.2,1); z-index: 4; background: rgba(20,20,28,.18); box-shadow: inset 0 1px 1px rgba(255,255,255,.75), inset 0 0 0 1px rgba(255,255,255,.2), 0 10px 26px rgba(0,0,0,.2); }
        .lc-tray.open { transform: translate(0, -50%); }
        .lc-tray button { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: rgba(255,255,255,.2); }
        @media (prefers-reduced-motion: reduce) { .lc-ripple { animation: none; display: none; } .lc-tray { transition: none; } }
        @container (max-width: 520px) { .lc-grid { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 78px; } .lc-connect, .lc-music, .lc-focus { grid-column: span 2; } }
      `}</style>

      <div className="lc-wall" aria-hidden="true">
        <i style={{ width: '62%', aspectRatio: 1, background: '#3a0ca3', left: '-12%', top: '-30%' }} />
        <i style={{ width: '36%', aspectRatio: 1, background: '#06d6a0', right: '-6%', top: '12%' }} />
        <i style={{ width: '22%', aspectRatio: 1, border: '26px solid #fff', right: '28%', bottom: '18%' }} />
        <b>Sunday</b>
      </div>
      <div className="lc-dim" style={{ opacity: (100 - bright) / 160 }} />

      <div className="lc-grid">
        <Tile className="lc-connect" strength={strength}>
          {CONNECT.map(([k, d, c]) => (
            <button key={k} className="lc-round" aria-pressed={on[k]} aria-label={k} title={k} style={{ '--c': c }} onClick={() => flip(k)}>
              <Icon d={d} size={22} />
              {ripple?.startsWith(k) && <span key={ripple} className="lc-ripple" />}
            </button>
          ))}
        </Tile>
        <Tile className="lc-music" strength={strength}>
          <span className="lc-art" />
          <span><b>Golden Hour</b><span>Paper Lanterns</span></span>
          <button className="lc-pp" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>
            <Icon d={playing ? 'M7 4.5v11M13 4.5v11' : 'M7 4.5v11l9-5.5z'} />
          </button>
        </Tile>
        <Tube label="Brightness" icon="M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM10 2v2M10 16v2M2 10h2M16 10h2" value={bright} onChange={setBright} strength={strength} />
        <Tube label="Volume" icon="M3 8h3l4-3v10l-4-3H3zM13 7.5a3.5 3.5 0 0 1 0 5M15 5.5a6.5 6.5 0 0 1 0 9" value={vol} onChange={setVol} strength={strength} />
        <Tile className="lc-focus" strength={strength} role="button" tabIndex={0} aria-pressed={on.Focus} onClick={() => flip('Focus')}>
          <Icon d="M14.5 13A6.5 6.5 0 0 1 7 5.5 6.5 6.5 0 1 0 14.5 13z" size={22} />
          <span><b>Focus</b><small>{on.Focus ? 'Do not disturb' : 'Off'}</small></span>
        </Tile>
        {SMALL.map(([k, d]) => (
          <Tile key={k} className="lc-small" strength={strength} role="button" tabIndex={0} aria-label={k} aria-pressed={!!on[k]} onClick={() => flip(k)}>
            <Icon d={d} size={22} />
          </Tile>
        ))}
      </div>

      <button className="lc-handle" aria-label="Shortcuts" aria-expanded={tray} onClick={() => setTray(!tray)} />
      <div ref={trayRef} className={`lc-tray${tray ? ' open' : ''}`} style={trayGlass.style} aria-hidden={!tray}>
        {SMALL.map(([k, d]) => <button key={k} tabIndex={tray ? 0 : -1} aria-label={k}><Icon d={d} /></button>)}
      </div>
    </div>
  )
}
