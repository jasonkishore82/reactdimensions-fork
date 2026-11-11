import { useEffect, useRef, useState } from 'react'
import { useOnScreen, useReducedMotion } from '../ui/onscreen.js'

// Skeuomorphic retro console (an original design): a wide mint plastic
// handheld with a curved CRT screen, scanlines and a glowing game menu. The
// d-pad and A/B buttons physically depress (mouse, touch or keyboard: arrows,
// Z/X, Enter). Cartridges slide in and out of the top slot from a shelf.

const CARTS = [
  { name: 'Comet Run', c: '#e0533d', games: ['Start Run', 'Time Trial', 'Garage', 'Options'] },
  { name: 'Moss Quest', c: '#3f9b5a', games: ['New Quest', 'Continue', 'Bestiary', 'Options'] },
  { name: 'Tide Pool', c: '#2f7fc1', games: ['Dive In', 'Aquarium', 'Tide Chart', 'Options'] },
  { name: 'Pixel Bakery', c: '#d99a2b', games: ['Open Shop', 'Recipes', 'Stockroom', 'Options'] },
]

export default function SkeuConsole({ shell = '#8fcfc0', style }) {
  const root = useRef(null)
  const visible = useOnScreen(root)
  const reduced = useReducedMotion()
  const [cart, setCart] = useState(0)
  const [inserting, setInserting] = useState(false)
  const [power, setPower] = useState(true)
  const [sel, setSel] = useState(0)
  const [pressed, setPressed] = useState(null)
  const [msg, setMsg] = useState('')

  const game = cart === null ? null : CARTS[cart]

  const act = (k) => {
    if (!power || !game) return
    if (k === 'up') setSel((s) => (s + game.games.length - 1) % game.games.length)
    if (k === 'down') setSel((s) => (s + 1) % game.games.length)
    if (k === 'a') setMsg(`${game.games[sel]} — loading…`)
    if (k === 'b') setMsg('')
  }
  const press = (k) => { setPressed(k); act(k); setTimeout(() => setPressed((p) => (p === k ? null : p)), 140) }

  const swap = (i) => {
    if (i === cart) { setCart(null); setMsg(''); return }
    setCart(null)
    setInserting(true)
    setTimeout(() => { setCart(i); setSel(0); setMsg(''); setInserting(false) }, reduced ? 0 : 420)
  }

  const onKey = (e) => {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', z: 'a', Z: 'a', Enter: 'a', x: 'b', X: 'b', Escape: 'b' }
    const k = map[e.key]
    if (!k) return
    e.preventDefault()
    press(k)
  }

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 1800); return () => clearTimeout(t) }, [msg])

  const pad = (k, label) => <button className={`cs-dir cs-${k}${pressed === k ? ' down' : ''}`} aria-label={label} onPointerDown={() => press(k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); press(k) } }} />

  return (
    <div ref={root} className="cs-wrap" data-paused={visible ? undefined : ''} style={{ '--shell': shell, ...style }}>
      <style>{`
        .cs-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: radial-gradient(ellipse at 50% 20%, #3b3550, #15131d 75%); color: #2a2620; font: 700 12px/1.3 'Trebuchet MS', 'Arial Rounded MT Bold', Arial, sans-serif; padding: 18px; box-sizing: border-box; }
        :where(.cs-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .cs-wrap[data-paused] * { animation-play-state: paused !important; }
        .cs-wrap { display: grid; align-content: safe center; }
        .cs { display: grid; grid-template-columns: minmax(0, 1fr) 200px; gap: 20px; max-width: 900px; width: 100%; margin: 0 auto; align-items: start; }
        .cs-unit { position: relative; max-width: 760px; width: 100%; margin: 40px auto 0; box-sizing: border-box; border-radius: 56px; padding: 22px 26px; display: grid; grid-template-columns: 112px minmax(0, 1fr) 112px; grid-template-areas: 'l s r' 'l k r'; column-gap: 18px; align-items: center; background: linear-gradient(160deg, color-mix(in srgb, var(--shell), white 25%), var(--shell) 40%, color-mix(in srgb, var(--shell), black 18%)); box-shadow: inset 0 3px 0 rgba(255,255,255,.6), inset 0 -6px 10px rgba(0,0,0,.18), 0 26px 40px rgba(0,0,0,.6); outline: none; }
        .cs-unit:focus-visible { box-shadow: 0 0 0 3px #ffb347, inset 0 3px 0 rgba(255,255,255,.6), 0 26px 40px rgba(0,0,0,.6); }
        .cs-slot { position: absolute; left: 50%; top: -14px; width: 56%; height: 18px; margin-left: -28%; border-radius: 6px 6px 0 0; background: linear-gradient(#2a2620, #4a443a); box-shadow: inset 0 2px 4px rgba(0,0,0,.6); }
        .cs-cart { position: absolute; left: 50%; bottom: 6px; width: 86%; margin-left: -43%; height: 52px; border-radius: 6px 6px 2px 2px; background: linear-gradient(#6a6458, #4a443a); transition: transform 420ms cubic-bezier(.3,.7,.3,1); box-shadow: inset 0 2px 0 rgba(255,255,255,.2); }
        .cs-cart.out { transform: translateY(-70px); opacity: 0; }
        .cs-cart i { position: absolute; left: 10%; right: 10%; top: 8px; height: 26px; border-radius: 3px; display: grid; place-items: center; color: #fff; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
        .cs-bezel { grid-area: s; padding: 14px 16px 10px; border-radius: 16px; background: linear-gradient(#55505e, #3e3a46); box-shadow: inset 0 2px 6px rgba(0,0,0,.6); }
        .cs-led { display: flex; align-items: center; gap: 6px; color: #c9c3d6; font-size: 9px; letter-spacing: .14em; margin-bottom: 8px; }
        .cs-led i { width: 8px; height: 8px; border-radius: 50%; background: #521; }
        .cs-led i.on { background: #ff4b3a; box-shadow: 0 0 8px #ff4b3a; }
        .cs-crt { position: relative; aspect-ratio: 4 / 3; border-radius: 18px / 14px; overflow: hidden; background: #0b1f14; box-shadow: inset 0 0 30px rgba(0,0,0,.9), inset 0 0 0 2px #111; }
        .cs-crt.on { background: radial-gradient(ellipse at center, #1d4a2e, #0b1f14 80%); }
        .cs-crt::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0 1px, transparent 1px 3px); pointer-events: none; z-index: 2; }
        .cs-crt::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.18), transparent 45%), radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.6)); pointer-events: none; z-index: 3; }
        .cs-screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #9dffb8; font: 700 14px/1.2 'Courier New', monospace; text-shadow: 0 0 6px rgba(120,255,160,.8); animation: cs-flicker 4s steps(1) infinite; }
        @keyframes cs-flicker { 0%, 96%, 100% { opacity: 1; } 97% { opacity: .82; } }
        .cs-screen h4 { margin: 0 0 6px; font: inherit; font-size: 17px; letter-spacing: .12em; text-transform: uppercase; }
        .cs-screen ul { list-style: none; margin: 0; padding: 0; }
        .cs-screen li { padding: 1px 0; }
        .cs-screen li::before { content: '  '; white-space: pre; }
        .cs-screen li[aria-selected='true']::before { content: '▶ '; }
        .cs-screen li[aria-selected='true'] { color: #fff; }
        .cs-blink { animation: cs-blink 1s steps(1) infinite; }
        @keyframes cs-blink { 50% { opacity: 0; } }
        .cs-brand { margin: 8px 0 0; text-align: center; color: #c9c3d6; font: italic 800 12px/1 'Trebuchet MS', sans-serif; letter-spacing: .1em; }
        .cs-side { display: flex; flex-direction: column; align-items: center; gap: 22px; }
        .cs-side.l { grid-area: l; } .cs-side.r { grid-area: r; }
        .cs-dpad { position: relative; width: 108px; height: 108px; }
        .cs-dpad::before { content: ''; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--shell), black 22%), color-mix(in srgb, var(--shell), black 8%) 70%); box-shadow: inset 0 3px 6px rgba(0,0,0,.25); }
        .cs-dir { position: absolute; width: 34px; height: 34px; background: linear-gradient(#3d3a42, #232126); box-shadow: 0 4px 0 #111, 0 5px 6px rgba(0,0,0,.4); transition: transform 60ms, box-shadow 60ms; }
        .cs-dir.down { transform: translateY(3px); box-shadow: 0 1px 0 #111; }
        .cs-up { left: 37px; top: 3px; border-radius: 5px 5px 0 0; } .cs-down { left: 37px; bottom: 7px; border-radius: 0 0 5px 5px; }
        .cs-left { left: 3px; top: 37px; border-radius: 5px 0 0 5px; } .cs-right { right: 3px; top: 37px; border-radius: 0 5px 5px 0; }
        .cs-hub { position: absolute; left: 37px; top: 37px; width: 34px; height: 34px; background: #2a2730; pointer-events: none; }
        .cs-hub::after { content: ''; position: absolute; inset: 9px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #3a3740, #1e1c22); }
        .cs-ab { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; padding: 10px; border-radius: 28px; background: color-mix(in srgb, var(--shell), black 12%); box-shadow: inset 0 3px 6px rgba(0,0,0,.2); }
        .cs-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #4a4438; }
        .cs-btn span { width: 46px; height: 46px; border-radius: 50%; background: radial-gradient(circle at 38% 30%, #ff8fa8, #c8285a 60%, #8a1a3e); box-shadow: 0 5px 0 #5a0f28, 0 7px 8px rgba(0,0,0,.4); transition: transform 60ms, box-shadow 60ms; }
        .cs-btn.down span { transform: translateY(4px); box-shadow: 0 1px 0 #5a0f28; }
        .cs-btn small { font-size: 12px; }
        .cs-small { grid-area: k; display: flex; justify-content: center; gap: 22px; margin-top: 14px; }
        .cs-ab .cs-btn:first-child { transform: translateY(22px); }
        .cs-pill { display: flex; flex-direction: column; align-items: center; gap: 5px; color: #4a4438; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; }
        .cs-pill span { width: 44px; height: 12px; border-radius: 8px; background: linear-gradient(#77727f, #55505d); box-shadow: 0 2px 0 #2e2b33; }
        .cs-pill[aria-pressed='false'] span { background: linear-gradient(#5a3a3a, #3a2424); }
        .cs-grille { display: grid; grid-template-columns: repeat(5, 6px); gap: 6px; }
        .cs-grille i { width: 6px; height: 6px; border-radius: 50%; background: color-mix(in srgb, var(--shell), black 30%); box-shadow: inset 0 2px 2px rgba(0,0,0,.35); }
        .cs-shelf { border-radius: 10px; padding: 12px; background: linear-gradient(180deg, #3a2f28, #2a221d); box-shadow: inset 0 2px 0 rgba(255,255,255,.08), 0 14px 26px rgba(0,0,0,.5); color: #f0e6d6; }
        .cs-shelf h3 { margin: 0 0 10px; text-align: center; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; }
        .cs-box { display: flex; align-items: center; gap: 10px; width: 100%; margin-bottom: 8px; padding: 8px; border-radius: 6px; text-align: left; background: rgba(255,255,255,.05); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); transition: transform 150ms; }
        .cs-box:hover { transform: translateX(4px); }
        .cs-box[aria-pressed='true'] { background: rgba(157,255,184,.12); box-shadow: inset 0 0 0 1px rgba(157,255,184,.5); }
        .cs-box i { width: 30px; height: 40px; border-radius: 3px; flex: none; box-shadow: inset 0 -10px 0 rgba(0,0,0,.25), 0 2px 4px rgba(0,0,0,.5); }
        .cs-box small { display: block; font-weight: 400; color: #cfc4b2; }
        .cs-hint { margin: 6px 0 0; font-weight: 400; font-size: 11px; color: #cfc4b2; }
        .cs-wrap kbd { font: 700 10px/1 'Courier New', monospace; padding: 2px 4px; border-radius: 3px; background: #4a3f36; color: #f0e6d6; }
        @container (max-width: 860px) { .cs { grid-template-columns: 1fr; } }
        @container (max-width: 560px) { .cs-unit { grid-template-columns: 1fr 1fr; grid-template-areas: 's s' 'k k' 'l r'; border-radius: 32px; row-gap: 18px; } .cs-grille { display: none; } }
        @media (prefers-reduced-motion: reduce) { .cs-cart, .cs-box, .cs-dir, .cs-btn span { transition: none; } .cs-screen, .cs-blink { animation: none; } }
      `}</style>

      <div className="cs">
        <section className="cs-unit" tabIndex={0} onKeyDown={onKey} aria-label="Handheld console. Focus and use arrow keys, Z or Enter for A, X or Escape for B.">
          <div className="cs-slot" aria-hidden="true">
            <div className={`cs-cart${game && !inserting ? '' : ' out'}`}>{game && <i style={{ background: `color-mix(in srgb, ${game.c}, black 28%)` }}>{game.name}</i>}</div>
          </div>
          <div className="cs-side l">
            <div className="cs-dpad">
              {pad('up', 'Up')}{pad('down', 'Down')}{pad('left', 'Left')}{pad('right', 'Right')}
              <span className="cs-hub" aria-hidden="true" />
            </div>
            <div className="cs-grille" aria-hidden="true">{Array.from({ length: 15 }, (_, i) => <i key={i} />)}</div>
          </div>
          <div className="cs-bezel">
            <div className="cs-led"><i className={power ? 'on' : ''} />POWER</div>
            <div className={`cs-crt${power ? ' on' : ''}`}>
              {power && (
                <div className="cs-screen" role="status" aria-live="polite">
                  {!game ? <span className="cs-blink">INSERT CARTRIDGE</span>
                    : msg ? <span>{msg}</span>
                    : <>
                        <h4>{game.name}</h4>
                        <ul role="listbox" aria-label={`${game.name} menu`}>
                          {game.games.map((g, i) => <li key={g} role="option" aria-selected={i === sel}>{g}</li>)}
                        </ul>
                      </>}
                </div>
              )}
            </div>
            <p className="cs-brand">Pocket·Arcade</p>
          </div>

          <div className="cs-side r">
            <div className="cs-ab">
              <button className={`cs-btn${pressed === 'b' ? ' down' : ''}`} aria-label="B button, back" onPointerDown={() => press('b')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); press('b') } }}><span /><small>B</small></button>
              <button className={`cs-btn${pressed === 'a' ? ' down' : ''}`} aria-label="A button, select" onPointerDown={() => press('a')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); press('a') } }}><span /><small>A</small></button>
            </div>
          </div>
          <div className="cs-small">
            <button className="cs-pill" aria-pressed={power} onClick={() => { setPower(!power); setMsg('') }}><span />Power</button>
            <button className="cs-pill" onClick={() => { setSel(0); setMsg('') }}><span />Start</button>
          </div>
        </section>

        <aside className="cs-shelf" aria-label="Cartridge shelf">
          <h3>Cartridges</h3>
          {CARTS.map((c, i) => (
            <button key={c.name} className="cs-box" aria-pressed={cart === i} onClick={() => swap(i)}>
              <i style={{ background: `linear-gradient(160deg, ${c.c}, color-mix(in srgb, ${c.c}, black 45%))` }} aria-hidden="true" />
              <span>{c.name}<small>{cart === i ? 'In the slot · tap to eject' : 'Tap to insert'}</small></span>
            </button>
          ))}
          <p className="cs-hint">Click the console, then <kbd>↑</kbd><kbd>↓</kbd> <kbd>Z</kbd> select <kbd>X</kbd> back.</p>
        </aside>
      </div>
    </div>
  )
}
