import { readableOn, textOn } from '../ui/color.js'
import { useRef, useState } from 'react'

// Neumorphic smart-home remote. One soft surface: rooms are raised cards
// (the selected one presses in), a recessed thermostat dial you can drag,
// device buttons that press in when on, and a recessed nav track with a
// raised knob. Every state also changes colour or text, not just shadow.

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

const ROOMS = [
  ['Living room', 22, 4],
  ['Bedroom', 20, 2],
  ['Kitchen', 23, 3],
  ['Office', 21, 2],
]
const DEVICES = [
  ['Lights', 'M10 3a5 5 0 0 0-3 9v2h6v-2a5 5 0 0 0-3-9zM8 17h4'],
  ['Fan', 'M10 10c0-4 2-6 4-5s0 5-4 5zm0 0c4 0 6 2 5 4s-5 0-5-4zm0 0c0 4-2 6-4 5s0-5 4-5zm0 0c-4 0-6-2-5-4s5 0 5 4z'],
  ['Speaker', 'M5 3h10v14H5zM10 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 5.5h.01'],
  ['Lock', 'M6 9V6.5a4 4 0 0 1 8 0V9M4.5 9h11v8h-11zM10 12v2'],
]
const TABS = ['Rooms', 'Scenes', 'Energy']
const MIN = 16, MAX = 30, SWEEP = 270

const Icon = ({ d, size = 20 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={d} /></svg>
)

export default function NeuHome({ surface = '#e6ebf2', accent = '#ff7a45', style }) {
  const t = soften(surface)
  const [room, setRoom] = useState(0)
  const [temps, setTemps] = useState(ROOMS.map((r) => r[1]))
  const [on, setOn] = useState({ 'Living room': ['Lights'], Bedroom: [], Kitchen: ['Lights', 'Speaker'], Office: ['Fan'] })
  const [tab, setTab] = useState(0)
  const dial = useRef(null)

  const name = ROOMS[room][0]
  const temp = temps[room]
  const setTemp = (v) => setTemps(temps.map((x, i) => (i === room ? Math.round(Math.min(MAX, Math.max(MIN, v)) * 2) / 2 : x)))
  const frac = (temp - MIN) / (MAX - MIN)
  const R = 84, C = 2 * Math.PI * R

  const fromPointer = (e) => {
    const r = dial.current.getBoundingClientRect()
    let a = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI
    a = (a + 360 + 225) % 360 // 0 at the dial's start (bottom-left)
    if (a > SWEEP) a = a > SWEEP + 45 ? 0 : SWEEP
    setTemp(MIN + (a / SWEEP) * (MAX - MIN))
  }
  const knobAngle = ((-225 + frac * SWEEP) * Math.PI) / 180

  const toggle = (d) => setOn({ ...on, [name]: on[name].includes(d) ? on[name].filter((x) => x !== d) : [...on[name], d] })

  return (
    <div className="nh-wrap" style={{ '--base': t.base, '--hi': t.hi, '--lo': t.lo, '--ink': t.ink, '--muted': t.muted, '--accent': accent, '--accent-ink': readableOn(accent, t.base), '--on-accent': textOn(accent), ...style }}>
      <style>{`
        .nh-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: var(--base); color: var(--ink); font: 500 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.nh-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .nh-up { background: var(--base); box-shadow: 6px 6px 14px var(--lo), -6px -6px 14px var(--hi); }
        .nh-in { background: var(--base); box-shadow: inset 5px 5px 10px var(--lo), inset -5px -5px 10px var(--hi); }
        .nh { display: grid; grid-template-columns: 180px 1fr 190px; gap: 22px; padding: 22px; min-height: 100%; box-sizing: border-box; align-items: start; }
        .nh h4 { margin: 0 0 10px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
        .nh-rooms { display: flex; flex-direction: column; gap: 12px; }
        .nh-room { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-radius: 16px; text-align: left; transition: box-shadow 200ms; }
        .nh-room small { display: block; color: var(--muted); font-weight: 500; font-size: 11.5px; }
        .nh-room b { font-weight: 700; }
        .nh-room i { width: 8px; height: 8px; border-radius: 50%; background: transparent; }
        .nh-room[aria-current='true'] { color: var(--accent-ink); }
        .nh-room[aria-current='true'] i { background: var(--accent); }
        .nh-center { display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .nh-dial { position: relative; width: 220px; height: 220px; border-radius: 50%; display: grid; place-items: center; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
        .nh-dial:active { cursor: grabbing; }
        /* no outline after a click or drag; a ring in the accent colour for keyboard focus only */
        .nh-dial:focus { outline: none; }
        .nh-dial:focus-visible:not([data-pointer]) { outline: 2px solid var(--accent); outline-offset: 6px; }
        .nh-dial svg { position: absolute; inset: 0; }
        .nh-core { width: 132px; height: 132px; border-radius: 50%; display: grid; place-items: center; text-align: center; pointer-events: none; }
        .nh-core b { display: block; font-size: 38px; font-weight: 300; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .nh-core small { color: var(--muted); font-size: 11.5px; }
        .nh-knob { position: absolute; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); box-shadow: 3px 3px 6px var(--lo), -2px -2px 5px var(--hi); transform: translate(-50%, -50%); pointer-events: none; }
        .nh-steps { display: flex; gap: 18px; }
        .nh-round { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; font-weight: 400; transition: box-shadow 120ms; }
        .nh-round:active { box-shadow: inset 4px 4px 8px var(--lo), inset -4px -4px 8px var(--hi); }
        .nh-tabs { position: relative; display: grid; grid-template-columns: repeat(3, 84px); padding: 6px; border-radius: 999px; }
        .nh-tabs button { position: relative; z-index: 1; padding: 8px 0; font-weight: 700; font-size: 12px; color: var(--muted); }
        .nh-tabs button[aria-selected='true'] { color: var(--accent-ink); }
        .nh-tabs i { position: absolute; top: 6px; bottom: 6px; left: 6px; width: 84px; border-radius: 999px; transition: transform 280ms cubic-bezier(.3,1.3,.5,1); }
        .nh-devs { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .nh-dev { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 6px; border-radius: 18px; transition: box-shadow 200ms, color 200ms; }
        .nh-dev span { font-size: 11.5px; font-weight: 700; }
        .nh-dev small { font-size: 10.5px; color: var(--muted); font-weight: 600; }
        .nh-dev[aria-pressed='true'] { color: var(--accent-ink); box-shadow: inset 5px 5px 10px var(--lo), inset -5px -5px 10px var(--hi); }
        .nh-dev[aria-pressed='true'] small { color: var(--accent-ink); }
        .nh > section { min-width: 0; }
        @container (max-width: 760px) { .nh { grid-template-columns: 1fr; } .nh-rooms { flex-direction: row; overflow-x: auto; padding: 10px; margin: -10px; } .nh-room { flex: none; gap: 14px; } .nh-devs { grid-template-columns: repeat(4, 1fr); } }
      `}</style>

      <div className="nh">
        <section>
          <h4>Rooms</h4>
          <div className="nh-rooms">
            {ROOMS.map(([r, , devices], n) => (
              <button key={r} className={`nh-room ${n === room ? 'nh-in' : 'nh-up'}`} aria-current={n === room} onClick={() => setRoom(n)}>
                <span><b>{r}</b><small>{temps[n]}° · {on[r].length} of {devices} on</small></span>
                <i />
              </button>
            ))}
          </div>
        </section>

        <section className="nh-center">
          <div
            ref={dial}
            className="nh-dial nh-in"
            role="slider"
            tabIndex={0}
            aria-label={`${name} temperature`}
            aria-valuemin={MIN}
            aria-valuemax={MAX}
            aria-valuenow={temp}
            onPointerDown={(e) => {
              // a drag on the dial turns it; it must never start a text selection
              e.preventDefault()
              e.currentTarget.dataset.pointer = '' // focus came from the pointer: no ring
              e.currentTarget.focus({ preventScroll: true })
              e.currentTarget.setPointerCapture(e.pointerId)
              fromPointer(e)
            }}
            onPointerMove={(e) => e.buttons && fromPointer(e)}
            onBlur={(e) => { delete e.currentTarget.dataset.pointer }}
            onKeyDown={(e) => { delete e.currentTarget.dataset.pointer; if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setTemp(temp + 0.5); if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setTemp(temp - 0.5) }}
          >
            <svg viewBox="0 0 220 220" aria-hidden="true">
              <circle cx="110" cy="110" r={R} fill="none" stroke="var(--lo)" strokeOpacity=".35" strokeWidth="10" strokeDasharray={`${(SWEEP / 360) * C} ${C}`} strokeLinecap="round" transform="rotate(135 110 110)" />
              <circle cx="110" cy="110" r={R} fill="none" stroke={accent} strokeWidth="10" strokeDasharray={`${frac * (SWEEP / 360) * C} ${C}`} strokeLinecap="round" transform="rotate(135 110 110)" style={{ transition: 'stroke-dasharray 120ms' }} />
            </svg>
            <div className="nh-knob" style={{ left: 110 + R * Math.cos(knobAngle), top: 110 + R * Math.sin(knobAngle) }} />
            <div className="nh-core nh-up">
              <div><b>{temp.toFixed(1)}°</b><small>{name}</small></div>
            </div>
          </div>
          <div className="nh-steps">
            <button className="nh-round nh-up" aria-label="Cooler" onClick={() => setTemp(temp - 0.5)}>−</button>
            <button className="nh-round nh-up" aria-label="Warmer" onClick={() => setTemp(temp + 0.5)}>+</button>
          </div>
          <div className="nh-tabs nh-in" role="tablist">
            <i className="nh-up" style={{ transform: `translateX(${tab * 100}%)` }} />
            {TABS.map((x, n) => <button key={x} role="tab" aria-selected={n === tab} onClick={() => setTab(n)}>{x}</button>)}
          </div>
        </section>

        <section>
          <h4>Devices</h4>
          <div className="nh-devs">
            {DEVICES.slice(0, ROOMS[room][2]).map(([d, icon]) => {
              const active = on[name].includes(d)
              return (
                <button key={d} className={`nh-dev ${active ? '' : 'nh-up'}`} aria-pressed={active} onClick={() => toggle(d)}>
                  <Icon d={icon} size={24} />
                  <span>{d}</span>
                  <small>{active ? 'On' : 'Off'}</small>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
