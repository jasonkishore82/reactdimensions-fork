import { readableOn, textOn } from '../ui/color.js'
import { useEffect, useRef, useState } from 'react'
import { useOnScreen } from '../ui/onscreen.js'

// Neumorphic audio mixer. Each channel is a strip with a recessed fader
// track and a raised cap you drag, an LED meter that dances while playing,
// and mute / solo keys that stay pressed in and light up. A recessed
// segmented control switches between the faders and a row of EQ knobs.

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

const CHANNELS = ['Vocals', 'Guitar', 'Bass', 'Drums', 'Keys', 'Master']
const EQ = ['Low', 'Low-mid', 'Mid', 'High-mid', 'High']
const VIEWS = ['Mix', 'EQ', 'Effects']

function Fader({ value, onChange, label }) {
  const track = useRef(null)
  const set = (e) => {
    const r = track.current.getBoundingClientRect()
    onChange(Math.round(Math.min(100, Math.max(0, ((r.bottom - e.clientY) / r.height) * 100))))
  }
  return (
    <div
      ref={track}
      className="nm-fader nm-in"
      role="slider"
      tabIndex={0}
      aria-label={`${label} level`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e) }}
      onPointerMove={(e) => e.buttons && set(e)}
      onKeyDown={(e) => { if (e.key === 'ArrowUp') onChange(Math.min(100, value + 5)); if (e.key === 'ArrowDown') onChange(Math.max(0, value - 5)) }}
    >
      <span className="nm-fill" style={{ height: `${value}%` }} />
      <span className="nm-cap nm-up" style={{ bottom: `calc(${value}% - 11px)` }} />
    </div>
  )
}

function Knob({ value, onChange, label }) {
  const start = useRef(null)
  const angle = -135 + (value / 100) * 270
  return (
    <div className="nm-knob-wrap">
      <div
        className="nm-knob nm-up"
        role="slider"
        tabIndex={0}
        aria-label={`${label} gain`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = [e.clientY, value] }}
        onPointerMove={(e) => { if (e.buttons && start.current) onChange(Math.round(Math.min(100, Math.max(0, start.current[1] + (start.current[0] - e.clientY) * 0.8)))) }}
        onPointerUp={() => { start.current = null }}
        onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(100, value + 5)); if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(0, value - 5)) }}
      >
        <i style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <b>{value > 50 ? '+' : ''}{Math.round((value - 50) / 4)} dB</b>
      <span>{label}</span>
    </div>
  )
}

export default function NeuMixer({ surface = '#e6ebf2', accent = '#ff7a45', style }) {
  const t = soften(surface)
  const [levels, setLevels] = useState([72, 58, 64, 80, 45, 76])
  const [mute, setMute] = useState([false, false, false, false, true, false])
  const [solo, setSolo] = useState([false, false, false, false, false, false])
  const [sel, setSel] = useState(0)
  const [view, setView] = useState(0)
  const [eq, setEq] = useState([55, 48, 50, 60, 52])
  const [playing, setPlaying] = useState(true)
  const [meters, setMeters] = useState(levels)
  const root = useRef(null)
  const visible = useOnScreen(root)

  const anySolo = solo.some(Boolean)
  const audible = (i) => (i === 5 ? !mute[5] : !mute[i] && (!anySolo || solo[i]))

  useEffect(() => {
    if (!playing || !visible) { setMeters(levels.map(() => 0)); return }
    const id = setInterval(() => setMeters(levels.map((l, i) => (audible(i) ? Math.max(0, Math.min(100, l * (0.7 + Math.random() * 0.3))) : 0))), 140)
    return () => clearInterval(id)
  }, [playing, visible, levels, mute, solo]) // eslint-disable-line react-hooks/exhaustive-deps

  const flip = (arr, set, i) => set(arr.map((v, k) => (k === i ? !v : v)))

  return (
    <div ref={root} className="nm-wrap" style={{ '--base': t.base, '--hi': t.hi, '--lo': t.lo, '--ink': t.ink, '--muted': t.muted, '--accent': accent, '--accent-ink': readableOn(accent, t.base), '--on-accent': textOn(accent), ...style }}>
      <style>{`
        .nm-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: var(--base); color: var(--ink); font: 600 12px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.nm-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .nm-up { background: var(--base); box-shadow: 5px 5px 11px var(--lo), -5px -5px 11px var(--hi); }
        .nm-in { background: var(--base); box-shadow: inset 4px 4px 9px var(--lo), inset -4px -4px 9px var(--hi); }
        .nm { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; min-height: 100%; box-sizing: border-box; }
        .nm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .nm-play { display: flex; align-items: center; gap: 10px; }
        .nm-play button { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent-ink); transition: box-shadow 150ms; }
        .nm-play button[aria-pressed='true'] { box-shadow: inset 4px 4px 9px var(--lo), inset -4px -4px 9px var(--hi); }
        .nm-play b { font-size: 14px; }
        .nm-play small { display: block; color: var(--muted); font-weight: 500; }
        .nm-seg { position: relative; display: grid; grid-template-columns: repeat(3, 72px); padding: 4px; border-radius: 999px; }
        .nm-seg button { position: relative; z-index: 1; padding: 7px 0; color: var(--muted); }
        .nm-seg button[aria-selected='true'] { color: var(--accent-ink); }
        .nm-seg i { position: absolute; top: 4px; bottom: 4px; left: 4px; width: 72px; border-radius: 999px; transition: transform 260ms cubic-bezier(.3,1.3,.5,1); }
        .nm-strips { flex: 1; display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; min-height: 250px; }
        .nm-strip { border-radius: 18px; padding: 10px 6px; display: grid; grid-template-rows: auto 1fr auto auto; justify-items: center; gap: 8px; transition: box-shadow 200ms; cursor: pointer; }
        .nm-strip.sel { box-shadow: inset 4px 4px 9px var(--lo), inset -4px -4px 9px var(--hi); }
        .nm-strip.sel .nm-name { color: var(--accent-ink); }
        .nm-name { font-size: 11.5px; }
        .nm-body { display: flex; gap: 8px; height: 100%; min-height: 120px; }
        .nm-fader { position: relative; width: 12px; height: 100%; border-radius: 999px; touch-action: none; cursor: ns-resize; }
        .nm-fill { position: absolute; left: 3px; right: 3px; bottom: 3px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 70%, var(--base)); max-height: calc(100% - 6px); }
        .nm-cap { position: absolute; left: 50%; width: 30px; height: 22px; margin-left: -15px; border-radius: 7px; pointer-events: none; }
        .nm-cap::after { content: ''; position: absolute; left: 6px; right: 6px; top: 10px; height: 2px; background: var(--muted); border-radius: 2px; }
        .nm-meter { width: 6px; height: 100%; display: flex; flex-direction: column-reverse; gap: 2px; }
        .nm-meter i { flex: 1; border-radius: 2px; background: color-mix(in srgb, var(--muted) 22%, var(--base)); }
        .nm-meter i.on { background: #2fb37a; }
        .nm-meter i.on.hot { background: #f2b33d; }
        .nm-meter i.on.clip { background: #e5484d; }
        .nm-val { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .nm-keys { display: flex; gap: 6px; }
        .nm-key { width: 26px; height: 24px; border-radius: 7px; font-size: 11px; font-weight: 800; color: var(--muted); transition: box-shadow 120ms, color 120ms; }
        .nm-key[aria-pressed='true'] { box-shadow: inset 3px 3px 6px var(--lo), inset -3px -3px 6px var(--hi); }
        .nm-key.m[aria-pressed='true'] { color: #e5484d; }
        .nm-key.s[aria-pressed='true'] { color: #d99a00; }
        .nm-eq { flex: 1; display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; align-items: center; border-radius: 20px; padding: 18px; }
        .nm-knob-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .nm-knob-wrap span { color: var(--muted); }
        .nm-knob-wrap b { font-variant-numeric: tabular-nums; color: var(--accent-ink); }
        .nm-knob { position: relative; width: 64px; height: 64px; border-radius: 50%; touch-action: none; cursor: ns-resize; }
        .nm-knob i { position: absolute; left: 50%; top: 6px; width: 4px; height: 16px; margin-left: -2px; border-radius: 2px; background: var(--accent); transform-origin: 50% 26px; }
        .nm-fx { flex: 1; display: grid; place-items: center; color: var(--muted); border-radius: 20px; }
        @container (max-width: 620px) { .nm-strips { grid-template-columns: repeat(3, 1fr); } .nm-eq { grid-template-columns: repeat(3, 1fr); } }
      `}</style>

      <div className="nm">
        <header className="nm-head">
          <div className="nm-play">
            <button className={playing ? '' : 'nm-up'} aria-pressed={playing} aria-label={playing ? 'Stop' : 'Play'} onClick={() => setPlaying(!playing)}>
              <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">{playing ? <rect x="5" y="5" width="10" height="10" rx="1.5" /> : <path d="M6 4.5v11l9.5-5.5z" />}</svg>
            </button>
            <div><b>Session 07</b><small>{playing ? 'Playing · 118 BPM' : 'Stopped'}</small></div>
          </div>
          <div className="nm-seg nm-in" role="tablist">
            <i className="nm-up" style={{ transform: `translateX(${view * 100}%)` }} />
            {VIEWS.map((v, n) => <button key={v} role="tab" aria-selected={n === view} onClick={() => setView(n)}>{v}</button>)}
          </div>
        </header>

        {view === 0 && (
          <div className="nm-strips">
            {CHANNELS.map((c, i) => (
              <div key={c} className={`nm-strip ${i === sel ? 'sel' : 'nm-up'}`} onClick={() => setSel(i)} onFocus={() => setSel(i)}>
                <span className="nm-name">{c}</span>
                <div className="nm-body">
                  <Fader value={levels[i]} label={c} onChange={(v) => { setSel(i); setLevels(levels.map((l, k) => (k === i ? v : l))) }} />
                  <div className="nm-meter" aria-hidden="true">
                    {Array.from({ length: 12 }, (_, k) => {
                      const lit = meters[i] >= ((k + 1) / 12) * 100
                      return <i key={k} className={`${lit ? 'on' : ''}${k >= 9 ? ' hot' : ''}${k >= 11 ? ' clip' : ''}`} />
                    })}
                  </div>
                </div>
                <span className="nm-val">{mute[i] ? 'Muted' : `${levels[i]}%`}</span>
                <div className="nm-keys" onClick={(e) => e.stopPropagation()}>
                  <button className={`nm-key m ${mute[i] ? '' : 'nm-up'}`} aria-pressed={mute[i]} aria-label={`Mute ${c}`} onClick={() => flip(mute, setMute, i)}>M</button>
                  {i < 5 && <button className={`nm-key s ${solo[i] ? '' : 'nm-up'}`} aria-pressed={solo[i]} aria-label={`Solo ${c}`} onClick={() => flip(solo, setSolo, i)}>S</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 1 && (
          <div className="nm-eq nm-in">
            {EQ.map((b, i) => <Knob key={b} label={b} value={eq[i]} onChange={(v) => setEq(eq.map((x, k) => (k === i ? v : x)))} />)}
          </div>
        )}

        {view === 2 && <div className="nm-fx nm-in">Reverb, delay and compression live here.</div>}
      </div>
    </div>
  )
}
