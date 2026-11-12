import { useEffect, useRef, useState } from 'react'
import { useOnScreen } from '../ui/onscreen.js'

// Maximalist music festival site: clashing neon, oversized type, a collage
// of tilted photo cards and stickers, and a marquee of links. The line-up
// itself sits on a solid panel so names stay readable (the thing people
// came for), sized by billing, with day tabs and a live countdown.

const DAYS = {
  Fri: [['Neon Lagoon', 1], ['Kofi & the Static', 2], ['Ultraviolet Choir', 2], ['Moth Club', 3], ['Saint Velvet', 3], ['DJ Paper Moon', 3]],
  Sat: [['Glass Animals of Mars', 1], ['Rosa Riot', 2], ['The Lemon Engines', 2], ['Haze Theory', 3], ['Pocket Satellites', 3], ['Velvet Crash', 3]],
  Sun: [['Midnight Orchard', 1], ['Sunny Disaster', 2], ['Bloom Bloom', 2], ['Arcade Ghosts', 3], ['Lilo Kingdom', 3], ['Tape Hiss', 3]],
}
const LINKS = ['Line-up', 'Tickets', 'Camping', 'Map', 'FAQ', 'Merch', 'Accessibility']
const FONTS = ["'Arial Black', 'Helvetica Neue', system-ui, sans-serif", "Georgia, 'Times New Roman', serif", "'Courier New', ui-monospace, monospace"]

function useCountdown(target, active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  const s = Math.max(0, Math.floor((target - now) / 1000))
  return [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60]
}

export default function MaxFestival({ name = 'LOUDER 26', pink = '#ff2bd6', lime = '#c6ff00', blue = '#2a1bff', style }) {
  const root = useRef(null)
  const visible = useOnScreen(root)
  const [day, setDay] = useState('Sat')
  const [target] = useState(() => Date.now() + (12 * 86400 + 7 * 3600 + 21 * 60) * 1000)
  const [d, h, m, sec] = useCountdown(target, visible)

  return (
    <div ref={root} className="mf-wrap" data-paused={visible ? undefined : ''} style={{ '--pink': pink, '--lime': lime, '--blue': blue, ...style }}>
      <style>{`
        .mf-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: auto; background: var(--pink); color: #111; font: 600 13px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.mf-wrap) button, :where(.mf-wrap) a { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: none; }
        .mf-wrap[data-paused] * { animation-play-state: paused !important; }
        .mf-dots { position: absolute; inset: 0; background-image: radial-gradient(#111 1.4px, transparent 1.6px); background-size: 14px 14px; opacity: .18; pointer-events: none; }
        .mf-marquee { position: sticky; top: 0; z-index: 5; display: flex; overflow: hidden; background: #111; color: var(--lime); border-bottom: 4px solid var(--lime); }
        .mf-track { display: flex; gap: 28px; padding: 9px 0; white-space: nowrap; animation: mf-scroll 22s linear infinite; }
        .mf-marquee:hover .mf-track, .mf-marquee:focus-within .mf-track { animation-play-state: paused; }
        .mf-track a { font-size: 14px; letter-spacing: .04em; text-transform: uppercase; }
        .mf-track a:hover, .mf-track a:focus-visible { color: #fff; text-decoration: underline; }
        .mf-track a:nth-child(3n+2) { font-family: Georgia, serif; font-style: italic; text-transform: none; font-size: 16px; }
        .mf-track a:nth-child(3n+3) { font-family: 'Courier New', monospace; }
        @keyframes mf-scroll { to { transform: translateX(-50%); } }
        .mf { position: relative; display: grid; grid-template-columns: 1.15fr 1fr; gap: 18px; padding: 18px; }
        .mf-hero { position: relative; min-height: 330px; }
        .mf-title { position: relative; z-index: 2; margin: 0; font: 900 clamp(48px, 11cqw, 120px)/0.82 'Arial Black', 'Helvetica Neue', system-ui, sans-serif; letter-spacing: -0.04em; color: #111; text-shadow: 5px 5px 0 var(--lime); }
        .mf-title span { display: block; color: var(--blue); text-shadow: 5px 5px 0 #fff; }
        .mf-sub { position: relative; z-index: 2; display: inline-block; margin: 10px 0 0; padding: 6px 10px; background: #111; color: #fff; font: italic 600 17px/1.2 Georgia, serif; transform: rotate(-2deg); }
        .mf-card { position: absolute; border: 6px solid #fff; box-shadow: 6px 6px 0 #111; overflow: hidden; }
        .mf-card i { position: absolute; border-radius: 50%; }
        .mf-sticker { position: absolute; z-index: 3; display: grid; place-items: center; text-align: center; font: 900 13px/1 'Arial Black', system-ui, sans-serif; color: #111; background: var(--lime); clip-path: polygon(50% 0, 61% 18%, 82% 8%, 80% 30%, 100% 38%, 84% 54%, 96% 74%, 74% 74%, 70% 96%, 52% 82%, 32% 98%, 28% 76%, 6% 78%, 16% 56%, 0 38%, 20% 30%, 16% 8%, 38% 18%); animation: mf-spin 18s linear infinite; }
        @keyframes mf-spin { to { transform: rotate(360deg); } }
        .mf-count { position: relative; z-index: 2; display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
        .mf-count div { background: #fff; border: 3px solid #111; padding: 6px 10px; text-align: center; box-shadow: 4px 4px 0 #111; }
        .mf-count b { display: block; font: 900 26px/1 'Courier New', monospace; font-variant-numeric: tabular-nums; }
        .mf-count small { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
        .mf-cta { position: relative; z-index: 2; display: inline-block; margin-top: 16px; padding: 14px 22px; background: var(--blue); color: #fff; font: 900 18px/1 'Arial Black', system-ui, sans-serif; border: 3px solid #111; border-radius: 18px 8px 22px 10px; box-shadow: 6px 6px 0 #111; transition: transform 120ms, background 120ms, color 120ms; }
        .mf-wrap .mf-cta { color: #fff; }
        .mf-cta:hover, .mf-cta:focus-visible { background: var(--lime); color: #111; transform: rotate(-2deg) scale(1.03); }
        .mf-wrap .mf-cta:hover, .mf-wrap .mf-cta:focus-visible { color: #111; }
        .mf-lineup { position: relative; z-index: 2; background: #111; color: #fff; border: 4px solid #fff; box-shadow: 8px 8px 0 var(--blue); padding: 16px; align-self: start; }
        .mf-lineup h2 { margin: 0 0 10px; font: 900 13px/1 'Courier New', monospace; letter-spacing: .2em; color: var(--lime); }
        .mf-days { display: flex; gap: 6px; margin-bottom: 12px; }
        .mf-days button { padding: 6px 12px; border: 2px solid #fff; color: #fff; font: 900 14px/1 'Arial Black', system-ui, sans-serif; border-radius: 999px; }
        .mf-days button[aria-pressed='true'] { background: var(--lime); color: #111; border-color: var(--lime); }
        .mf-acts { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
        .mf-acts li { line-height: 1.05; }
        .mf-acts li.t1 { width: 100%; font: 900 clamp(26px, 4.4cqw, 40px)/1 'Arial Black', system-ui, sans-serif; letter-spacing: -0.02em; color: var(--lime); }
        .mf-acts li.t2 { font: italic 700 clamp(18px, 2.6cqw, 24px)/1.1 Georgia, serif; color: #fff; }
        .mf-acts li.t3 { font: 700 14px/1.3 'Courier New', monospace; color: #e6e6e6; }
        .mf-acts li.t3::after { content: ' ✦'; color: var(--pink); }
        @container (max-width: 640px) { .mf { grid-template-columns: 1fr; } .mf-hero { min-height: 300px; } }
        @media (prefers-reduced-motion: reduce) { .mf-wrap * { animation: none !important; } .mf-cta { transition: none; } }
      `}</style>

      <div className="mf-dots" aria-hidden="true" />
      <nav className="mf-marquee" aria-label="Festival">
        <div className="mf-track">
          {[...LINKS, ...LINKS].map((l, i) => <a key={i} href={`#${l}`} onClick={(e) => e.preventDefault()} tabIndex={i < LINKS.length ? 0 : -1} aria-hidden={i >= LINKS.length || undefined}>{l}</a>)}
        </div>
      </nav>

      <div className="mf">
        <section className="mf-hero">
          <div className="mf-card" style={{ width: '46%', height: 150, right: '2%', top: 4, transform: 'rotate(6deg)', background: `linear-gradient(160deg, ${blue}, #000)` }} aria-hidden="true">
            <i style={{ width: 120, height: 120, background: lime, left: -20, bottom: -50 }} /><i style={{ width: 60, height: 60, background: pink, right: 16, top: 14 }} />
          </div>
          <div className="mf-card" style={{ width: '38%', height: 120, right: '20%', top: 170, transform: 'rotate(-7deg)', background: `repeating-linear-gradient(45deg, #111 0 12px, ${lime} 12px 24px)` }} aria-hidden="true" />
          <div className="mf-sticker" style={{ width: 92, height: 92, right: '6%', top: 132 }} aria-hidden="true">3<br />DAYS</div>
          <h1 className="mf-title">{name.split(' ')[0]}<span>{name.split(' ').slice(1).join(' ') || '26'}</span></h1>
          <p className="mf-sub">14–16 August · Lakeside Fields</p>
          <div className="mf-count" role="timer" aria-label="Time until gates open">
            {[[d, 'days'], [h, 'hrs'], [m, 'min'], [sec, 'sec']].map(([v, l]) => <div key={l}><b>{String(v).padStart(2, '0')}</b><small>{l}</small></div>)}
          </div>
          <a className="mf-cta" href="#tickets" onClick={(e) => e.preventDefault()}>Get tickets →</a>
        </section>

        <section className="mf-lineup" aria-labelledby="mf-lu">
          <h2 id="mf-lu">LINE-UP</h2>
          <div className="mf-days" role="group" aria-label="Day">
            {Object.keys(DAYS).map((k) => <button key={k} aria-pressed={k === day} onClick={() => setDay(k)}>{k}</button>)}
          </div>
          <ul className="mf-acts">
            {DAYS[day].map(([act, tier]) => <li key={act} className={`t${tier}`}>{act}</li>)}
          </ul>
        </section>
      </div>
    </div>
  )
}
