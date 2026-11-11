import { useMemo, useState } from 'react'

// Maximalist kids' learning app: bright colour everywhere, patterns, a
// friendly character and big rounded answer buttons with pictures. Count the
// fruit, tap the answer, earn a star on the trail. Following the research,
// colour is loud but motion stays calm, and every target is large.

const FRUIT = [['apple', '#ff4d4d'], ['pear', '#9bd13c'], ['orange', '#ff9f1c'], ['plum', '#8e44ff'], ['lemon', '#ffd23f']]
const TABS = [['Learn', '#ff4d4d'], ['Play', '#2ec4b6'], ['Stars', '#ffd23f'], ['Me', '#c4a3ff']]
const GOAL = 5

const rand = (seed) => { let x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x) }

function Fruit({ kind, colour, size = 40 }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <circle cx="20" cy="23" r={kind === 'lemon' ? 14 : 15} fill={colour} stroke="#1d1d2b" strokeWidth="2.5" />
      <path d="M20 9 Q22 4 26 3" stroke="#5a3a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M21 8 Q28 6 30 11 Q24 13 21 8z" fill="#2fbf71" stroke="#1d1d2b" strokeWidth="1.5" />
      <circle cx="14" cy="18" r="3" fill="#fff" opacity=".7" />
    </svg>
  )
}

function Buddy({ mood }) {
  return (
    <svg viewBox="0 0 120 120" width="110" height="110" aria-hidden="true">
      <ellipse cx="60" cy="72" rx="44" ry="40" fill="#2ec4b6" stroke="#1d1d2b" strokeWidth="4" />
      <circle cx="40" cy="30" r="12" fill="#2ec4b6" stroke="#1d1d2b" strokeWidth="4" />
      <circle cx="80" cy="30" r="12" fill="#2ec4b6" stroke="#1d1d2b" strokeWidth="4" />
      <circle cx="45" cy="64" r="9" fill="#fff" stroke="#1d1d2b" strokeWidth="3" /><circle cx="47" cy="66" r="4" fill="#1d1d2b" />
      <circle cx="75" cy="64" r="9" fill="#fff" stroke="#1d1d2b" strokeWidth="3" /><circle cx="77" cy="66" r="4" fill="#1d1d2b" />
      <path d={mood === 'happy' ? 'M44 86 Q60 102 76 86' : mood === 'oops' ? 'M48 92 Q60 84 72 92' : 'M48 88 L72 88'} stroke="#1d1d2b" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="34" cy="82" r="5" fill="#ff7ac8" opacity=".7" /><circle cx="86" cy="82" r="5" fill="#ff7ac8" opacity=".7" />
    </svg>
  )
}

export default function MaxKids({ childName = 'Mia', style }) {
  const [round, setRound] = useState(1)
  const [stars, setStars] = useState(0)
  const [mood, setMood] = useState('ready')
  const [tab, setTab] = useState(0)
  const [picked, setPicked] = useState(null)

  const q = useMemo(() => {
    const count = 2 + Math.floor(rand(round) * 6)
    const [kind, colour] = FRUIT[Math.floor(rand(round + 7) * FRUIT.length)]
    // one wrong answer below the right one and one above, so they never clash
    const below = Math.max(1, count - 1 - Math.floor(rand(round + 1) * 2))
    const above = count + 1 + Math.floor(rand(round + 2) * 2)
    const answers = [...new Set([count, below === count ? count + 3 : below, above])].sort((a, b) => rand(a + round) - rand(b + round))
    return { count, kind, colour, answers }
  }, [round])

  const answer = (n) => {
    setPicked(n)
    if (n === q.count) {
      setMood('happy')
      setStars((s) => Math.min(GOAL, s + 1))
      setTimeout(() => { setRound((r) => r + 1); setMood('ready'); setPicked(null) }, 900)
    } else setMood('oops')
  }
  const done = stars >= GOAL

  return (
    <div className="mk-wrap" style={style}>
      <style>{`
        .mk-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; color: #1d1d2b; font: 800 15px/1.3 'Trebuchet MS', 'Comic Sans MS', system-ui, sans-serif; background: #ffd23f; background-image: radial-gradient(#ff9f1c 3px, transparent 3.5px), radial-gradient(#ff7ac8 3px, transparent 3.5px); background-size: 34px 34px; background-position: 0 0, 17px 17px; }
        :where(.mk-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .mk { display: grid; grid-template-columns: 1fr 200px; gap: 14px; padding: 14px; }
        .mk-card { background: #fff; border: 4px solid #1d1d2b; border-radius: 28px; box-shadow: 0 6px 0 #1d1d2b; padding: 16px; }
        .mk-hi { display: flex; align-items: center; gap: 12px; }
        .mk-hi h1 { margin: 0; font-size: 24px; line-height: 1.1; }
        .mk-hi p { margin: 4px 0 0; font-weight: 700; color: #3d3d55; }
        .mk-fruit { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; padding: 14px; margin: 12px 0; border-radius: 22px; background: repeating-linear-gradient(45deg, #e7fbf8 0 14px, #d2f6f1 14px 28px); border: 3px dashed #2ec4b6; min-height: 96px; align-items: center; }
        .mk-ask { text-align: center; font-size: 20px; margin: 0 0 12px; }
        .mk-answers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .mk-ans { min-height: 76px; border-radius: 24px; border: 4px solid #1d1d2b; font-size: 36px; box-shadow: 0 6px 0 #1d1d2b; transition: transform 120ms, box-shadow 120ms; }
        .mk-ans:active { transform: translateY(4px); box-shadow: 0 2px 0 #1d1d2b; }
        .mk-ans:focus-visible { outline: 4px solid #2a1bff; outline-offset: 3px; }
        .mk-ans.right { background: #2fbf71 !important; }
        .mk-ans.wrong { background: #ddd !important; text-decoration: line-through; }
        .mk-side { display: flex; flex-direction: column; gap: 12px; }
        .mk-trail h2 { margin: 0 0 8px; font-size: 15px; }
        .mk-stars { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
        .mk-star { aspect-ratio: 1; display: grid; place-items: center; border-radius: 50%; background: #f1eefc; border: 3px dashed #b9b2d9; }
        .mk-star.on { background: #ffd23f; border: 3px solid #1d1d2b; }
        .mk-badge { text-align: center; }
        .mk-badge b { display: block; font-size: 18px; }
        .mk-again { margin-top: 8px; padding: 10px 14px; border-radius: 999px; background: #8e44ff; color: #fff; border: 3px solid #1d1d2b; }
        .mk-wrap .mk-again { color: #fff; }
        .mk-tabs { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .mk-tab { padding: 10px 6px; border-radius: 20px; border: 4px solid #1d1d2b; color: #1d1d2b; box-shadow: 0 5px 0 #1d1d2b; display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .mk-tab[aria-current='page'] { transform: translateY(3px); box-shadow: 0 2px 0 #1d1d2b; outline: 4px solid #fff; outline-offset: -8px; }
        .mk-tab i { font-style: normal; font-size: 22px; }
        @container (max-width: 640px) { .mk { grid-template-columns: 1fr; } .mk-answers { gap: 8px; } }
        @media (prefers-reduced-motion: reduce) { .mk-ans, .mk-tab { transition: none; } }
      `}</style>

      <div className="mk">
        <section className="mk-card">
          <div className="mk-hi">
            <Buddy mood={mood} />
            <div>
              <h1>{done ? `Amazing, ${childName}!` : `Hi ${childName}! Let’s count.`}</h1>
              <p role="status">{done ? 'You found all 5 stars.' : mood === 'happy' ? 'Yes! That’s right!' : mood === 'oops' ? 'Nearly! Count again slowly.' : `Round ${round}`}</p>
            </div>
          </div>
          {!done && (
            <>
              <div className="mk-fruit" role="img" aria-label={`${q.count} ${q.kind}s`}>
                {Array.from({ length: q.count }, (_, i) => <Fruit key={i} kind={q.kind} colour={q.colour} size={44} />)}
              </div>
              <p className="mk-ask">How many {q.kind}s?</p>
              <div className="mk-answers">
                {q.answers.map((n, i) => (
                  <button key={n} className={`mk-ans${picked === n ? (n === q.count ? ' right' : ' wrong') : ''}`} style={{ background: ['#ff7ac8', '#2ec4b6', '#ff9f1c'][i] }} onClick={() => answer(n)} disabled={mood === 'happy'} aria-label={`${n}`}>
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="mk-side">
          <div className="mk-card mk-trail">
            <h2>Star trail</h2>
            <div className="mk-stars" role="img" aria-label={`${stars} of ${GOAL} stars`}>
              {Array.from({ length: GOAL }, (_, i) => <span key={i} className={`mk-star${i < stars ? ' on' : ''}`} aria-hidden="true">{i < stars ? '★' : ''}</span>)}
            </div>
          </div>
          <div className="mk-card mk-badge">
            <span style={{ fontSize: 40 }} aria-hidden="true">{done ? '🏆' : '🍎'}</span>
            <b>{done ? 'Counting Champ' : 'Fruit Counter'}</b>
            {done && <button className="mk-again" onClick={() => { setStars(0); setRound((r) => r + 1); setMood('ready'); setPicked(null) }}>Play again</button>}
          </div>
        </aside>

        <nav className="mk-tabs" aria-label="Sections">
          {TABS.map(([l, c], n) => (
            <button key={l} className="mk-tab" style={{ background: c }} aria-current={n === tab ? 'page' : undefined} onClick={() => setTab(n)}>
              <i aria-hidden="true">{['📚', '🎲', '⭐', '🙂'][n]}</i>{l}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
