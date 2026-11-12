import { useEffect, useRef, useState } from 'react'
import { useLens, specular } from '../liquid/lens.js'

// Liquid glass video controls over a looping scene drawn in code (sunset sea,
// rolling waves, gulls). Play, skip and volume are glass bubbles; the
// scrubber is a glass tube with a droplet playhead you can drag; chapters
// open in a refracting side panel; controls fade when you stop moving.

const LENGTH = 312
const CHAPTERS = [['Opening', 0], ['The tide turns', 74], ['Gulls', 151], ['Last light', 236]]
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function Bubble({ size, strength, label, onClick, children, className = '' }) {
  const ref = useRef(null)
  const g = useLens(ref, { radius: size / 2, depth: size / 2.2, strength })
  return (
    <>
      {g.filter}
      <button ref={ref} className={`lm-glass lm-bubble ${className}`} style={{ ...g.style, width: size, height: size }} aria-label={label} onClick={onClick} onPointerMove={specular}>{children}</button>
    </>
  )
}

export default function LiquidMedia({ strength = 70, autoHide = true, style }) {
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(48)
  const [vol, setVol] = useState(70)
  const [chapters, setChapters] = useState(false)
  const [awake, setAwake] = useState(true)
  const idle = useRef(null)
  const tube = useRef(null)
  const panel = useRef(null)
  const tubeGlass = useLens(tube, { radius: 14, depth: 13, strength })
  const panelGlass = useLens(panel, { radius: 24, depth: 26, strength: strength * 1.2, soften: 8 })

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((v) => (v + 0.25 >= LENGTH ? 0 : v + 0.25)), 250)
    return () => clearInterval(id)
  }, [playing])

  const wake = () => {
    setAwake(true)
    clearTimeout(idle.current)
    if (autoHide && playing) idle.current = setTimeout(() => setAwake(false), 2500)
  }
  useEffect(() => { wake(); return () => clearTimeout(idle.current) }, [playing, autoHide]) // eslint-disable-line react-hooks/exhaustive-deps

  const seek = (e) => {
    const r = tube.current.getBoundingClientRect()
    setT(Math.min(LENGTH, Math.max(0, ((e.clientX - r.left) / r.width) * LENGTH)))
  }
  const chapter = [...CHAPTERS].reverse().find((c) => t >= c[1])[0]
  const Icon = ({ d, fill }) => <svg viewBox="0 0 24 24" width="22" height="22" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>

  return (
    <div className={`lm-wrap${playing ? ' playing' : ''}${awake ? ' awake' : ''}`} style={style} onPointerMove={wake} onPointerDown={wake}>
      {tubeGlass.filter}{panelGlass.filter}
      <style>{`
        .lm-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; color: #fff; font: 600 12px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif; background: #0b1530; }
        :where(.lm-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .lm-scene { position: absolute; inset: 0; background: linear-gradient(180deg, #1b1f4b 0%, #8a3b6b 38%, #ff8a5b 56%, #ffc27a 62%); }
        .lm-scene * { animation-play-state: paused; }
        .lm-wrap.playing .lm-scene * { animation-play-state: running; }
        .lm-sun { position: absolute; left: 50%; top: 40%; width: 150px; height: 150px; margin-left: -75px; border-radius: 50%; background: radial-gradient(circle, #fff3c4 0 45%, #ffcf6b 46% 60%, rgba(255,207,107,0) 72%); animation: lm-sun 30s ease-in-out infinite alternate; }
        @keyframes lm-sun { to { transform: translateY(26px); } }
        .lm-sea { position: absolute; left: 0; right: 0; top: 60%; bottom: 0; background: linear-gradient(180deg, #ff9e6e, #6b3a6e 30%, #172452); }
        .lm-wave { position: absolute; left: -50%; width: 200%; height: 40px; animation: lm-roll linear infinite; }
        @keyframes lm-roll { to { transform: translateX(25%); } }
        .lm-gull { position: absolute; width: 28px; height: 10px; border-top: 3px solid #1b1f3a; border-radius: 50% 50% 0 0; animation: lm-fly 14s linear infinite; }
        .lm-gull::after { content: ''; position: absolute; left: 14px; top: -3px; width: 20px; height: 8px; border-top: 3px solid #1b1f3a; border-radius: 50% 50% 0 0; }
        @keyframes lm-fly { from { transform: translateX(-80px); } to { transform: translateX(1100px); } }
        .lm-title { position: absolute; left: 22px; top: 18px; font-size: 13px; text-shadow: 0 1px 3px rgba(0,0,0,.4); transition: opacity 400ms; }
        .lm-title small { display: block; font-weight: 500; opacity: .8; }
        .lm-ui { position: absolute; inset: 0; transition: opacity 400ms; }
        .lm-wrap:not(.awake) .lm-ui, .lm-wrap:not(.awake) .lm-title { opacity: 0; }
        .lm-glass { position: relative; background: rgba(15,15,30,.16); box-shadow: inset 0 1px 1px rgba(255,255,255,.75), inset 0 0 0 1px rgba(255,255,255,.22), 0 10px 26px rgba(0,0,0,.25); text-shadow: 0 1px 2px rgba(0,0,0,.35); }
        .lm-glass::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: radial-gradient(circle at var(--gx, 30%) var(--gy, 0%), rgba(255,255,255,.5), transparent 45%); mix-blend-mode: soft-light; }
        .lm-bubble { border-radius: 50%; display: grid; place-items: center; transition: transform 120ms; }
        .lm-bubble:active { transform: scale(.92); }
        .lm-center { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 22px; }
        .lm-bar { position: absolute; left: 22px; right: 22px; bottom: 18px; display: flex; align-items: center; gap: 12px; }
        .lm-time { font-variant-numeric: tabular-nums; text-shadow: 0 1px 3px rgba(0,0,0,.5); min-width: 38px; }
        .lm-tube { flex: 1; height: 28px; border-radius: 14px; cursor: pointer; touch-action: none; }
        .lm-played { position: absolute; left: 4px; top: 50%; height: 6px; margin-top: -3px; border-radius: 3px; background: rgba(255,255,255,.85); pointer-events: none; }
        .lm-drop { position: absolute; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #e8eefc 40%, #b7c5e8); box-shadow: 0 2px 6px rgba(0,0,0,.35); pointer-events: none; }
        .lm-marks i { position: absolute; top: 50%; width: 2px; height: 10px; margin-top: -5px; background: rgba(255,255,255,.55); pointer-events: none; }
        .lm-vol { display: flex; align-items: center; gap: 8px; }
        .lm-vol input { width: 80px; accent-color: #fff; }
        .lm-chbtn { border-radius: 14px; padding: 7px 12px; }
        .lm-panel { position: absolute; top: 14px; right: 14px; width: 230px; border-radius: 24px; padding: 14px; display: flex; flex-direction: column; gap: 4px; transform: translateX(120%); transition: transform 380ms cubic-bezier(.2,.9,.2,1); }
        .lm-panel.open { transform: none; }
        .lm-panel h4 { margin: 0 0 4px 6px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; opacity: .85; }
        .lm-panel button { display: flex; justify-content: space-between; padding: 9px 10px; border-radius: 12px; text-align: left; }
        .lm-panel button:hover { background: rgba(255,255,255,.14); }
        .lm-panel button[aria-current='true'] { background: rgba(255,255,255,.28); }
        @container (max-width: 520px) { .lm-vol input { display: none; } .lm-center { gap: 12px; } }
        @media (prefers-reduced-motion: reduce) { .lm-scene * { animation: none !important; } }
      `}</style>

      <div className="lm-scene" aria-hidden="true">
        <div className="lm-sun" />
        <div className="lm-sea">
          {[[6, '#ffb184', 9], [28, '#a0537a', 7], [52, '#3a3a78', 5.5], [78, '#1b2558', 4]].map(([top, c, dur], i) => (
            <svg key={i} className="lm-wave" style={{ top: `${top}%`, animationDuration: `${dur}s` }} viewBox="0 0 800 40" preserveAspectRatio="none">
              <path d={`M0 20 ${Array.from({ length: 16 }, (_, k) => `Q${k * 50 + 25} ${k % 2 ? 34 : 6} ${k * 50 + 50} 20`).join(' ')} V40 H0Z`} fill={c} opacity=".85" />
            </svg>
          ))}
        </div>
        <i className="lm-gull" style={{ top: '20%', animationDelay: '-3s' }} />
        <i className="lm-gull" style={{ top: '27%', animationDelay: '-8s', scale: '.7' }} />
      </div>

      <div className="lm-title"><b>Low Tide</b><small>{chapter}</small></div>

      <div className="lm-ui">
        <div className="lm-center">
          <Bubble size={54} strength={strength} label="Back 10 seconds" onClick={() => setT(Math.max(0, t - 10))}><Icon d="M11 5L4 12l7 7M20 5l-7 7 7 7" /></Bubble>
          <Bubble size={84} strength={strength} label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>
            {playing ? <Icon d="M9 5v14M15 5v14" /> : <Icon d="M8 5.5v13l11-6.5z" fill />}
          </Bubble>
          <Bubble size={54} strength={strength} label="Forward 10 seconds" onClick={() => setT(Math.min(LENGTH, t + 10))}><Icon d="M13 5l7 7-7 7M4 5l7 7-7 7" /></Bubble>
        </div>

        <div className="lm-bar">
          <span className="lm-time">{fmt(t)}</span>
          <div
            ref={tube}
            className="lm-glass lm-tube"
            style={tubeGlass.style}
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={LENGTH}
            aria-valuenow={Math.floor(t)}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e) }}
            onPointerMove={(e) => { specular(e); if (e.buttons) seek(e) }}
            onKeyDown={(e) => { if (e.key === 'ArrowRight') setT(Math.min(LENGTH, t + 5)); if (e.key === 'ArrowLeft') setT(Math.max(0, t - 5)) }}
          >
            <span className="lm-marks">{CHAPTERS.slice(1).map(([n, s]) => <i key={n} style={{ left: `${(s / LENGTH) * 100}%` }} />)}</span>
            <span className="lm-played" style={{ width: `calc(${(t / LENGTH) * 100}% - 4px)` }} />
            <span className="lm-drop" style={{ left: `${(t / LENGTH) * 100}%` }} />
          </div>
          <span className="lm-time">{fmt(LENGTH)}</span>
          <label className="lm-vol">
            <Icon d={vol === 0 ? 'M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6' : 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7'} />
            <input type="range" min="0" max="100" value={vol} onChange={(e) => setVol(+e.target.value)} aria-label="Volume" />
          </label>
          <button className="lm-glass lm-chbtn" aria-expanded={chapters} onClick={() => setChapters(!chapters)}>Chapters</button>
        </div>
      </div>

      <aside ref={panel} className={`lm-glass lm-panel${chapters ? ' open' : ''}`} style={panelGlass.style} onPointerMove={specular} aria-hidden={!chapters}>
        <h4>Chapters</h4>
        {CHAPTERS.map(([n, s]) => (
          <button key={n} tabIndex={chapters ? 0 : -1} aria-current={n === chapter} onClick={() => setT(s)}>
            <span>{n}</span><span>{fmt(s)}</span>
          </button>
        ))}
      </aside>
    </div>
  )
}
