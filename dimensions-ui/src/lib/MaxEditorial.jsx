import { useState } from 'react'

// Maximalist editorial magazine: serif, display and mono type mixed on
// purpose, a pull quote laid over the lead image, section names set huge
// across the top, stamp-style buttons, and a "More stories" rail of cut-out
// shapes. The article text itself stays calm and readable, with a size
// toggle for comfort.

const SECTIONS = {
  Culture: { kicker: 'Culture · Issue 31', title: 'The loud room', dek: 'Why a new wave of designers is filling every inch, and why it works.', quote: '“Silence was the trend. Now everyone wants to be heard.”', body: 'For a decade the internet whispered: white space, one typeface, a single accent colour. Then the volume knob turned. Studios began stacking type over image, mixing serifs with grotesques, and letting colour clash on purpose. The trick, they say, is that the noise is designed.', art: ['#ff4d1a', '#ffd23f', '#1b1b1f'] },
  Music: { kicker: 'Music · Issue 31', title: 'Tape is back', dek: 'Cassette labels are outselling vinyl in three cities. We went to find out why.', quote: '“You can hold it in one hand and lose it in a pocket.”', body: 'In a basement studio lit by a single red bulb, a four-track recorder hums. The label pressing these tapes started as a joke between friends; now its runs sell out in an afternoon. Scarcity helps, but so does the ritual of pressing play and committing to a whole side.', art: ['#2a1bff', '#ff7ac8', '#f6efe1'] },
  Food: { kicker: 'Food · Issue 31', title: 'Lunch, loudly', dek: 'A canteen where every plate is a different colour and nobody whispers.', quote: '“We wanted it to feel like a party at noon.”', body: 'The menu changes daily and is painted on the wall in letters a metre high. Plates come in seven colours, none of them matching. Regulars say the chaos is the point: you sit next to strangers, you shout across the table, you leave in a better mood than you came.', art: ['#0f8a5f', '#c6ff00', '#ff4d1a'] },
}
const MORE = [['How to dress like a poster', '#ffd23f', 'polygon(0 10%, 100% 0, 92% 100%, 6% 88%)'], ['Ten fonts we can’t stop using', '#ff7ac8', 'circle(48% at 50% 50%)'], ['The return of the zine', '#2a1bff', 'polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)']]

export default function MaxEditorial({ masthead = 'RACKET', accent = '#ff4d1a', style }) {
  const [sec, setSec] = useState('Culture')
  const [saved, setSaved] = useState([])
  const [big, setBig] = useState(false)
  const s = SECTIONS[sec]
  const isSaved = saved.includes(sec)

  return (
    <div className="me-wrap" style={{ '--accent': accent, ...style }}>
      <style>{`
        .me-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: #f6efe1; color: #161616; font: 400 14px/1.6 Georgia, 'Times New Roman', serif; }
        :where(.me-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .me-mast { display: flex; justify-content: space-between; align-items: end; gap: 10px; padding: 12px 18px 6px; border-bottom: 4px double #161616; }
        .me-mast b { font: 900 clamp(34px, 7cqw, 64px)/0.85 'Arial Black', 'Helvetica Neue', system-ui, sans-serif; letter-spacing: -0.05em; }
        .me-mast small { font: 700 11px/1.3 'Courier New', monospace; text-align: right; }
        .me-secs { display: flex; gap: 14px; padding: 8px 18px; border-bottom: 2px solid #161616; overflow-x: auto; }
        .me-secs button { font: 900 clamp(20px, 3.4cqw, 30px)/1 'Arial Black', system-ui, sans-serif; letter-spacing: -0.03em; color: #8a8378; }
        .me-secs button:nth-child(2) { font: italic 400 clamp(24px, 3.8cqw, 34px)/1 Georgia, serif; }
        .me-secs button:nth-child(3) { font: 700 clamp(18px, 3cqw, 26px)/1 'Courier New', monospace; }
        .me-secs button[aria-pressed='true'] { color: #161616; text-decoration: underline wavy var(--accent) 3px; text-underline-offset: 6px; }
        .me { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; padding: 16px 18px 20px; }
        .me-lead { position: relative; }
        .me-art { position: relative; height: 210px; overflow: hidden; border: 3px solid #161616; }
        .me-art i { position: absolute; }
        .me-quote { position: relative; margin: -60px 0 0 auto; width: 78%; background: var(--accent); color: #161616; padding: 14px 16px; font: italic 700 clamp(18px, 2.6cqw, 24px)/1.15 Georgia, serif; border: 3px solid #161616; box-shadow: 6px 6px 0 #161616; transform: rotate(-1.5deg); }
        .me-kicker { margin: 16px 0 4px; font: 700 11px/1 'Courier New', monospace; letter-spacing: .14em; text-transform: uppercase; }
        .me-lead h1 { margin: 0; font: 900 clamp(34px, 6cqw, 58px)/0.9 'Arial Black', system-ui, sans-serif; letter-spacing: -0.04em; }
        .me-dek { margin: 8px 0 12px; font: italic 400 18px/1.35 Georgia, serif; color: #3b3b3b; }
        .me-body { max-width: 62ch; }
        .me-body.big { font-size: 17px; }
        .me-body::first-letter { float: left; font: 900 40px/1 'Arial Black', system-ui, sans-serif; margin: 4px 10px 0 0; padding: 6px 10px; background: var(--accent); color: #161616; border: 3px solid #161616; }
        .me-stamps { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
        .me-stamp { padding: 8px 12px; border: 3px dashed #161616; font: 900 12px/1 'Courier New', monospace; letter-spacing: .12em; text-transform: uppercase; transform: rotate(-2deg); background: #fff; transition: transform 120ms; }
        .me-stamp:hover { transform: rotate(1deg) scale(1.04); }
        .me-stamp[aria-pressed='true'] { background: #161616; color: #f6efe1; border-style: solid; }
        .me-rail h2 { margin: 0 0 10px; font: 900 13px/1 'Courier New', monospace; letter-spacing: .2em; text-transform: uppercase; border-bottom: 2px solid #161616; padding-bottom: 6px; }
        .me-more { display: grid; grid-template-columns: 74px 1fr; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #c9bfae; text-align: left; }
        .me-more i { width: 74px; height: 74px; display: block; }
        .me-more b { font: 700 17px/1.15 Georgia, serif; }
        .me-more:hover b { text-decoration: underline; }
        @container (max-width: 680px) { .me { grid-template-columns: 1fr; } }
      `}</style>

      <header className="me-mast"><b>{masthead}</b><small>Issue 31<br />Autumn · £8</small></header>
      <nav className="me-secs" aria-label="Sections">
        {Object.keys(SECTIONS).map((k) => <button key={k} aria-pressed={k === sec} onClick={() => setSec(k)}>{k}</button>)}
      </nav>

      <div className="me">
        <article className="me-lead">
          <div className="me-art" aria-hidden="true" style={{ background: s.art[0] }}>
            <i style={{ width: 240, height: 240, borderRadius: '50%', background: s.art[1], right: -40, top: -60 }} />
            <i style={{ width: '120%', height: 40, background: s.art[2], left: -20, bottom: 50, transform: 'rotate(-8deg)' }} />
            <i style={{ width: 90, height: 90, border: `14px solid ${s.art[2]}`, borderRadius: '50%', left: 30, top: 30 }} />
          </div>
          <blockquote className="me-quote">{s.quote}</blockquote>
          <p className="me-kicker">{s.kicker}</p>
          <h1>{s.title}</h1>
          <p className="me-dek">{s.dek}</p>
          <p className={`me-body${big ? ' big' : ''}`}>{s.body}</p>
          <div className="me-stamps">
            <button className="me-stamp" aria-pressed={isSaved} onClick={() => setSaved(isSaved ? saved.filter((x) => x !== sec) : [...saved, sec])}>{isSaved ? 'Saved ✓' : 'Save story'}</button>
            <button className="me-stamp" aria-pressed={big} onClick={() => setBig(!big)}>Aa {big ? 'Smaller' : 'Larger'} text</button>
            <button className="me-stamp">Share</button>
          </div>
        </article>

        <aside className="me-rail" aria-label="More stories">
          <h2>More stories</h2>
          {MORE.map(([t, c, shape]) => (
            <button key={t} className="me-more"><i style={{ background: c, clipPath: shape }} aria-hidden="true" /><b>{t}</b></button>
          ))}
        </aside>
      </div>
    </div>
  )
}
