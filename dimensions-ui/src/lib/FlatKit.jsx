import { useState } from 'react'

// A flat UI kit board: a dozen small working widgets (profile, calendar,
// weather, music player, nav bar, mail menu, controls, tags, rating,
// volume, progress and newsletter) on soft flat cards. Two themes: a warm
// beige-and-plum palette and a coral-and-charcoal one.

const THEMES = {
  warm: { bg: '#e6ddd1', card: '#f6f0e7', ink: '#5b4848', muted: '#76665c', accent: '#ee9a6c', alt: '#8f5b60', line: '#e6dacb', dark: '#6b4c50', onAccent: '#2b1a1c' },
  coral: { bg: '#e9eaee', card: '#ffffff', ink: '#3b3b42', muted: '#66666f', accent: '#ef6f57', alt: '#3b3b42', line: '#ececf0', dark: '#34343b', onAccent: '#1e1214' },
}

const I = {
  prev: 'M12 5l-5 5 5 5',
  next: 'M8 5l5 5-5 5',
  play: 'M7 4.5v11l9-5.5z',
  pause: 'M7 4.5v11M13 4.5v11',
  back: 'M10 5L4 10l6 5zM16 5l-6 5 6 5z',
  fwd: 'M10 5l6 5-6 5zM4 5l6 5-6 5z',
  inbox: 'M3 11l2-6h10l2 6v5H3zM3 11h4l1 2h4l1-2h4',
  star: 'M10 3l2.2 4.5 4.8.7-3.5 3.4.8 4.9L10 14.2l-4.3 2.3.8-4.9L3 8.2l4.8-.7z',
  pin: 'M7 3h6l-1 5 3 3H5l3-3zM10 11v6',
  send: 'M3 10l14-6-5 14-2-6z',
  trash: 'M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11',
  mail: 'M3 5h14v10H3zM3 5l7 6 7-6',
  heart: 'M10 16.5S3 12.4 3 7.6A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 7 1.6c0 4.8-7 8.9-7 8.9z',
  share: 'M14 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM14 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.2 11.2l3.6 2.1M11.8 5.7L8.2 8.8',
  pinMap: 'M10 17s-5-5-5-9a5 5 0 0 1 10 0c0 4-5 9-5 9zM10 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
}

const Icon = ({ d, size = 16, fill = false }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MAIL = [['Inbox', 'inbox', 12], ['Starred', 'star', 3], ['Important', 'pin', 0], ['Sent mail', 'send', 0], ['Trash', 'trash', 0]]
const NAVS = ['Portfolio', 'Contact', 'About', 'Blog']
const TAGS = ['Minimalism', 'Awesome', 'Design', 'Tag', 'Hi!']
const VOLUME = [46, 70, 58, 86, 64, 92, 74, 52, 80, 62]

function Calendar() {
  const now = new Date()
  const [offset, setOffset] = useState(0)
  const [picked, setPicked] = useState(now.getDate())
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const startDay = (view.getDay() + 6) % 7 // Monday first
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells = [...Array(startDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)

  return (
    <div className="fk-card fk-cal">
      <div className="fk-calhead">
        <button aria-label="Previous month" onClick={() => setOffset(offset - 1)}><Icon d={I.prev} /></button>
        <b>{MONTHS[view.getMonth()]} {view.getFullYear()}</b>
        <button aria-label="Next month" onClick={() => setOffset(offset + 1)}><Icon d={I.next} /></button>
      </div>
      <div className="fk-calgrid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="fk-dow">{d}</span>)}
        {cells.map((d, i) =>
          d ? (
            <button key={i} className="fk-day" aria-pressed={d === picked && offset === 0} onClick={() => { setPicked(d); setOffset(0) }}>{d}</button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  )
}

export default function FlatKit({ theme = 'warm', radius = 6, style }) {
  const t = THEMES[theme] ?? THEMES.warm
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(34)
  const [nav, setNav] = useState(0)
  const [mail, setMail] = useState(0)
  const [toggles, setToggles] = useState([true, false])
  const [radio, setRadio] = useState(0)
  const [stars, setStars] = useState(3)
  const [tags, setTags] = useState(['Design'])
  const [volume, setVolume] = useState(6)
  const [progress, setProgress] = useState(35)
  const [email, setEmail] = useState('')
  const [joined, setJoined] = useState(false)
  const [follow, setFollow] = useState(false)
  const [liked, setLiked] = useState(false)
  const [shared, setShared] = useState(false)

  const vars = Object.fromEntries(Object.entries(t).map(([k, v]) => [`--${k}`, v]))
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="fk-wrap" style={{ ...vars, '--r': `${radius}px`, ...style }}>
      <style>{`
        .fk-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: var(--bg); color: var(--ink); font: 400 12.5px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        .fk-wrap * { box-sizing: border-box; }
        .fk-wrap button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; padding: 0; }
        .fk { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 18px; }
        .fk-card { background: var(--card); border-radius: var(--r); padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
        .fk-label { font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); text-align: center; }
        .fk-btn { background: var(--alt) !important; color: #fff !important; font-weight: 700 !important; border-radius: var(--r); padding: 8px 12px !important; text-align: center; transition: filter 120ms; }
        .fk-btn:hover { filter: brightness(1.1); }
        .fk-btn.light { background: color-mix(in srgb, var(--accent) 40%, var(--card)) !important; color: var(--onAccent) !important; }
        .fk-btn.accent { background: var(--accent) !important; color: var(--onAccent) !important; }

        /* profile */
        .fk-profile { align-items: center; text-align: center; }
        .fk-ring { position: relative; width: 92px; height: 92px; }
        .fk-ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
        .fk-avatar { position: absolute; inset: 10px; border-radius: 50%; background: var(--alt); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 22px; }
        .fk-profile h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .fk-profile small { color: var(--alt); font-weight: 700; font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase; }
        .fk-profile .fk-btn { align-self: stretch; }

        /* calendar */
        .fk-cal { grid-column: span 2; padding: 0; overflow: hidden; gap: 0; }
        .fk-calhead { display: flex; align-items: center; justify-content: space-between; background: var(--dark); color: #fff; padding: 9px 12px; }
        .fk-calhead b { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
        .fk-calhead button { color: #fff; opacity: .8; display: grid; }
        .fk-calgrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: color-mix(in srgb, var(--accent), white 18%); padding: 1px; }
        .fk-dow { background: var(--accent); color: var(--onAccent); font-weight: 700; font-size: 10.5px; text-align: center; padding: 4px 0; opacity: .85; }
        .fk-calgrid > span:not(.fk-dow) { background: var(--accent); }
        .fk-day { background: var(--accent) !important; color: var(--onAccent) !important; font-weight: 700 !important; padding: 5px 0 !important; }
        .fk-day:hover { filter: brightness(1.08); }
        .fk-day[aria-pressed='true'] { background: var(--dark) !important; color: #fff !important; }

        /* weather */
        .fk-weather { background: var(--alt); color: #fff; }
        .fk-weather .fk-now { display: flex; align-items: center; justify-content: space-between; }
        .fk-weather b { font-size: 30px; font-weight: 300; }
        .fk-weather small { opacity: 1; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
        .fk-days { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; gap: 4px; background: color-mix(in srgb, #000 14%, transparent); border-radius: var(--r); padding: 8px 4px; font-size: 10.5px; }
        .fk-days span b { display: block; font-size: 13px; font-weight: 600; }

        /* player */
        .fk-player { grid-column: span 2; flex-direction: row; align-items: center; gap: 12px; }
        .fk-play { width: 44px; height: 44px; flex: none; border-radius: var(--r) !important; background: var(--alt) !important; color: #fff !important; display: grid; place-items: center; }
        .fk-track { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .fk-track b { font-size: 13px; }
        .fk-track span { color: var(--muted); font-size: 11px; }
        .fk-ctrls { display: flex; gap: 6px; }
        .fk-ctrls button { width: 28px; height: 28px; border-radius: var(--r); background: var(--accent) !important; color: var(--onAccent) !important; display: grid; place-items: center; }

        /* shared range */
        .fk-range { -webkit-appearance: none; appearance: none; width: 100%; height: 8px; border-radius: 999px; background: linear-gradient(to right, var(--accent) var(--p), var(--line) var(--p)); margin: 0; cursor: pointer; }
        .fk-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--dark); border: 0; }
        .fk-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--dark); border: 0; }

        /* nav bar */
        .fk-nav { grid-column: span 2; flex-direction: row; padding: 0; gap: 0; overflow: hidden; background: var(--accent); }
        .fk-nav button { flex: 1; color: var(--onAccent) !important; font-weight: 600; padding: 12px 6px !important; border-right: 1px solid color-mix(in srgb, #fff 25%, transparent) !important; }
        .fk-nav button:last-child { border-right: 0 !important; }
        .fk-nav button[aria-current='page'] { background: var(--dark) !important; color: #fff !important; }

        /* mail menu */
        .fk-mail { padding: 8px; gap: 4px; }
        .fk-mail button { display: flex; align-items: center; gap: 10px; padding: 7px 10px !important; border-radius: var(--r); font-weight: 700; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink) !important; text-align: left; }
        .fk-mail button i { width: 22px; height: 22px; border-radius: 4px; display: grid; place-items: center; background: var(--line); color: var(--alt); flex: none; }
        .fk-mail button .fk-count { margin-left: auto; font-style: normal; font-weight: 800; letter-spacing: 0; background: var(--accent); color: var(--onAccent); border-radius: 999px; padding: 1px 7px; font-size: 10px; }
        .fk-mail button[aria-current='true'] { background: var(--accent) !important; color: var(--onAccent) !important; }
        .fk-mail button[aria-current='true'] i { background: color-mix(in srgb, #fff 30%, transparent); color: var(--onAccent); }
        .fk-mail button[aria-current='true'] .fk-count { background: #fff; color: var(--onAccent); }

        /* controls */
        .fk-ctl { justify-content: space-between; }
        .fk-row { display: flex; align-items: center; gap: 10px; }
        .fk-switch { width: 44px; height: 22px; border-radius: 999px !important; background: var(--dark) !important; position: relative; flex: none; transition: background 150ms; }
        .fk-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--card); transition: transform 150ms; }
        .fk-switch[aria-checked='true'] { background: var(--accent) !important; }
        .fk-switch[aria-checked='true']::after { transform: translateX(22px); }
        .fk-radio { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--dark) !important; display: grid; place-items: center; }
        .fk-radio[aria-checked='true']::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }

        /* tags + rating */
        .fk-tags { display: flex; flex-wrap: wrap; gap: 8px; }
        .fk-tag { position: relative; padding: 4px 9px 4px 16px !important; background: color-mix(in srgb, var(--accent) 35%, var(--card)) !important; color: var(--onAccent) !important; font-weight: 700; font-size: 11px; clip-path: polygon(9px 0, 100% 0, 100% 100%, 9px 100%, 0 50%); border-radius: 0 3px 3px 0; }
        .fk-tag::before { content: ''; position: absolute; left: 8px; top: 50%; width: 4px; height: 4px; margin-top: -2px; border-radius: 50%; background: var(--card); }
        .fk-tag[aria-pressed='true'] { background: var(--accent) !important; }
        .fk-stars { display: flex; gap: 4px; justify-content: center; }
        .fk-stars button { color: var(--line) !important; }
        .fk-stars button.on { color: var(--accent) !important; }

        /* volume */
        .fk-vol-bars { display: flex; align-items: flex-end; justify-content: space-between; height: 78px; gap: 5px; }
        .fk-vol-bars button { flex: 1; height: 100%; display: flex; align-items: flex-end; }
        .fk-vol-bars i { display: block; width: 100%; background: var(--line); border-radius: 2px; }
        .fk-vol-bars button.on i { background: var(--alt); }

        /* progress */
        .fk-prog { justify-content: center; }
        .fk-bubble { align-self: flex-start; background: var(--dark); color: #fff; font-weight: 700; font-size: 11px; padding: 3px 7px; border-radius: 3px; position: relative; transform: translateX(-50%); }
        .fk-bubble::after { content: ''; position: absolute; left: 50%; bottom: -4px; margin-left: -4px; border: 4px solid transparent; border-bottom: 0; border-top-color: var(--dark); }

        /* stats */
        .fk-stats { padding: 0; gap: 0; overflow: hidden; }
        .fk-stats-top { background: var(--dark); color: #fff; padding: 14px; text-align: center; }
        .fk-stats-top h3 { margin: 0 0 2px; font-size: 18px; font-weight: 600; }
        .fk-stats-top small { opacity: .7; }
        .fk-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; }
        .fk-stats-row span { padding: 10px 4px; border-right: 1px solid var(--line); color: var(--muted); font-size: 10.5px; }
        .fk-stats-row span:last-child { border-right: 0; }
        .fk-stats-row b { display: block; color: var(--ink); font-size: 16px; font-weight: 600; }
        .fk-stats .fk-btn { margin: 0 12px 12px; }

        /* newsletter */
        .fk-news input { width: 100%; border: 0; border-radius: var(--r); background: var(--line); color: var(--ink); font: inherit; padding: 9px 10px; outline: none; }
        .fk-news input:focus { box-shadow: inset 0 0 0 2px var(--accent); }

        /* social counts */
        .fk-social { padding: 0; gap: 0; overflow: hidden; flex-direction: row; background: var(--accent); }
        .fk-social button { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--onAccent) !important; padding: 16px 6px !important; font-weight: 700; font-size: 15px; transition: background 120ms; }
        .fk-social button + button { border-left: 3px solid var(--card) !important; }
        .fk-social button small { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; opacity: .8; }
        .fk-social button[aria-pressed='true'] { background: var(--dark) !important; color: #fff !important; }

        @container (max-width: 860px) { .fk { grid-template-columns: repeat(3, 1fr); } }
        @container (max-width: 640px) { .fk { grid-template-columns: repeat(2, 1fr); } .fk-player, .fk-nav { grid-column: span 2; } }
        @container (max-width: 430px) { .fk { grid-template-columns: 1fr; padding: 12px; } .fk-cal, .fk-player, .fk-nav { grid-column: span 1; } }
      `}</style>

      <div className="fk">
        {/* profile */}
        <div className="fk-card fk-profile">
          <div className="fk-ring">
            <svg viewBox="0 0 92 92" aria-hidden="true">
              <circle cx="46" cy="46" r="42" fill="none" stroke="var(--line)" strokeWidth="6" />
              <circle cx="46" cy="46" r="42" fill="none" stroke="var(--accent)" strokeWidth="6" strokeDasharray={`${2 * Math.PI * 42 * 0.68} 999`} strokeLinecap="round" />
            </svg>
            <div className="fk-avatar">SB</div>
          </div>
          <div>
            <h3>Sun Bzy</h3>
            <small>Graphic &amp; UX designer</small>
          </div>
          <button className="fk-btn">Profile</button>
        </div>

        <Calendar />

        {/* weather */}
        <div className="fk-card fk-weather">
          <small>Bangkok</small>
          <div className="fk-now">
            <svg viewBox="0 0 40 40" width="44" height="44" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 26h17a6 6 0 0 0 0-12 9 9 0 0 0-17 2 5 5 0 0 0 0 10z" />
              <path d="M15 30l-2 4M21 30l-2 4M27 30l-2 4" />
            </svg>
            <b>28°C</b>
          </div>
          <div className="fk-days">
            {[['Fri', '26°'], ['Sat', '29°'], ['Sun', '31°']].map(([d, v]) => <span key={d}><b>{v}</b>{d}</span>)}
          </div>
        </div>

        {/* player */}
        <div className="fk-card fk-player">
          <button className="fk-play" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>
            <Icon d={playing ? I.pause : I.play} size={20} fill={!playing} />
          </button>
          <div className="fk-track">
            <b>The Paper Kites · Bloom</b>
            <input className="fk-range" type="range" min="0" max="214" value={time} style={{ '--p': `${(time / 214) * 100}%` }} onChange={(e) => setTime(+e.target.value)} aria-label="Seek" />
            <span>{fmt(time)} / 3:34</span>
          </div>
          <div className="fk-ctrls">
            <button aria-label="Back 10 seconds" onClick={() => setTime(Math.max(0, time - 10))}><Icon d={I.back} size={13} fill /></button>
            <button aria-label="Forward 10 seconds" onClick={() => setTime(Math.min(214, time + 10))}><Icon d={I.fwd} size={13} fill /></button>
          </div>
        </div>

        {/* nav bar */}
        <nav className="fk-card fk-nav">
          {NAVS.map((n, i) => (
            <button key={n} aria-current={i === nav ? 'page' : undefined} onClick={() => setNav(i)}>{n}</button>
          ))}
        </nav>

        {/* mail menu */}
        <div className="fk-card fk-mail">
          {MAIL.map(([label, icon, count], i) => (
            <button key={label} aria-current={i === mail} onClick={() => setMail(i)}>
              <i><Icon d={I[icon]} size={13} /></i>
              {label}
              {count > 0 && <span className="fk-count">{count}</span>}
            </button>
          ))}
        </div>

        {/* stats */}
        <div className="fk-card fk-stats">
          <div className="fk-stats-top">
            <h3>Van Wilder</h3>
            <small><Icon d={I.pinMap} size={11} /> Bangkok, Thailand</small>
          </div>
          <div className="fk-stats-row">
            <span><b>518</b>Posts</span>
            <span><b>{follow ? 906 : 905}</b>Followers</span>
            <span><b>268</b>Following</span>
          </div>
          <button className={`fk-btn${follow ? ' light' : ' accent'}`} onClick={() => setFollow(!follow)}>{follow ? 'Following' : 'Follow'}</button>
        </div>

        {/* controls */}
        <div className="fk-card fk-ctl">
          <div className="fk-label">Controls</div>
          <div className="fk-row">
            <button className="fk-btn">Button</button>
            <button className="fk-btn light">Button</button>
          </div>
          {toggles.map((on, i) => (
            <div key={i} className="fk-row">
              <button role="switch" aria-checked={on} aria-label={`Toggle ${i + 1}`} className="fk-switch" onClick={() => setToggles(toggles.map((v, j) => (j === i ? !v : v)))} />
              <button role="radio" aria-checked={radio === i} aria-label={`Option ${i + 1}`} className="fk-radio" onClick={() => setRadio(i)} />
            </div>
          ))}
        </div>

        {/* tags + rating */}
        <div className="fk-card">
          <div className="fk-label">Tags</div>
          <div className="fk-tags">
            {TAGS.map((tag) => (
              <button key={tag} className="fk-tag" aria-pressed={tags.includes(tag)} onClick={() => setTags(tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag])}>{tag}</button>
            ))}
          </div>
          <div className="fk-stars" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} stars`} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>
                <Icon d={I.star} size={22} fill />
              </button>
            ))}
          </div>
        </div>

        {/* volume */}
        <div className="fk-card">
          <div className="fk-label">Volume control</div>
          <div className="fk-vol-bars">
            {VOLUME.map((h, i) => (
              <button key={i} className={i < volume ? 'on' : ''} aria-label={`Volume ${i + 1}`} onClick={() => setVolume(i + 1)}>
                <i style={{ height: `${h}%` }} />
              </button>
            ))}
          </div>
        </div>

        {/* progress */}
        <div className="fk-card fk-prog">
          <div className="fk-label">Progress</div>
          <span className="fk-bubble" style={{ marginLeft: `calc(${progress}% + ${9 - progress * 0.18}px)` }}>{progress}%</span>
          <input className="fk-range" type="range" min="0" max="100" value={progress} style={{ '--p': `${progress}%` }} onChange={(e) => setProgress(+e.target.value)} aria-label="Progress" />
        </div>

        {/* newsletter */}
        <form className="fk-card fk-news" onSubmit={(e) => { e.preventDefault(); if (email.includes('@')) setJoined(true) }}>
          <div className="fk-label">Join the newsletter</div>
          {joined ? (
            <p style={{ margin: 0, textAlign: 'center', fontWeight: 600 }}>Thanks, you're in.</p>
          ) : (
            <>
              <input type="email" placeholder="yourname@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
              <button className="fk-btn accent" type="submit">Subscribe</button>
            </>
          )}
        </form>

        {/* social counts */}
        <div className="fk-card fk-social">
          <button aria-pressed={liked} onClick={() => setLiked(!liked)}>
            <Icon d={I.heart} size={20} fill={liked} />
            {(500 + (liked ? 1 : 0)).toLocaleString()}
            <small>Likes</small>
          </button>
          <button aria-pressed={shared} onClick={() => setShared(!shared)}>
            <Icon d={I.share} size={20} />
            {(12000 + (shared ? 1 : 0)).toLocaleString()}
            <small>Shares</small>
          </button>
        </div>
      </div>
    </div>
  )
}
