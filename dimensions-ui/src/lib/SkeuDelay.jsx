import { useRef, useState } from 'react'
import { useDial } from '../ui/dial.js'

// Skeuomorphic stereo delay plugin, in the modern restrained style: two
// glossy knobs with tick rings (left and right delay times), faders with
// physical caps for gain, mix and the filters, and raised keys. In "split"
// mode the panel shows its light and dark themes side by side; centre
// labels use a difference blend so they read on both halves.

const PRESETS = ['Tape Echo', 'Slapback', 'Wide Room', 'Dub Throw', 'Ghost Taps']
const NOTES = ['1/16', '1/8', '1/8 d', '1/4', '1/4 d', '1/2']
const NOTE_MS = [125, 250, 375, 500, 750, 1000]
const SWEEP = 270

function Knob({ value, onChange, label, side, power }) {
  const ms = Math.round(20 + (value / 100) * 1180)
  const dial = useDial({ value, onChange, label: `${label} delay time`, valueText: `${ms} milliseconds`, disabled: !power })
  const a = (-135 + (value / 100) * SWEEP) * (Math.PI / 180)
  const R = 120, C = 2 * Math.PI * R
  return (
    <div className={`dly-knob ${side}`}>
      <div className="dly-dial" {...dial}>
        <svg viewBox="0 0 280 280" aria-hidden="true">
          <circle cx="140" cy="140" r={R} fill="none" className="dly-arc-bg" strokeWidth="3" strokeDasharray={`${(SWEEP / 360) * C} ${C}`} transform="rotate(135 140 140)" strokeLinecap="round" />
          <circle cx="140" cy="140" r={R} fill="none" className="dly-arc" strokeWidth="3" strokeDasharray={`${(value / 100) * (SWEEP / 360) * C} ${C}`} transform="rotate(135 140 140)" strokeLinecap="round" />
          {Array.from({ length: 36 }, (_, i) => {
            const t = (i / 35) * SWEEP - 135 - 90
            const x = 140 + Math.cos((t * Math.PI) / 180) * 98, y = 140 + Math.sin((t * Math.PI) / 180) * 98
            return <circle key={i} cx={x} cy={y} r="1.6" className="dly-tick" />
          })}
          {side === 'left' && <circle cx={140 + Math.cos(a - Math.PI / 2) * R} cy={140 + Math.sin(a - Math.PI / 2) * R} r="13" className="dly-ball" />}
        </svg>
        <div className="dly-cap" style={{ transform: `rotate(${-135 + (value / 100) * SWEEP}deg)` }}><i /></div>
      </div>
      <b>{label}</b>
      <small>{ms} ms</small>
    </div>
  )
}

function Fader({ value, onChange, label, min = 0, max = 100, unit = '%', fmt }) {
  const track = useRef(null)
  const dial = useDial({ value, onChange, label, min, max, axis: 'x', track, valueText: fmt ? fmt(value) : `${value}${unit}` })
  return (
    <div className="dly-fader">
      <span className="dly-flabel">{label}</span>
      <div className="dly-dots" aria-hidden="true">{Array.from({ length: 11 }, (_, i) => <i key={i} />)}</div>
      <div ref={track} className="dly-track" {...dial}>
        <span className="dly-fill" style={{ width: `${((value - min) / (max - min)) * 100}%` }} />
        <span className="dly-thumb" style={{ left: `${((value - min) / (max - min)) * 100}%` }} />
      </div>
    </div>
  )
}

export default function SkeuDelay({ theme = 'split', style }) {
  const [power, setPower] = useState(true)
  const [preset, setPreset] = useState(0)
  const [left, setLeft] = useState(62)
  const [right, setRight] = useState(78)
  const [gain, setGain] = useState(28)
  const [mix, setMix] = useState(72)
  const [lp, setLp] = useState(30)
  const [hp, setHp] = useState(72)
  const [link, setLink] = useState(false)
  const [ping, setPing] = useState(true)
  const [duck, setDuck] = useState(false)
  const [sync, setSync] = useState({ left: false, right: true })

  const setL = (v) => { setLeft(v); if (link) setRight(v) }
  const setR = (v) => { setRight(v); if (link) setLeft(v) }
  const snap = (side) => {
    const on = !sync[side]
    setSync({ ...sync, [side]: on })
    if (on) {
      const cur = side === 'left' ? left : right
      const ms = 20 + (cur / 100) * 1180
      const i = NOTE_MS.reduce((b, n, k) => (Math.abs(n - ms) < Math.abs(NOTE_MS[b] - ms) ? k : b), 0)
      const v = Math.round(((NOTE_MS[i] - 20) / 1180) * 100)
      side === 'left' ? setL(v) : setR(v)
    }
  }
  const noteOf = (v) => {
    const ms = 20 + (v / 100) * 1180
    return NOTES[NOTE_MS.reduce((b, n, k) => (Math.abs(n - ms) < Math.abs(NOTE_MS[b] - ms) ? k : b), 0)]
  }
  const hz = (v) => (v < 50 ? `${Math.round(20 * 1000 ** (v / 100))} Hz` : `${(20 * 1000 ** (v / 100) / 1000).toFixed(1)} kHz`)

  return (
    <div className={`dly-wrap t-${theme}${power ? '' : ' off'}`} style={style}>
      <style>{`
        .dly-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; display: grid; place-items: safe center; background: #e4e4e2; font: 500 13px/1.2 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 14px; box-sizing: border-box; }
        :where(.dly-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .dly-wrap { --lbg: #f5f5f4; --lface: #f7f7f6; --lline: #1c1c1c; --lmuted: #8a8a88; --dbg: #444; --dface: #3a3a3a; --dline: #f2f2f2; --dmuted: #c8c8c6; }
        .dly-wrap.t-light { --dbg: var(--lbg); --dface: var(--lface); --dline: var(--lline); --dmuted: var(--lmuted); }
        .dly-wrap.t-dark { --lbg: var(--dbg); --lface: var(--dface); --lline: var(--dline); --lmuted: var(--dmuted); }
        .dly { position: relative; width: min(100%, 880px); aspect-ratio: 1.55; min-height: 420px; border: 7px solid #121212; border-radius: 44px; overflow: hidden; background: linear-gradient(90deg, var(--lbg) 50%, var(--dbg) 50%); box-shadow: 0 30px 60px rgba(0,0,0,.25); transition: filter 300ms; }
        .dly-wrap.off .dly { filter: grayscale(1) brightness(.82); }
        .dly-notch { position: absolute; left: 35%; width: 30%; box-sizing: border-box; border: 1.5px solid #6b6b6b; background: linear-gradient(90deg, var(--lbg) 50%, var(--dbg) 50%); }
        .dly-notch.top { top: -2px; height: 32px; border-radius: 0 0 18px 18px; border-top: 0; display: grid; place-items: center; }
        .dly-notch.bottom { bottom: -2px; height: 104px; border-radius: 18px 18px 0 0; border-bottom: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 18px 26px 0; box-sizing: border-box; }
        .dly-blend { color: #fff; mix-blend-mode: difference; }
        .dly-preset { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }
        .dly-power { position: absolute; left: 22px; top: 22px; width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid var(--lline); color: var(--lline); display: grid; place-items: center; }
        .dly-power[aria-pressed='true'] { box-shadow: inset 0 0 0 3px var(--lbg), inset 0 0 0 5px var(--lline); }
        .dly-nav { position: absolute; right: 22px; top: 22px; display: flex; gap: 12px; }
        .dly-nav button { width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid var(--dline); color: var(--dline); display: grid; place-items: center; }
        .dly-keys { position: absolute; left: 50%; top: 60px; transform: translateX(-50%); display: flex; gap: 14px; }
        .dly-key { display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; height: 40px; padding: 0 22px; border-radius: 10px; font-weight: 500; letter-spacing: .06em; border: 2px solid #2a2a2a; box-shadow: 0 2px 0 #2a2a2a, 0 6px 10px rgba(0,0,0,.18), inset 0 2px 0 rgba(255,255,255,.5); transition: transform 100ms, box-shadow 100ms; }
        .dly-key[aria-pressed='true'] { transform: translateY(2px); box-shadow: 0 0 0 #2a2a2a, 0 2px 4px rgba(0,0,0,.2), inset 0 3px 6px rgba(0,0,0,.35); }
        .dly-key.l { background: linear-gradient(#fff, #e9e9e8); color: #1c1c1c; }
        .dly-key.r { background: linear-gradient(#4d4d4d, #343434); color: #f2f2f2; border-color: #1c1c1c; }
        .dly-key.mid { width: 250px; display: flex; justify-content: center; gap: 22px; align-items: center; background: linear-gradient(90deg, #f6f6f5, #e9e9e8 49.9%, #444 50%, #2f2f2f); padding: 0; }
        .dly-key.mid .a { color: #1c1c1c; }
        .dly-key.mid .b { color: #f2f2f2; }
        .dly-key[aria-pressed='true'] .lamp { box-shadow: 0 0 6px 2px #ffb347; background: #ffb347; }
        .lamp { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #9a9a98; margin-right: 8px; vertical-align: 1px; }
        .dly-knob { position: absolute; top: 22%; width: 26%; display: flex; flex-direction: column; align-items: center; }
        .dly-knob.left { left: 7%; --line: var(--lline); --muted: var(--lmuted); }
        .dly-knob.right { right: 7%; --line: var(--dline); --muted: var(--dmuted); }
        .dly-dial { position: relative; width: 100%; aspect-ratio: 1; border-radius: 50%; outline: none; }
        .dly-dial:focus-visible { box-shadow: 0 0 0 3px #ffb347; }
        .dly-dial svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
        .dly-arc-bg { stroke: color-mix(in srgb, var(--line) 18%, transparent); }
        .dly-arc { stroke: var(--line); }
        .dly-knob.right .dly-arc { filter: drop-shadow(0 0 6px rgba(255,255,255,.9)); }
        .dly-tick { fill: var(--line); opacity: .7; }
        .dly-ball { fill: #4a4a4a; stroke: #2a2a2a; stroke-width: 4; filter: drop-shadow(0 3px 3px rgba(0,0,0,.35)); }
        .dly-cap { position: absolute; inset: 24%; border-radius: 50%; background: radial-gradient(circle at 50% 30%, #6a6a6a, #3c3c3c 60%, #2a2a2a); box-shadow: 0 0 0 10px #303030, 0 0 0 11px #1c1c1c, 0 18px 28px rgba(0,0,0,.45), inset 0 3px 2px rgba(255,255,255,.25), inset 0 -6px 12px rgba(0,0,0,.4); }
        .dly-cap i { position: absolute; left: 50%; top: 9%; width: 7px; height: 7px; margin-left: -3.5px; border-radius: 50%; background: #f2f2f2; box-shadow: 0 0 6px rgba(255,255,255,.8); }
        .dly-knob.left .dly-cap i { display: none; }
        .dly-knob b { margin-top: 6px; font-size: 22px; font-weight: 400; letter-spacing: .02em; color: var(--line); }
        .dly-knob small { color: var(--muted); margin-top: 4px; font-variant-numeric: tabular-nums; }
        .dly-centre { position: absolute; left: 35.5%; top: 36%; width: 29%; display: flex; flex-direction: column; gap: 22px; }
        .dly-fader { position: relative; }
        .dly-flabel { display: block; text-align: center; letter-spacing: .16em; font-size: 12px; margin-bottom: 8px; color: #fff; mix-blend-mode: difference; }
        .dly-dots { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .dly-dots i { width: 2px; height: 2px; border-radius: 50%; background: #fff; mix-blend-mode: difference; }
        .dly-track { position: relative; height: 3px; background: linear-gradient(90deg, var(--lline) 50%, color-mix(in srgb, var(--dline) 45%, transparent) 50%); border-radius: 2px; outline: none; }
        .dly-track:focus-visible { box-shadow: 0 0 0 4px #ffb347; }
        .dly-fill { position: absolute; left: 50%; top: -1px; height: 5px; display: none; }
        .dly-thumb { position: absolute; top: 50%; width: 34px; height: 22px; margin: -11px 0 0 -17px; border-radius: 6px; background: linear-gradient(#6a6a6a, #3a3a3a); box-shadow: 0 0 0 1.5px #232323, 0 4px 6px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.3); pointer-events: none; }
        .dly-thumb::after { content: ''; position: absolute; left: 10px; right: 10px; top: 10px; height: 2px; background: #9a9a98; border-radius: 1px; }
        .dly-notch.bottom .dly-fader:first-child .dly-flabel, .dly-notch.bottom .dly-fader:first-child .dly-dots i { mix-blend-mode: normal; color: var(--lline); background: var(--lline); }
        .dly-notch.bottom .dly-fader:last-child .dly-flabel, .dly-notch.bottom .dly-fader:last-child .dly-dots i { mix-blend-mode: normal; color: var(--dline); background: var(--dline); }
        .dly-notch.bottom .dly-flabel { background: none !important; }
        .dly-notch.bottom .dly-fader:first-child .dly-track { background: linear-gradient(90deg, color-mix(in srgb, var(--lline) 30%, transparent) 0, var(--lline) 100%); }
        .dly-notch.bottom .dly-fader:last-child .dly-track { background: linear-gradient(90deg, var(--dline) 0, color-mix(in srgb, var(--dline) 40%, transparent) 100%); }
        .dly-hz { position: absolute; bottom: 14px; font-size: 11px; font-variant-numeric: tabular-nums; }
        .dly-sync { position: absolute; bottom: 4.5%; width: 92px; height: 46px; border-radius: 6px; letter-spacing: .06em; transition: box-shadow 120ms, transform 120ms; }
        .dly-sync.l { left: calc(7% + 13% - 46px); background: linear-gradient(#fff, #efefee); color: #1c1c1c; box-shadow: 0 2px 6px rgba(0,0,0,.12); }
        .dly-sync.r { right: calc(7% + 13% - 46px); background: linear-gradient(#5a5a5a, #3a3a3a); color: #f2f2f2; box-shadow: 0 2px 6px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.15); }
        .dly-sync[aria-pressed='true'] { transform: translateY(1px); box-shadow: inset 0 2px 6px rgba(0,0,0,.35); }
        .dly-sync span { display: block; font-size: 10.5px; opacity: .8; letter-spacing: 0; }
        @container (max-width: 720px) {
          .dly { aspect-ratio: auto; min-height: 0; height: max-content; flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 18px 12px; padding: 16px 14px 0; border-radius: 32px; }
          .dly > * { position: static !important; transform: none !important; }
          .dly-power { order: 1; justify-self: start; } .dly-nav { order: 2; justify-self: end; }
          .dly-notch.top { order: 3; grid-column: 1 / -1; justify-self: center; width: 70%; border: 1.5px solid #6b6b6b; border-radius: 16px; }
          .dly-keys { order: 4; grid-column: 1 / -1; justify-self: center; gap: 8px; } .dly-key { padding: 0 12px; height: 36px; font-size: 12px; } .dly-key.mid { width: 140px; gap: 12px; }
          .dly-knob { width: 100%; } .dly-knob.left { order: 5; } .dly-knob.right { order: 6; }
          .dly-sync { order: 7; justify-self: center; } .dly-sync.r { order: 8; }
          .dly-centre { order: 9; grid-column: 1 / -1; width: 100%; padding: 0 6px; box-sizing: border-box; }
          .dly-notch.bottom { order: 10; grid-column: 1 / -1; width: 100%; height: 96px; padding: 16px 18px 0; position: relative !important; left: 0; }
        }
        @media (prefers-reduced-motion: reduce) { .dly, .dly-key, .dly-sync { transition: none; } }
      `}</style>

      <section className="dly" aria-label="Stereo delay">
        <div className="dly-notch top"><span className="dly-preset dly-blend" aria-live="polite">{PRESETS[preset]}</span></div>
        <button className="dly-power" aria-pressed={power} aria-label="Power" onClick={() => setPower(!power)}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M10 3v6M6 6a6 6 0 1 0 8 0" /></svg>
        </button>
        <div className="dly-nav">
          <button aria-label="Previous preset" onClick={() => setPreset((preset + PRESETS.length - 1) % PRESETS.length)}><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 4l-6 6 6 6" /></svg></button>
          <button aria-label="Next preset" onClick={() => setPreset((preset + 1) % PRESETS.length)}><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M8 4l6 6-6 6" /></svg></button>
        </div>

        <div className="dly-keys">
          <button className="dly-key l" aria-pressed={link} onClick={() => { setLink(!link); if (!link) setRight(left) }}><span className="lamp" aria-hidden="true" />LINK</button>
          <button className="dly-key mid" aria-pressed={ping} aria-label="Ping pong" onClick={() => setPing(!ping)}><span className="a"><span className="lamp" aria-hidden="true" />PING</span><span className="b">PONG</span></button>
          <button className="dly-key r" aria-pressed={duck} onClick={() => setDuck(!duck)}><span className="lamp" aria-hidden="true" />DUCK</button>
        </div>

        <Knob side="left" label="LEFT" value={left} onChange={setL} power={power} />
        <Knob side="right" label="RIGHT" value={right} onChange={setR} power={power} />

        <div className="dly-centre">
          <Fader label="GAIN" value={gain} onChange={setGain} fmt={(v) => `${((v - 50) / 4).toFixed(1)} dB`} />
          <Fader label="MIX" value={mix} onChange={setMix} />
        </div>

        <button className="dly-sync l" aria-pressed={sync.left} onClick={() => snap('left')}>SYNC{sync.left && <span>{noteOf(left)}</span>}</button>
        <button className="dly-sync r" aria-pressed={sync.right} onClick={() => snap('right')}>SYNC{sync.right && <span>{noteOf(right)}</span>}</button>

        <div className="dly-notch bottom">
          <Fader label="LPASS" value={lp} onChange={setLp} fmt={hz} />
          <Fader label="HPASS" value={hp} onChange={setHp} fmt={hz} />
          <span className="dly-hz" style={{ left: 10, color: 'var(--lmuted)' }} aria-hidden="true">{hz(lp)}</span>
          <span className="dly-hz" style={{ right: 10, color: 'var(--dmuted)' }} aria-hidden="true">{hz(hp)}</span>
        </div>
      </section>
    </div>
  )
}
