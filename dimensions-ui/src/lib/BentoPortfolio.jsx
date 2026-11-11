import { useEffect, useRef, useState } from 'react'
import { useOnScreen } from '../ui/onscreen.js'

// Bento personal portfolio / link-in-bio: tiles for a portrait, bio, current
// project, now playing, a map with local time, and social links. The pill
// at the top spotlights the tiles for Work, About or Contact; social tiles
// are buttons that lift and show an arrow on hover.

const SOCIAL = [
  ['Dribbble', '#c2185b', '12.4k'],
  ['GitHub', '#24292f', '3.1k'],
  ['Read.cv', '#1b1b1b', 'CV'],
  ['Email', '#b8400e', 'Say hi'],
]
const GROUPS = { Work: ['project', 'work2'], About: ['portrait', 'bio', 'music', 'map'], Contact: ['social', 'map'] }

function Portrait() {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="200" height="200" fill="#ffb4a2" />
      <circle cx="150" cy="40" r="30" fill="#ffd166" />
      <path d="M40 200c0-46 26-70 60-70s60 24 60 70z" fill="#264653" />
      <circle cx="100" cy="92" r="34" fill="#e9c4a6" />
      <path d="M64 88c0-26 16-40 36-40s38 12 38 38c-10-10-24-14-38-14s-26 6-36 16z" fill="#2b2118" />
      <circle cx="88" cy="96" r="3" fill="#2b2118" /><circle cx="112" cy="96" r="3" fill="#2b2118" />
      <path d="M92 110q8 6 16 0" stroke="#b5654a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export default function BentoPortfolio({ name = 'Lena Ortiz', accent = '#ff7a45', style }) {
  const root = useRef(null)
  const visible = useOnScreen(root)
  const [group, setGroup] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const [playing, setPlaying] = useState(true)
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000 * 20); return () => clearInterval(id) }, [])
  const lisbon = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' })
  const lit = (id) => !group || GROUPS[group].includes(id)
  const cls = (id, extra = '') => `bp-tile ${extra}${lit(id) ? '' : ' dim'}`

  return (
    <div ref={root} className="bp-wrap" data-paused={visible ? undefined : ''} style={{ '--accent': accent, ...style }}>
      <style>{`
        .bp-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: #f3efe8; color: #1b1b1b; font: 500 13px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.bp-wrap) button, :where(.bp-wrap) a { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: none; }
        .bp-top { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px 0; }
        .bp-top b { font-size: 15px; font-weight: 800; }
        .bp-pill { display: flex; gap: 2px; padding: 4px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
        .bp-pill button { padding: 6px 12px; border-radius: 999px; font-weight: 600; color: #666; }
        .bp-pill button[aria-pressed='true'] { background: #1b1b1b; color: #fff; }
        .bp { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 132px; gap: 12px; padding: 14px 16px 16px; }
        .bp-tile { position: relative; border-radius: 24px; background: #fff; padding: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.05); transition: opacity 250ms, transform 200ms, filter 250ms; }
        .bp-tile.dim { opacity: .28; filter: grayscale(.6); }
        .bp-portrait { grid-row: span 2; padding: 0; }
        .bp-portrait svg { width: 100%; height: 100%; display: block; }
        .bp-bio { grid-column: span 2; display: flex; flex-direction: column; justify-content: center; }
        .bp-bio h1 { margin: 0 0 4px; font-size: 24px; font-weight: 850; letter-spacing: -0.03em; }
        .bp-bio p { margin: 0; color: #5e5a54; }
        .bp-bio i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #2fb37a; margin-right: 6px; box-shadow: 0 0 0 4px rgba(47,179,122,.18); }
        .bp-project { grid-column: span 2; grid-row: span 2; background: #1b1b1b; color: #fff; display: flex; flex-direction: column; }
        .bp-project small { color: #aaa; letter-spacing: .1em; text-transform: uppercase; font-size: 10px; font-weight: 700; }
        .bp-project h2 { margin: 4px 0; font-size: 22px; letter-spacing: -0.02em; }
        .bp-shot { margin-top: auto; height: 120px; border-radius: 14px; background: linear-gradient(135deg, var(--accent), #ffd166); position: relative; overflow: hidden; }
        .bp-shot i { position: absolute; background: rgba(255,255,255,.85); border-radius: 8px; }
        .bp-music { display: flex; flex-direction: column; justify-content: space-between; background: #1db954; color: #062b14; }
        .bp-music b { font-size: 14px; }
        .bp-bars { display: flex; align-items: flex-end; gap: 3px; height: 26px; }
        .bp-bars i { width: 4px; border-radius: 2px; background: #062b14; animation: bp-eq .9s ease-in-out infinite alternate; }
        .bp-bars.off i { animation-play-state: paused; }
        @keyframes bp-eq { from { height: 4px; } to { height: 26px; } }
        .bp-map { padding: 0; background: #dfe9e1; }
        .bp-map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
        .bp-map span { position: absolute; left: 10px; bottom: 10px; background: #fff; border-radius: 999px; padding: 3px 9px; font-weight: 700; font-size: 11.5px; }
        .bp-work2 { background: #e8e1ff; display: flex; flex-direction: column; justify-content: flex-end; }
        .bp-work2 b { font-size: 15px; }
        .bp-social { display: flex; flex-direction: column; justify-content: space-between; color: #fff; }
        .bp-social:hover { transform: translateY(-3px) rotate(-1deg); }
        .bp-social .bp-stat { font-weight: 800; font-size: 18px; }
        .bp-social .bp-go { position: absolute; right: 12px; top: 12px; width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,.2); display: grid; place-items: center; opacity: 0; transition: 200ms; }
        .bp-social:hover .bp-go { opacity: 1; }
        @container (max-width: 700px) { .bp { grid-template-columns: repeat(2, 1fr); } .bp-bio, .bp-project { grid-column: span 2; } }
        @media (prefers-reduced-motion: reduce) { .bp-wrap * { animation: none !important; } }
        .bp-wrap[data-paused] * { animation-play-state: paused !important; }
      `}</style>

      <header className="bp-top">
        <b>{name.split(' ')[0].toLowerCase()}.design</b>
        <div className="bp-pill" role="group" aria-label="Highlight">
          {['Work', 'About', 'Contact'].map((g) => <button key={g} aria-pressed={group === g} onClick={() => setGroup(group === g ? null : g)}>{g}</button>)}
        </div>
      </header>

      <section className="bp">
        <div className={cls('portrait', 'bp-portrait')}><Portrait /></div>
        <div className={cls('bio', 'bp-bio')}>
          <h1>Hi, I’m {name.split(' ')[0]}.</h1>
          <p>Product designer making calm software for busy people. Previously at a tiny studio in Porto.</p>
          <p style={{ marginTop: 8, fontWeight: 600, color: '#1b1b1b' }}><i />Open to freelance from January</p>
        </div>
        <div className={cls('music', 'bp-music')} role="button" tabIndex={0} onClick={() => setPlaying(!playing)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPlaying(!playing) } }} aria-label={playing ? 'Pause music' : 'Play music'}>
          <small style={{ fontWeight: 700 }}>{playing ? 'Now playing' : 'Paused'}</small>
          <div className={`bp-bars${playing ? '' : ' off'}`}>{[0.1, 0.5, 0.3, 0.8, 0.2].map((d, i) => <i key={i} style={{ animationDelay: `${-d}s` }} />)}</div>
          <b>Kokoroko · Abusey Junction</b>
        </div>
        <div className={cls('project', 'bp-project')}>
          <small>Current project</small>
          <h2>Tide — a sleep app that doesn’t nag</h2>
          <span style={{ color: '#bbb' }}>Case study coming soon</span>
          <div className="bp-shot" aria-hidden="true">
            <i style={{ left: '8%', top: '18%', width: '38%', height: '64%' }} />
            <i style={{ left: '52%', top: '30%', width: '40%', height: '22%' }} />
            <i style={{ left: '52%', top: '58%', width: '26%', height: '24%' }} />
          </div>
        </div>
        <div className={cls('map', 'bp-map')}>
          <svg viewBox="0 0 200 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <path d="M0 80 Q40 60 70 76 T140 70 T200 82 V130 H0Z" fill="#9fd3e6" />
            {[20, 50, 90, 130, 170].map((x) => <line key={x} x1={x} y1="0" x2={x - 20} y2="80" stroke="#fff" strokeWidth="3" />)}
            {[18, 40, 60].map((y) => <line key={y} x1="0" y1={y} x2="200" y2={y + 6} stroke="#fff" strokeWidth="3" />)}
            <circle cx="104" cy="48" r="14" fill={accent} opacity=".25" />
            <circle cx="104" cy="48" r="6" fill={accent} stroke="#fff" strokeWidth="2" />
          </svg>
          <span>Lisbon · {lisbon}</span>
        </div>
        <div className={cls('work2', 'bp-work2')}>
          <small style={{ color: '#5b4bb5', fontWeight: 700 }}>Selected work</small>
          <b>12 case studies →</b>
        </div>
        {SOCIAL.map(([label, bg, stat]) => (
          <a key={label} href={`#${label}`} onClick={(e) => e.preventDefault()} className={cls('social', 'bp-social')} style={{ background: bg }}>
            <span className="bp-go">↗</span>
            <b>{label}</b>
            <span className="bp-stat">{stat}</span>
          </a>
        ))}
      </section>
    </div>
  )
}
