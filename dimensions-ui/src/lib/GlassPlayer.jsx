import { useEffect, useState } from 'react'

// Glassmorphism music player. The album art (drawn in code) is blurred to
// fill the screen, and the controls sit on a frosted card over it. Round
// glass buttons, a floating glass nav pill with a sliding highlight, and a
// glass queue panel that slides in from the right.

const QUEUE = [
  { title: 'Undertow', artist: 'Marlow Vance', album: 'Low Tide', art: 'sunset', len: 214 },
  { title: 'Grid Lines', artist: 'The Ordinals', album: 'Paper Cities', art: 'bauhaus', len: 187 },
  { title: 'Last Stop', artist: 'Kai Ferro', album: 'Night Bus', art: 'city', len: 242 },
  { title: 'Salt Air', artist: 'Marlow Vance', album: 'Low Tide', art: 'sunset', len: 198 },
  { title: 'Primary', artist: 'The Ordinals', album: 'Paper Cities', art: 'bauhaus', len: 176 },
]

const NAV = ['Library', 'Search', 'Now Playing']

// Lit windows for the city skyline, fixed so the art doesn't flicker.
const WINDOWS = Array.from({ length: 70 }, (_, i) => ({ x: (i * 37) % 180 + 10, y: 92 + ((i * 53) % 90), on: (i * 7) % 5 < 2 }))

function Art({ kind }) {
  if (kind === 'sunset') {
    return (
      <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="gp-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b1f5c" />
            <stop offset=".55" stopColor="#f26a4b" />
            <stop offset="1" stopColor="#ffc46b" />
          </linearGradient>
          <clipPath id="gp-sun"><rect x="0" y="0" width="200" height="118" /></clipPath>
        </defs>
        <rect width="200" height="200" fill="url(#gp-sky)" />
        <g clipPath="url(#gp-sun)">
          <circle cx="100" cy="112" r="46" fill="#ffe08a" />
          {[84, 94, 102, 109, 115].map((y, i) => <rect key={y} x="40" y={y} width="120" height={2 + i * 0.8} fill="#f26a4b" />)}
        </g>
        <rect y="118" width="200" height="82" fill="#1d2b55" />
        {[126, 136, 148, 162, 178].map((y, i) => <rect key={y} x={70 - i * 8} y={y} width={60 + i * 16} height="2.5" rx="1.2" fill="#ffb86b" opacity={0.75 - i * 0.12} />)}
      </svg>
    )
  }
  if (kind === 'bauhaus') {
    return (
      <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="200" height="200" fill="#efe4cc" />
        <circle cx="128" cy="78" r="50" fill="#e0412b" />
        <path d="M20 200V110a90 90 0 0 1 90 90z" fill="#1f4bb8" />
        <path d="M150 140l40 60h-80z" fill="#f2b705" />
        <rect x="18" y="30" width="70" height="10" fill="#151515" />
        <rect x="18" y="48" width="40" height="10" fill="#151515" />
        <circle cx="128" cy="78" r="18" fill="#efe4cc" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="200" height="200" fill="#121a3a" />
      <circle cx="150" cy="48" r="20" fill="#ff8fb1" />
      <circle cx="158" cy="42" r="18" fill="#121a3a" />
      {[[0, 100, 40], [36, 80, 34], [66, 118, 30], [92, 70, 44], [132, 96, 36], [164, 84, 36]].map(([x, y, w]) => (
        <rect key={x} x={x} y={y} width={w} height={200 - y} fill="#1d2754" />
      ))}
      {WINDOWS.map((w, i) => <rect key={i} x={w.x} y={w.y} width="4" height="5" fill={w.on ? '#ffd27a' : '#26316a'} />)}
      <rect y="176" width="200" height="24" fill="#0b1130" />
      <rect x="20" y="182" width="64" height="12" rx="3" fill="#ff5d73" />
      <circle cx="30" cy="196" r="4" fill="#0b1130" /><circle cx="74" cy="196" r="4" fill="#0b1130" />
    </svg>
  )
}

const Btn = ({ d, fill }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)
const D = {
  play: 'M8 5.5v13l11-6.5z',
  pause: 'M9 5v14M15 5v14',
  prev: 'M18 6l-8 6 8 6zM6 6v12',
  next: 'M6 6l8 6-8 6zM18 6v12',
  heart: 'M12 20s-7-4.3-7-9.4A4 4 0 0 1 12 8a4 4 0 0 1 7 2.6C19 15.7 12 20 12 20z',
  list: 'M4 6h16M4 12h10M4 18h7M17 15l3 3-3 3',
  close: 'M6 6l12 12M18 6L6 18',
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`

export default function GlassPlayer({ blur = 18, frost = 0.16, autoplay = false, style }) {
  const [i, setI] = useState(0)
  const [t, setT] = useState(48)
  const [playing, setPlaying] = useState(autoplay)
  const [liked, setLiked] = useState([1])
  const [nav, setNav] = useState(2)
  const [queueOpen, setQueueOpen] = useState(false)
  const track = QUEUE[i]

  useEffect(() => setPlaying(autoplay), [autoplay])
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setT((v) => {
        if (v + 0.25 < QUEUE[i].len) return v + 0.25
        setI((n) => (n + 1) % QUEUE.length)
        return 0
      })
    }, 250)
    return () => clearInterval(id)
  }, [playing, i])

  const go = (n) => { setI((n + QUEUE.length) % QUEUE.length); setT(0) }

  return (
    <div className="gp-wrap" style={{ '--blur': `${blur}px`, '--frost': frost, ...style }}>
      <style>{`
        .gp-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; background: #111; color: #fff; font: 400 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.gp-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .gp-bg { position: absolute; inset: -60px; transition: opacity 700ms ease; }
        .gp-bg svg { width: 100%; height: 100%; filter: blur(34px) saturate(1.35); transform: scale(1.1); }
        .gp-shade { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 30%, rgba(0,0,0,.35)); }
        .gp-glass { background: rgba(255,255,255,var(--frost)); border: 1px solid rgba(255,255,255,.32); box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 18px 40px rgba(0,0,0,.18); -webkit-backdrop-filter: blur(var(--blur)) saturate(150%); backdrop-filter: blur(var(--blur)) saturate(150%); }
        .gp-stage { position: relative; height: 100%; display: grid; place-items: center; padding: 14px 14px 70px; }
        .gp-card { width: min(300px, 100%); border-radius: 26px; padding: 14px; display: flex; gap: 14px; align-items: center; }
        .gp-art { width: 112px; aspect-ratio: 1; border-radius: 16px; overflow: hidden; flex: none; box-shadow: 0 10px 24px rgba(0,0,0,.3); }
        .gp-art svg { width: 100%; height: 100%; display: block; }
        .gp-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
        .gp-info small { text-transform: uppercase; letter-spacing: .12em; font-size: 9.5px; opacity: .75; }
        .gp-info b { font-size: 17px; font-weight: 700; line-height: 1.15; }
        .gp-info span { opacity: .8; }
        .gp-bar { height: 5px; border-radius: 999px; background: rgba(255,255,255,.25); overflow: hidden; cursor: pointer; }
        .gp-bar i { display: block; height: 100%; background: #fff; border-radius: inherit; }
        .gp-times { display: flex; justify-content: space-between; font-size: 10.5px; opacity: .75; font-variant-numeric: tabular-nums; }
        .gp-ctrls { display: flex; align-items: center; justify-content: space-between; }
        .gp-round { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; transition: transform 120ms, background 120ms; }
        .gp-round:hover { background: rgba(255,255,255,.28); }
        .gp-round:active { transform: scale(.92); }
        .gp-round.big { width: 46px; height: 46px; background: rgba(255,255,255,.42); }
        .gp-round.on { color: #ff6b8b; }
        .gp-nav { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); display: grid; grid-template-columns: repeat(3, 96px); padding: 4px; border-radius: 999px; }
        .gp-nav button { position: relative; z-index: 1; padding: 8px 0; font-weight: 600; font-size: 12px; opacity: .8; }
        .gp-nav button[aria-current='page'] { opacity: 1; }
        .gp-hl { position: absolute; top: 4px; bottom: 4px; left: 4px; width: 96px; border-radius: 999px; background: rgba(255,255,255,.3); transition: transform 300ms cubic-bezier(.3,1.3,.5,1); }
        .gp-qbtn { position: absolute; top: 14px; right: 14px; border-radius: 999px; padding: 7px 12px; display: flex; gap: 6px; align-items: center; font-weight: 600; font-size: 12px; z-index: 3; }
        .gp-queue { position: absolute; top: 0; right: 0; bottom: 0; width: min(250px, 80%); border-radius: 22px 0 0 22px; padding: 56px 12px 12px; transform: translateX(105%); transition: transform 380ms cubic-bezier(.2,.8,.2,1); z-index: 2; display: flex; flex-direction: column; gap: 4px; }
        .gp-queue.open { transform: none; }
        .gp-queue h4 { margin: 0 0 6px 6px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; opacity: .75; }
        .gp-row { display: flex; align-items: center; gap: 10px; padding: 6px; border-radius: 12px; text-align: left; }
        .gp-row:hover { background: rgba(255,255,255,.14); }
        .gp-row[aria-current='true'] { background: rgba(255,255,255,.26); }
        .gp-row .gp-thumb { width: 36px; height: 36px; border-radius: 8px; overflow: hidden; flex: none; }
        .gp-row .gp-thumb svg { width: 100%; height: 100%; display: block; }
        .gp-row b { display: block; font-size: 12.5px; }
        .gp-row span { font-size: 11px; opacity: .7; }
        @container (max-width: 420px) { .gp-card { flex-direction: column; align-items: stretch; } .gp-art { width: 100%; max-height: 140px; aspect-ratio: auto; } .gp-nav { grid-template-columns: repeat(3, 84px); } .gp-hl { width: 84px; } }
      `}</style>

      {QUEUE.map((q, n) => (
        <div key={n} className="gp-bg" style={{ opacity: n === i ? 1 : 0 }} aria-hidden="true"><Art kind={q.art} /></div>
      ))}
      <div className="gp-shade" />

      <div className="gp-stage">
        <div className="gp-card gp-glass">
          <div className="gp-art"><Art kind={track.art} /></div>
          <div className="gp-info">
            <small>{track.album}</small>
            <div>
              <b>{track.title}</b>
              <br />
              <span>{track.artist}</span>
            </div>
            <div
              className="gp-bar"
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={track.len}
              aria-valuenow={Math.floor(t)}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setT(((e.clientX - r.left) / r.width) * track.len) }}
            >
              <i style={{ width: `${(t / track.len) * 100}%` }} />
            </div>
            <div className="gp-times"><span>{fmt(t)}</span><span>−{fmt(track.len - t)}</span></div>
            <div className="gp-ctrls">
              <button className="gp-round gp-glass" aria-label="Previous" onClick={() => go(i - 1)}><Btn d={D.prev} fill /></button>
              <button className="gp-round big gp-glass" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}><Btn d={playing ? D.pause : D.play} fill={!playing} /></button>
              <button className="gp-round gp-glass" aria-label="Next" onClick={() => go(i + 1)}><Btn d={D.next} fill /></button>
              <button className={`gp-round gp-glass${liked.includes(i) ? ' on' : ''}`} aria-label="Like" aria-pressed={liked.includes(i)} onClick={() => setLiked(liked.includes(i) ? liked.filter((x) => x !== i) : [...liked, i])}><Btn d={D.heart} fill={liked.includes(i)} /></button>
            </div>
          </div>
        </div>
      </div>

      <button className="gp-qbtn gp-glass" aria-expanded={queueOpen} onClick={() => setQueueOpen(!queueOpen)}>
        <Btn d={queueOpen ? D.close : D.list} /> {queueOpen ? 'Close' : 'Queue'}
      </button>

      <aside className={`gp-queue gp-glass${queueOpen ? ' open' : ''}`} aria-hidden={!queueOpen}>
        <h4>Up next</h4>
        {QUEUE.map((q, n) => (
          <button key={n} className="gp-row" aria-current={n === i} tabIndex={queueOpen ? 0 : -1} onClick={() => go(n)}>
            <span className="gp-thumb"><Art kind={q.art} /></span>
            <span><b>{q.title}</b><span>{q.artist} · {fmt(q.len)}</span></span>
          </button>
        ))}
      </aside>

      <nav className="gp-nav gp-glass">
        <span className="gp-hl" style={{ transform: `translateX(${nav * 100}%)` }} />
        {NAV.map((n, k) => (
          <button key={n} aria-current={k === nav ? 'page' : undefined} onClick={() => setNav(k)}>{n}</button>
        ))}
      </nav>
    </div>
  )
}
