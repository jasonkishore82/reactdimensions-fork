import { useEffect, useRef, useState } from 'react'
import { useOnScreen } from '../ui/onscreen.js'

// Maximalist creator profile, in the spirit of early-web personal pages:
// a starry pattern, sticker layers, a now-playing box with a scrolling
// title, a visitor counter, link buttons that each have their own colour
// and typeface, ticket-shaped tabs, a guestbook you can sign, a top-friends
// grid and a mood picker.

const LINKS = [
  ['My zine shop', '#ff2bd6', '#111', "'Arial Black', system-ui, sans-serif"],
  ['Mixtapes', '#c6ff00', '#111', "'Courier New', monospace"],
  ['Commissions open', '#2a1bff', '#fff', "Georgia, serif"],
  ['Studio diary', '#ff9f1c', '#111', "'Trebuchet MS', system-ui, sans-serif"],
]
const FRIENDS = [['Kai', '#ff7ac8'], ['Ana', '#2ec4b6'], ['Rui', '#ffd23f'], ['Moe', '#8e44ff'], ['Zed', '#ff4d1a'], ['Lux', '#c6ff00'], ['Pip', '#3b82f6'], ['Bo', '#f6efe1']]
const MOODS = ['☀️ sunny', '🌧️ moody', '⚡ wired', '🌙 sleepy']

export default function MaxProfile({ handle = 'pixiewav', bg = '#160b2e', style }) {
  const root = useRef(null)
  const visible = useOnScreen(root)
  const [tab, setTab] = useState('Links')
  const [visits, setVisits] = useState(48213)
  const [mood, setMood] = useState(0)
  const [book, setBook] = useState([['Kai', 'your mixtape got me through finals!!'], ['Ana', 'love the new zine cover ✦']])
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => setVisits((v) => v + 1), 4000)
    return () => clearInterval(id)
  }, [visible])

  const sign = (e) => {
    e.preventDefault()
    if (!name.trim() || !note.trim()) return
    setBook([[name.trim(), note.trim()], ...book])
    setName(''); setNote('')
  }

  return (
    <div ref={root} className="mp-wrap" data-paused={visible ? undefined : ''} style={{ '--bg': bg, ...style }}>
      <style>{`
        .mp-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: auto; color: #fff; font: 600 13px/1.4 'Trebuchet MS', system-ui, sans-serif; background-color: var(--bg); background-image: radial-gradient(#fff 1px, transparent 1.4px), radial-gradient(#ff2bd6 1.2px, transparent 1.6px); background-size: 40px 40px, 64px 64px; background-position: 0 0, 20px 30px; }
        :where(.mp-wrap) button, :where(.mp-wrap) a { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: none; }
        .mp-wrap[data-paused] * { animation-play-state: paused !important; }
        .mp { display: grid; grid-template-columns: 220px 1fr; gap: 14px; padding: 14px; }
        .mp > * { min-width: 0; }
        .mp-box { background: rgba(10,4,24,.82); border: 3px solid #fff; border-radius: 6px; padding: 12px; box-shadow: 5px 5px 0 #ff2bd6; }
        .mp-me { text-align: center; position: relative; }
        .mp-av { width: 110px; height: 110px; margin: 4px auto 8px; border-radius: 50%; border: 4px solid #c6ff00; background: conic-gradient(#ff2bd6, #ffd23f, #2ec4b6, #2a1bff, #ff2bd6); display: grid; place-items: center; font: 900 34px/1 'Arial Black', system-ui, sans-serif; color: #111; }
        .mp-me h1 { margin: 0; font: 900 22px/1 'Arial Black', system-ui, sans-serif; letter-spacing: -0.02em; text-shadow: 3px 3px 0 #ff2bd6; }
        .mp-me p { margin: 4px 0 0; font: italic 400 15px/1.3 Georgia, serif; }
        .mp-sticker { position: absolute; padding: 4px 8px; font: 900 11px/1 'Courier New', monospace; color: #111; border: 2px solid #111; }
        .mp-mood { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 10px; }
        .mp-mood button { padding: 4px 8px; border-radius: 999px; border: 2px solid #fff; font-size: 12px; }
        .mp-mood button[aria-checked='true'] { background: #c6ff00; color: #111; border-color: #c6ff00; }
        .mp-count { margin-top: 10px; font: 700 12px/1 'Courier New', monospace; }
        .mp-count b { display: inline-block; margin-left: 6px; padding: 3px 6px; background: #000; color: #2fff6b; border: 2px solid #2fff6b; letter-spacing: .2em; font-variant-numeric: tabular-nums; }
        .mp-now { margin-top: 12px; text-align: left; }
        .mp-now small { color: #c6ff00; font: 700 11px/1 'Courier New', monospace; letter-spacing: .1em; }
        .mp-scroll { overflow: hidden; white-space: nowrap; margin: 6px 0; }
        .mp-scroll span { display: inline-block; padding-left: 100%; animation: mp-marq 9s linear infinite; font: italic 700 15px/1.2 Georgia, serif; }
        .mp-scroll.off span { animation-play-state: paused; }
        @keyframes mp-marq { to { transform: translateX(-100%); } }
        .mp-pp { padding: 4px 10px; border: 2px solid #fff; border-radius: 4px; font-size: 12px; }
        .mp-tabs { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
        .mp-tab { position: relative; padding: 8px 16px 8px 20px; background: #ffd23f; color: #111; font: 900 13px/1 'Arial Black', system-ui, sans-serif; clip-path: polygon(10px 0, 100% 0, 100% 35%, calc(100% - 6px) 50%, 100% 65%, 100% 100%, 10px 100%, 0 50%); }
        .mp-tab:nth-child(2) { background: #2ec4b6; }
        .mp-tab:nth-child(3) { background: #ff7ac8; }
        .mp-tab[aria-selected='true'] { background: #fff; outline: 3px solid #c6ff00; outline-offset: -3px; }
        .mp-links { display: grid; gap: 10px; }
        .mp-link { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border: 3px solid #111; box-shadow: 5px 5px 0 #fff; font-size: 17px; transition: transform 120ms, box-shadow 120ms; }
        .mp-link:hover, .mp-link:focus-visible { transform: translate(-2px, -2px) rotate(-.6deg); box-shadow: 8px 8px 0 #fff; }
        .mp-friends { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
        .mp-friend { text-align: center; font-size: 11.5px; }
        .mp-friend i { display: block; aspect-ratio: 1; border: 3px solid #fff; margin-bottom: 4px; font-style: normal; display: grid; place-items: center; font: 900 18px/1 'Arial Black', system-ui, sans-serif; color: #111; }
        .mp-book form { display: grid; grid-template-columns: 1fr 2fr auto; gap: 6px; margin-bottom: 10px; }
        .mp-book input { min-width: 0; padding: 8px; border: 2px solid #fff; background: #000; color: #fff; font: inherit; border-radius: 4px; }
        .mp-book button { padding: 8px 12px; background: #c6ff00; color: #111; border: 2px solid #111; font-weight: 900; }
        .mp-entry { padding: 8px 0; border-bottom: 1px dashed rgba(255,255,255,.4); }
        .mp-entry b { color: #ffd23f; }
        .mp-gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .mp-gallery i { aspect-ratio: 1; border: 3px solid #fff; display: block; }
        @container (max-width: 640px) { .mp { grid-template-columns: 1fr; } .mp-book form { grid-template-columns: 1fr; } }
        @media (prefers-reduced-motion: reduce) { .mp-wrap * { animation: none !important; } .mp-scroll span { padding-left: 0; } .mp-link { transition: none; } }
      `}</style>

      <div className="mp">
        <aside className="mp-box mp-me">
          <span className="mp-sticker" style={{ background: '#ffd23f', left: -6, top: 8, transform: 'rotate(-10deg)' }} aria-hidden="true">NEW ZINE!</span>
          <span className="mp-sticker" style={{ background: '#2ec4b6', right: -8, top: 98, transform: 'rotate(8deg)' }} aria-hidden="true">✦ 100% DIY</span>
          <div className="mp-av" aria-hidden="true">{handle[0].toUpperCase()}</div>
          <h1>@{handle}</h1>
          <p>illustrator · tape collector · night owl</p>
          <div className="mp-mood" role="radiogroup" aria-label="Mood">
            {MOODS.map((m, i) => <button key={m} role="radio" aria-checked={i === mood} onClick={() => setMood(i)}>{m}</button>)}
          </div>
          <div className="mp-count">VISITORS<b aria-live="off">{String(visits).padStart(7, '0')}</b></div>
          <div className="mp-now">
            <small>NOW PLAYING</small>
            <div className={`mp-scroll${playing ? '' : ' off'}`}><span>Kokoroko — Abusey Junction ✦ on repeat since Tuesday</span></div>
            <button className="mp-pp" onClick={() => setPlaying(!playing)}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
          </div>
        </aside>

        <main className="mp-box">
          <div className="mp-tabs" role="tablist" aria-label="Profile">
            {['Links', 'Guestbook', 'Gallery'].map((t) => <button key={t} role="tab" className="mp-tab" aria-selected={t === tab} onClick={() => setTab(t)}>{t}</button>)}
          </div>

          {tab === 'Links' && (
            <>
              <div className="mp-links">
                {LINKS.map(([l, b, c, f]) => <a key={l} className="mp-link" href={`#${l}`} onClick={(e) => e.preventDefault()} style={{ background: b, color: c, fontFamily: f }}>{l}<span aria-hidden="true">↗</span></a>)}
              </div>
              <div className="mp-friends" aria-label="Top friends">
                {FRIENDS.map(([n, c]) => <div key={n} className="mp-friend"><i style={{ background: c }} aria-hidden="true">{n[0]}</i>{n}</div>)}
              </div>
            </>
          )}

          {tab === 'Guestbook' && (
            <div className="mp-book">
              <form onSubmit={sign}>
                <input aria-label="Your name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
                <input aria-label="Message" placeholder="Leave a note…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
                <button type="submit">Sign</button>
              </form>
              {book.map(([n, t], i) => <div key={i} className="mp-entry"><b>{n}</b>: {t}</div>)}
            </div>
          )}

          {tab === 'Gallery' && (
            <div className="mp-gallery">
              {['#ff2bd6', '#c6ff00', '#2a1bff', '#ffd23f', '#2ec4b6', '#ff4d1a'].map((c, i) => <i key={c} style={{ background: `linear-gradient(${i * 60}deg, ${c}, #111)` }} aria-hidden="true" />)}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
