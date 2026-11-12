import { useRef, useState } from 'react'
import { useDial } from '../ui/dial.js'

// Skeuomorphic analogue camera: brushed-metal body with a leatherette grip,
// a glass viewfinder whose exposure follows the knurled ISO and shutter
// dials, a mode dial that clicks between Photo / Video / Portrait, a chrome
// shutter button with a flash, and a film strip of the shots you've taken.

const ISOS = [100, 200, 400, 800, 1600, 3200]
const SHUTTERS = ['1/1000', '1/500', '1/250', '1/125', '1/60', '1/30', '1/15']
const MODES = ['Photo', 'Video', 'Portrait']
const ROLL = 24

function Scene({ exposure, mode, id }) {
  const b = Math.max(0.35, Math.min(1.9, exposure))
  return (
    <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" style={{ filter: `brightness(${b}) contrast(${mode === 'Portrait' ? 1.05 : 1}) saturate(${mode === 'Video' ? 0.9 : 1.1})` }} aria-hidden="true">
      <defs><linearGradient id={`sk-sky${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f2b07a" /><stop offset="1" stopColor="#ffe3b8" /></linearGradient></defs>
      <rect width="300" height="200" fill={`url(#sk-sky${id})`} />
      <circle cx="210" cy="78" r="22" fill="#fff4d6" />
      <path d="M0 140 L60 90 L110 125 L170 70 L240 120 L300 95 V200 H0Z" fill="#8a6f8f" />
      <path d="M0 160 L80 120 L150 150 L220 115 L300 145 V200 H0Z" fill="#5d4a6b" />
      <rect y="168" width="300" height="32" fill="#3b2f48" />
      {mode === 'Portrait' && <g><ellipse cx="110" cy="200" rx="46" ry="60" fill="#2a2233" /><circle cx="110" cy="120" r="24" fill="#2a2233" /></g>}
    </svg>
  )
}

function Dial({ label, options, index, setIndex }) {
  const dial = useDial({ value: index, onChange: setIndex, min: 0, max: options.length - 1, step: 1, label, valueText: `${options[index]}`, sensitivity: 0.08 })
  return (
    <div className="cm-dialbox">
      <span className="cm-dlabel">{label}</span>
      <div className="cm-knurl" {...dial}><i style={{ transform: `rotate(${index * (300 / (options.length - 1)) - 150}deg)` }} /></div>
      <b>{options[index]}</b>
    </div>
  )
}

export default function SkeuCamera({ style }) {
  const [iso, setIso] = useState(2)
  const [sh, setSh] = useState(3)
  const [mode, setMode] = useState(0)
  const [shots, setShots] = useState([])
  const [flash, setFlash] = useState(false)
  const [rec, setRec] = useState(false)
  const nextId = useRef(1)

  // exposure: each ISO stop and each slower shutter stop doubles the light
  const exposure = (2 ** (iso - 2) * 2 ** (sh - 3)) ** 0.5
  const left = ROLL - shots.length
  const meter = exposure > 1.35 ? 'Over' : exposure < 0.72 ? 'Under' : 'OK'

  const fire = () => {
    if (MODES[mode] === 'Video') { setRec(!rec); return }
    if (!left) return
    setFlash(true)
    setTimeout(() => setFlash(false), 140)
    setShots([{ id: nextId.current++, exposure, mode: MODES[mode], iso: ISOS[iso], sh: SHUTTERS[sh] }, ...shots])
  }

  return (
    <div className="cm-wrap" style={style}>
      <style>{`
        .cm-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: radial-gradient(ellipse at 50% 30%, #3a3d44, #15161a 75%); color: #1d1d1d; font: 600 12px/1.3 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 18px; box-sizing: border-box; display: grid; align-content: safe center; }
        :where(.cm-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .cm { display: grid; grid-template-columns: 1fr 150px; gap: 16px; max-width: 980px; width: 100%; margin: 0 auto; }
        .cm-body { position: relative; border-radius: 22px; padding: 18px; background: repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, transparent 1px 3px), linear-gradient(180deg, #e9e9e7, #b8b8b4 45%, #d7d7d4); box-shadow: inset 0 2px 0 #fff, inset 0 -3px 6px rgba(0,0,0,.25), 0 24px 40px rgba(0,0,0,.6); display: grid; grid-template-columns: 110px 1fr 150px; gap: 16px; align-items: center; }
        .cm-grip { align-self: stretch; border-radius: 14px; background: radial-gradient(#2a2a2a 1px, transparent 1.4px) 0 0 / 5px 5px, radial-gradient(#1a1a1a 1px, transparent 1.4px) 2.5px 2.5px / 5px 5px, #222; box-shadow: inset 0 2px 4px rgba(0,0,0,.8), inset 0 -1px 0 rgba(255,255,255,.08); position: relative; }
        .cm-brand { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); color: #d9d9d6; font: 700 12px/1 Georgia, serif; letter-spacing: .2em; }
        .cm-vf { position: relative; aspect-ratio: 3 / 2; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 0 0 6px #1b1b1b, 0 0 0 8px #8f8f8c, inset 0 0 20px rgba(0,0,0,.6); }
        .cm-vf svg { width: 100%; height: 100%; display: block; }
        .cm-vf::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.22), transparent 40%), radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.45)); pointer-events: none; }
        .cm-hud { position: absolute; left: 8px; right: 8px; bottom: 6px; display: flex; justify-content: space-between; color: #9dff9d; font: 700 11px/1 'Courier New', monospace; text-shadow: 0 0 4px #000; z-index: 1; }
        .cm-frame { position: absolute; inset: 16%; border: 1px dashed rgba(255,255,255,.5); z-index: 1; pointer-events: none; }
        .cm-rec { position: absolute; top: 8px; right: 10px; z-index: 1; color: #ff5a5a; font: 700 11px/1 'Courier New', monospace; }
        .cm-flash { position: absolute; inset: 0; background: #fff; z-index: 2; }
        .cm-controls { display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .cm-shutter { width: 74px; height: 74px; border-radius: 50%; background: radial-gradient(circle at 40% 30%, #ffffff, #cfcfcc 45%, #8d8d8a 80%); box-shadow: 0 0 0 6px #9a9a97, 0 0 0 8px #5a5a58, 0 8px 14px rgba(0,0,0,.4), inset 0 -4px 6px rgba(0,0,0,.25); transition: transform 80ms; }
        .cm-shutter:active { transform: scale(.94); box-shadow: 0 0 0 6px #9a9a97, 0 0 0 8px #5a5a58, inset 0 3px 8px rgba(0,0,0,.4); }
        .cm-shutter.rec { background: radial-gradient(circle at 40% 30%, #ff9a9a, #d02b2b 60%); }
        .cm-modes { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: #2a2a2a; box-shadow: inset 0 2px 4px rgba(0,0,0,.7); }
        .cm-modes button { padding: 6px 9px; border-radius: 999px; color: #d9d9d6; font-size: 11px; }
        .cm-modes button[aria-checked='true'] { background: linear-gradient(#f4f4f2, #bdbdb9); color: #1d1d1d; box-shadow: 0 1px 2px rgba(0,0,0,.5); }
        .cm-dials { display: flex; gap: 14px; }
        .cm-dialbox { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .cm-dlabel { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #3d3d3b; }
        .cm-knurl { position: relative; width: 54px; height: 54px; border-radius: 50%; background: repeating-conic-gradient(#3a3a38 0 5deg, #6a6a67 5deg 10deg); box-shadow: 0 4px 8px rgba(0,0,0,.4); outline: none; }
        .cm-knurl::before { content: ''; position: absolute; inset: 7px; border-radius: 50%; background: radial-gradient(circle at 40% 30%, #4a4a48, #1f1f1e); }
        .cm-knurl:focus-visible { box-shadow: 0 0 0 3px #ffb347; }
        .cm-knurl i { position: absolute; inset: 0; transition: transform 120ms; }
        .cm-knurl i::after { content: ''; position: absolute; left: 50%; top: 9px; width: 3px; height: 10px; margin-left: -1.5px; background: #f2f2f2; border-radius: 2px; }
        .cm-dialbox b { font: 700 12px/1 'Courier New', monospace; color: #1d1d1d; }
        .cm-meter { font: 700 11px/1 'Courier New', monospace; }
        .cm-roll { border-radius: 10px; padding: 10px 14px; background: #1b1814; box-shadow: inset 0 2px 6px rgba(0,0,0,.6); display: flex; flex-direction: column; gap: 6px; color: #e8dcc6; }
        .cm-roll h3 { margin: 0; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; text-align: center; }
        .cm-strip { position: relative; padding: 8px 14px; background: #3a2a18; border-radius: 4px; display: flex; flex-direction: column; gap: 6px; min-height: 120px; }
        .cm-strip::before, .cm-strip::after { content: ''; position: absolute; top: 4px; bottom: 4px; width: 6px; background: repeating-linear-gradient(0deg, #f2e6cf 0 5px, transparent 5px 11px); border-radius: 1px; }
        .cm-strip::before { left: 4px; } .cm-strip::after { right: 4px; }
        .cm-shot { aspect-ratio: 3 / 2; overflow: hidden; border-radius: 2px; filter: sepia(.35); }
        .cm-shot svg { width: 100%; height: 100%; display: block; }
        .cm-empty { color: #b9a988; font-weight: 400; font-style: italic; text-align: center; padding: 18px 0; }
        @container (max-width: 760px) { .cm { grid-template-columns: 1fr; } .cm-body { grid-template-columns: 1fr; } .cm-grip { display: none; } .cm-controls { flex-direction: row; flex-wrap: wrap; justify-content: center; } .cm-strip { flex-direction: row; overflow-x: auto; min-height: 0; } .cm-shot { width: 90px; flex: none; } }
        @media (prefers-reduced-motion: reduce) { .cm-knurl i, .cm-shutter { transition: none; } }
      `}</style>

      <div className="cm">
        <section className="cm-body" aria-label="Camera">
          <div className="cm-grip" aria-hidden="true"><span className="cm-brand">LUMEN</span></div>
          <div className="cm-vf">
            <Scene exposure={exposure} mode={MODES[mode]} id="vf" />
            <span className="cm-frame" aria-hidden="true" />
            {rec && <span className="cm-rec" role="status">● REC</span>}
            <div className="cm-hud" aria-live="polite"><span>ISO {ISOS[iso]}</span><span>{SHUTTERS[sh]}</span><span>{MODES[mode] === 'Video' ? 'VID' : `${left} left`}</span></div>
            {flash && <div className="cm-flash" aria-hidden="true" />}
          </div>
          <div className="cm-controls">
            <button className={`cm-shutter${rec ? ' rec' : ''}`} aria-label={MODES[mode] === 'Video' ? (rec ? 'Stop recording' : 'Start recording') : 'Take photo'} onClick={fire} />
            <div className="cm-modes" role="radiogroup" aria-label="Mode">
              {MODES.map((m, i) => <button key={m} role="radio" aria-checked={i === mode} onClick={() => { setMode(i); setRec(false) }}>{m}</button>)}
            </div>
            <div className="cm-dials">
              <Dial label="ISO" options={ISOS} index={iso} setIndex={setIso} />
              <Dial label="Shutter" options={SHUTTERS} index={sh} setIndex={setSh} />
            </div>
            <span className="cm-meter" style={{ color: meter === 'OK' ? '#12803c' : '#b42318' }} role="status">Meter: {meter}</span>
          </div>
        </section>

        <aside className="cm-roll" aria-label="Film roll">
          <h3>Roll · {shots.length}/{ROLL}</h3>
          <div className="cm-strip">
            {!shots.length && <p className="cm-empty">No shots yet</p>}
            {shots.slice(0, 6).map((s) => <div key={s.id} className="cm-shot" title={`ISO ${s.iso}, ${s.sh}`}><Scene exposure={s.exposure} mode={s.mode} id={s.id} /></div>)}
          </div>
        </aside>
      </div>
    </div>
  )
}
