import { useEffect, useRef, useState } from 'react'
import { useDial } from '../ui/dial.js'
import { useOnScreen } from '../ui/onscreen.js'

// Skeuomorphic hi-fi: a walnut cabinet with a turntable whose record spins
// and tonearm swings in when playing, two glowing VU meters, chrome rotary
// knobs (volume, tone), push-button source selectors and a crate of records
// to flip through. Meters pause off-screen; motion respects reduced motion.

const RECORDS = [
  ['Blue Hour', 'The Lanterns', '#2f5d8c', '#f2c14e'],
  ['Copper Sun', 'Ada Moreno', '#b5562b', '#f6e7c8'],
  ['Night Garden', 'Kofi & Co.', '#2e6b4f', '#e8d5a3'],
  ['Paper Moon', 'June Halden', '#6b4a8c', '#f0d6e8'],
  ['Saltwater', 'Marlow Vance', '#1f7a7a', '#ffd9a0'],
]
const SOURCES = ['Phono', 'Tape', 'Tuner']

function Knob({ value, onChange, label }) {
  const dial = useDial({ value, onChange, label, valueText: `${value}%` })
  return (
    <div className="hf-knob">
      <div className="hf-dial" {...dial}><i style={{ transform: `rotate(${-135 + value * 2.7}deg)` }} /></div>
      <span>{label}</span>
    </div>
  )
}

function Meter({ level, label }) {
  const a = -50 + Math.min(1, level) * 100
  return (
    <div className="hf-vu" role="meter" aria-label={`${label} level`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
      <svg viewBox="0 0 160 90" aria-hidden="true">
        <path d="M20 70 A70 70 0 0 1 140 70" fill="none" stroke="#3a2a14" strokeWidth="1.2" />
        <path d="M108 33 A70 70 0 0 1 140 70" fill="none" stroke="#c0352b" strokeWidth="4" />
        {Array.from({ length: 11 }, (_, i) => { const t = (-50 + i * 10) * (Math.PI / 180); return <line key={i} x1={80 + Math.sin(t) * 62} y1={84 - Math.cos(t) * 62} x2={80 + Math.sin(t) * 70} y2={84 - Math.cos(t) * 70} stroke="#3a2a14" strokeWidth="1.2" /> })}
        <text x="80" y="58" textAnchor="middle" fontSize="11" fontFamily="Georgia, serif" fill="#3a2a14">VU</text>
        <line x1="80" y1="84" x2={80 + Math.sin((a * Math.PI) / 180) * 72} y2={84 - Math.cos((a * Math.PI) / 180) * 72} stroke="#1a1a1a" strokeWidth="1.6" style={{ transition: 'all 120ms ease-out' }} />
        <circle cx="80" cy="84" r="5" fill="#1a1a1a" />
      </svg>
      <small>{label}</small>
    </div>
  )
}

export default function SkeuHifi({ style }) {
  const root = useRef(null)
  const visible = useOnScreen(root)
  const [playing, setPlaying] = useState(false)
  const [rec, setRec] = useState(0)
  const [vol, setVol] = useState(58)
  const [tone, setTone] = useState(50)
  const [source, setSource] = useState('Phono')
  const [levels, setLevels] = useState([0, 0])

  useEffect(() => {
    if (!playing || !visible || source !== 'Phono') { setLevels([0, 0]); return }
    const id = setInterval(() => setLevels([0, 1].map(() => (vol / 100) * (0.55 + Math.random() * 0.45))), 140)
    return () => clearInterval(id)
  }, [playing, visible, vol, source])

  const [title, artist, c1, c2] = RECORDS[rec]

  return (
    <div ref={root} className={`hf-wrap${playing ? ' playing' : ''}`} data-paused={visible ? undefined : ''} style={style}>
      <style>{`
        .hf-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: radial-gradient(ellipse at 50% 0%, #4b3a2a, #1d1611 70%); color: #f3e9d7; font: 600 12px/1.3 Georgia, 'Times New Roman', serif; padding: 18px; box-sizing: border-box; display: grid; align-content: safe center; }
        :where(.hf-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .hf-wrap[data-paused] * { animation-play-state: paused !important; }
        .hf { display: grid; grid-template-columns: 1fr 190px; gap: 16px; max-width: 980px; width: 100%; margin: 0 auto; }
        .hf-cab { border-radius: 14px; padding: 16px; background: repeating-linear-gradient(92deg, rgba(0,0,0,.08) 0 3px, transparent 3px 11px), repeating-linear-gradient(88deg, rgba(255,255,255,.04) 0 2px, transparent 2px 17px), linear-gradient(180deg, #8a5a33, #6b4224 60%, #5a361c); box-shadow: inset 0 2px 0 rgba(255,255,255,.25), inset 0 -6px 12px rgba(0,0,0,.35), 0 20px 40px rgba(0,0,0,.5); display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; }
        .hf-deck { position: relative; aspect-ratio: 1.15; border-radius: 10px; background: linear-gradient(145deg, #2a2a2c, #161617); box-shadow: inset 0 0 0 2px #0b0b0b, inset 0 2px 0 rgba(255,255,255,.08); overflow: hidden; }
        .hf-platter { position: absolute; left: 8%; top: 10%; width: 72%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, #555 0 4%, #2b2b2b 5%), conic-gradient(#3a3a3a, #222, #3a3a3a, #222, #3a3a3a); box-shadow: 0 10px 20px rgba(0,0,0,.6); }
        .hf-record { position: absolute; inset: 3%; border-radius: 50%; background: repeating-radial-gradient(circle, #111 0 2px, #1b1b1b 2px 3px); animation: hf-spin 1.8s linear infinite; animation-play-state: paused; }
        .hf-wrap.playing .hf-record { animation-play-state: running; }
        .hf-record::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 30deg, transparent 0 20%, rgba(255,255,255,.08) 25%, transparent 32% 70%, rgba(255,255,255,.06) 75%, transparent 82%); }
        .hf-label { position: absolute; inset: 34%; border-radius: 50%; display: grid; place-items: start center; padding-top: 22% !important; text-align: center; font-size: 8px; line-height: 1.1; color: #111; padding: 4px; }
        .hf-label::after { content: ''; position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px; border-radius: 50%; background: #ddd; box-shadow: inset 0 1px 1px #777; }
        @keyframes hf-spin { to { transform: rotate(360deg); } }
        .hf-arm { position: absolute; right: 9%; top: 9%; width: 14px; height: 62%; transform-origin: 50% 7px; transform: rotate(-4deg); transition: transform 900ms cubic-bezier(.3,.7,.3,1); }
        .hf-wrap.playing .hf-arm { transform: rotate(24deg); }
        .hf-arm::before { content: ''; position: absolute; left: -6px; top: -6px; width: 26px; height: 26px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #f2f2f2, #9a9a9a 60%, #5a5a5a); box-shadow: 0 3px 6px rgba(0,0,0,.6); }
        .hf-arm::after { content: ''; position: absolute; left: 5px; top: 12px; width: 4px; height: calc(100% - 10px); border-radius: 2px; background: linear-gradient(90deg, #8d8d8d, #f4f4f4, #8d8d8d); box-shadow: 1px 2px 3px rgba(0,0,0,.5); }
        .hf-arm i { position: absolute; left: -2px; bottom: -14px; width: 18px; height: 22px; border-radius: 3px; background: linear-gradient(#cfcfcf, #6f6f6f); transform: rotate(18deg); }
        .hf-panel { display: flex; flex-direction: column; gap: 12px; }
        .hf-meters { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .hf-vu { border-radius: 8px; padding: 6px 6px 4px; background: radial-gradient(ellipse at 50% 120%, #ffd98a, #f6d48c 30%, #e9b45a 90%); box-shadow: inset 0 0 0 3px #2b1d10, inset 0 0 18px rgba(255,170,60,.6), 0 0 18px rgba(255,180,80,.25); text-align: center; color: #3a2a14; }
        .hf-wrap:not(.playing) .hf-vu { filter: brightness(.82) saturate(.8); }
        .hf-vu svg { display: block; width: 100%; }
        .hf-vu small { font-size: 10px; letter-spacing: .12em; }
        .hf-face { border-radius: 10px; padding: 12px; background: linear-gradient(180deg, #e8e8e6, #b9b9b6); color: #1f1f1f; box-shadow: inset 0 1px 0 #fff, inset 0 -2px 3px rgba(0,0,0,.25), 0 4px 10px rgba(0,0,0,.4); display: grid; grid-template-columns: auto auto 1fr; gap: 14px; align-items: center; }
        .hf-knob { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
        .hf-dial { position: relative; width: 58px; height: 58px; border-radius: 50%; background: repeating-conic-gradient(#d9d9d6 0 4deg, #a5a5a2 4deg 8deg); box-shadow: 0 4px 8px rgba(0,0,0,.4), inset 0 0 0 4px rgba(255,255,255,.35); outline: none; }
        .hf-dial::before { content: ''; position: absolute; inset: 8px; border-radius: 50%; background: radial-gradient(circle at 40% 30%, #ffffff, #c9c9c6 55%, #8f8f8c); box-shadow: inset 0 -2px 3px rgba(0,0,0,.25); }
        .hf-dial:focus-visible { box-shadow: 0 0 0 3px #ffb347; }
        .hf-dial i { position: absolute; inset: 0; }
        .hf-dial i::after { content: ''; position: absolute; left: 50%; top: 10px; width: 3px; height: 12px; margin-left: -1.5px; border-radius: 2px; background: #c0352b; }
        .hf-src { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
        .hf-src button { padding: 9px 10px; border-radius: 6px; background: linear-gradient(#fafafa, #d2d2cf); box-shadow: 0 3px 0 #8a8a87, 0 4px 6px rgba(0,0,0,.25); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; transition: transform 90ms, box-shadow 90ms; }
        .hf-src button[aria-checked='true'] { transform: translateY(3px); box-shadow: 0 0 0 #8a8a87, inset 0 2px 4px rgba(0,0,0,.25); background: linear-gradient(#e2e2df, #c4c4c1); }
        .hf-src button[aria-checked='true']::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ff8a3d; box-shadow: 0 0 6px #ff8a3d; margin-right: 6px; vertical-align: 1px; }
        .hf-play { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; background: #1c1612; box-shadow: inset 0 2px 6px rgba(0,0,0,.6); }
        .hf-play button { width: 46px; height: 46px; border-radius: 50%; background: radial-gradient(circle at 40% 30%, #fff, #c9c9c6 60%, #8f8f8c); color: #1f1f1f; box-shadow: 0 4px 8px rgba(0,0,0,.5); display: grid; place-items: center; }
        .hf-play button:active { transform: scale(.95); }
        .hf-play b { display: block; font-size: 15px; }
        .hf-play small { color: #c9b89c; font-weight: 400; font-style: italic; font-size: 12.5px; }
        .hf-crate { border-radius: 12px; padding: 10px; background: repeating-linear-gradient(0deg, #6b4224 0 26px, #5a361c 26px 28px); box-shadow: inset 0 0 0 3px #3b2412, 0 16px 30px rgba(0,0,0,.5); display: flex; flex-direction: column; gap: 6px; }
        .hf-crate h3 { margin: 0 0 4px; text-align: center; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #f3e9d7; }
        .hf-sleeve { display: flex; gap: 8px; align-items: center; padding: 6px; border-radius: 6px; text-align: left; background: rgba(0,0,0,.25); transition: transform 150ms, background 150ms; }
        .hf-sleeve:hover { transform: translateX(-4px) rotate(-1deg); }
        .hf-sleeve[aria-current='true'] { background: rgba(255,217,138,.18); box-shadow: inset 0 0 0 1px rgba(255,217,138,.5); }
        .hf-sleeve i { width: 38px; height: 38px; border-radius: 3px; flex: none; box-shadow: 0 2px 4px rgba(0,0,0,.5); }
        .hf-sleeve b { display: block; font-size: 12px; }
        .hf-sleeve small { font-weight: 400; color: #e3d2b4; font-size: 11px; }
        @container (max-width: 720px) { .hf { grid-template-columns: 1fr; } .hf-cab { grid-template-columns: 1fr; } .hf-crate { flex-direction: row; overflow-x: auto; } .hf-crate h3 { display: none; } .hf-sleeve { flex: none; } }
        @media (prefers-reduced-motion: reduce) { .hf-record { animation: none; } .hf-arm, .hf-sleeve { transition: none; } }
      `}</style>

      <div className="hf">
        <section className="hf-cab" aria-label="Turntable and amplifier">
          <div className="hf-deck">
            <div className="hf-platter">
              <div className="hf-record"><div className="hf-label" style={{ background: c2 }}><span style={{ color: c1, fontWeight: 700 }}>{title}</span></div></div>
            </div>
            <div className="hf-arm" aria-hidden="true"><i /></div>
          </div>
          <div className="hf-panel">
            <div className="hf-meters"><Meter level={levels[0]} label="Left" /><Meter level={levels[1]} label="Right" /></div>
            <div className="hf-face">
              <Knob value={vol} onChange={setVol} label="Volume" />
              <Knob value={tone} onChange={setTone} label="Tone" />
              <div className="hf-src" role="radiogroup" aria-label="Source">
                {SOURCES.map((s) => <button key={s} role="radio" aria-checked={s === source} onClick={() => setSource(s)}>{s}</button>)}
              </div>
            </div>
            <div className="hf-play">
              <button aria-label={playing ? 'Stop' : 'Play'} onClick={() => setPlaying(!playing)}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">{playing ? <rect x="5" y="5" width="10" height="10" rx="1.5" /> : <path d="M6 4.5v11l9.5-5.5z" />}</svg>
              </button>
              <div><b>{title}</b><small>{artist} · {source === 'Phono' ? (playing ? 'Side A, playing' : 'Ready') : `${source} selected`}</small></div>
            </div>
          </div>
        </section>

        <aside className="hf-crate" aria-label="Record crate">
          <h3>Crate</h3>
          {RECORDS.map(([t, a, x, y], i) => (
            <button key={t} className="hf-sleeve" aria-current={i === rec} onClick={() => { setRec(i); setSource('Phono') }}>
              <i style={{ background: `radial-gradient(circle at 30% 30%, ${y} 0 18%, transparent 19%), linear-gradient(135deg, ${x}, #111)` }} aria-hidden="true" />
              <span><b>{t}</b><small>{a}</small></span>
            </button>
          ))}
        </aside>
      </div>
    </div>
  )
}
