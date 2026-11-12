import { useState } from 'react'

// Skeuomorphic leather journal: a stitched leather cover with a metal clasp
// that locks it. Unlock and open it to lined paper with a ribbon bookmark;
// embossed tabs on the page edge switch sections, and an index-card drawer
// lists every entry. Writing on the page is real (it's a textarea).

const SECTIONS = {
  Today: 'Woke early, walked by the river.\nCoffee at the corner place — finally tried the cardamom bun.\n\nTo do: call Mum, fix the bike light.',
  Ideas: 'A lamp that dims with the sunset.\nZine about bus stops.\nRecipe swap with neighbours?',
  Travel: 'Lisbon in spring:\n- Tram 28 early, before crowds\n- Miradouro at golden hour\n- Pastéis from the little bakery near the river',
}
const TABS = [['Today', '#8b2e2e'], ['Ideas', '#2e5b8b'], ['Travel', '#3f6b3a']]

export default function SkeuJournal({ owner = 'June', style }) {
  const [locked, setLocked] = useState(true)
  const [open, setOpen] = useState(false)
  const [sec, setSec] = useState('Today')
  const [notes, setNotes] = useState(SECTIONS)
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const toggleLock = () => { if (open) setOpen(false); setLocked(!locked) }

  return (
    <div className="jn-wrap" style={style}>
      <style>{`
        .jn-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0 2px, transparent 2px 9px), linear-gradient(180deg, #a26a3e, #7a4b28); color: #2b2015; font: 400 15px/1.5 Georgia, 'Times New Roman', serif; padding: 18px; box-sizing: border-box; display: grid; align-content: safe center; }
        :where(.jn-wrap) button, :where(.jn-wrap) textarea { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .jn { display: grid; grid-template-columns: 1fr 190px; gap: 40px; max-width: 980px; width: 100%; margin: 0 auto; align-items: start; }
        .jn-book { position: relative; perspective: 1600px; min-height: 380px; }
        .jn-pages { position: relative; margin-left: 4%; width: 92%; min-height: 380px; border-radius: 4px 10px 10px 4px; background: repeating-linear-gradient(180deg, transparent 0 27px, #b8cde0 27px 28px) 0 64px / 100% calc(100% - 64px) no-repeat, linear-gradient(90deg, #fdf8ec, #f6efdc); box-shadow: 0 20px 30px rgba(0,0,0,.4), inset 10px 0 18px rgba(120,90,40,.18), 4px 0 0 #efe6d0, 8px 0 0 #e4dac2; padding: 20px 26px 20px 54px; box-sizing: border-box; }
        .jn-pages::before { content: ''; position: absolute; left: 40px; top: 0; bottom: 0; width: 1.5px; background: #e2a0a0; }
        .jn-date { font-style: italic; color: #6a5844; font-size: 14px; }
        .jn-pages h2 { margin: 2px 0 12px; font: 400 26px/1.1 'Brush Script MT', 'Segoe Script', 'Bradley Hand', cursive; color: #2b2015; }
        .jn-text { display: block; width: calc(100% - 40px); min-height: 230px; resize: none; cursor: text; outline: none; font: 400 18px/28px 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive; color: #22305a; }
        .jn-ribbon { position: absolute; right: 22px; top: -6px; width: 16px; height: 120%; background: linear-gradient(90deg, #8b1e1e, #b23030, #8b1e1e); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 94%, 0 100%); box-shadow: 0 2px 4px rgba(0,0,0,.3); pointer-events: none; }
        .jn-tabs { position: absolute; right: -32px; top: 40px; display: flex; flex-direction: column; gap: 8px; }
        .jn-tab { width: 64px; padding: 8px 6px 8px 20px; border-radius: 0 10px 10px 0; color: #fbf3e2; font-size: 12px; letter-spacing: .06em; text-align: left; box-shadow: inset 0 1px 0 rgba(255,255,255,.25), inset 0 -2px 3px rgba(0,0,0,.3), 2px 3px 4px rgba(0,0,0,.3); text-shadow: 0 -1px 0 rgba(0,0,0,.5); transition: transform 150ms; }
        .jn-tab[aria-current='page'] { transform: translateX(8px); }
        .jn-pages[aria-hidden='true'] .jn-tabs { visibility: hidden; }
        .jn-cover { position: absolute; inset: -8px auto -8px 0; width: calc(96% + 16px); border-radius: 8px 16px 16px 8px; transform-origin: left center; transition: transform 900ms cubic-bezier(.4,.1,.2,1); transform-style: preserve-3d; z-index: 3; }
        .jn-cover.open { transform: rotateY(-165deg); }
        .jn-face, .jn-back { position: absolute; inset: 0; border-radius: inherit; backface-visibility: hidden; }
        .jn-face { background: radial-gradient(rgba(0,0,0,.18) 1px, transparent 1.5px) 0 0 / 6px 6px, radial-gradient(rgba(255,255,255,.06) 1px, transparent 1.5px) 3px 3px / 6px 6px, linear-gradient(135deg, #6d3b22, #4a2513 60%, #3a1c0e); box-shadow: inset 0 0 0 10px rgba(0,0,0,.08), inset 0 2px 0 rgba(255,255,255,.15), 0 20px 30px rgba(0,0,0,.45); display: grid; place-items: center; }
        .jn-face::before { content: ''; position: absolute; inset: 14px; border-radius: 6px 10px 10px 6px; border: 2px dashed rgba(240,210,170,.55); }
        .jn-title { position: relative; text-align: center; color: #e9c99a; text-shadow: 0 -1px 0 rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.12); }
        .jn-title b { display: block; font: 400 34px/1 'Brush Script MT', 'Segoe Script', cursive; }
        .jn-title small { letter-spacing: .3em; text-transform: uppercase; font-size: 11px; }
        .jn-back { transform: rotateY(180deg); background: linear-gradient(90deg, #4a2513, #6d3b22); }
        .jn-open { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); padding: 8px 16px; border-radius: 999px; color: #f3dfbf; background: rgba(0,0,0,.25); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); font-size: 13px; }
        .jn-open:disabled { opacity: .6; cursor: not-allowed; }
        .jn-clasp { position: absolute; right: -18px; top: 50%; transform: translateY(-50%); width: 64px; height: 44px; border-radius: 10px 6px 6px 10px; background: linear-gradient(180deg, #f4e2b0, #c9a45a 50%, #a07a32); box-shadow: inset 0 1px 0 #fff6d8, inset 0 -2px 3px rgba(0,0,0,.3), 0 4px 8px rgba(0,0,0,.45); display: grid; place-items: center; color: #4a3410; z-index: 4; }
        .jn-clasp[aria-pressed='false'] { right: -6px; }
        .jn-drawer { border-radius: 10px; padding: 10px; background: linear-gradient(180deg, #5a3a20, #432a16); box-shadow: inset 0 2px 0 rgba(255,255,255,.12), inset 0 -4px 8px rgba(0,0,0,.4), 0 14px 24px rgba(0,0,0,.4); }
        .jn-drawer h3 { margin: 0 0 8px; text-align: center; color: #f3dfbf; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; }
        .jn-card { display: block; width: 100%; text-align: left; margin-top: -10px; padding: 10px 10px 14px; border-radius: 3px; background: repeating-linear-gradient(180deg, transparent 0 17px, #c9dbe9 17px 18px) 0 26px / 100% 100% no-repeat, #fffdf6; box-shadow: 0 -2px 4px rgba(0,0,0,.2); transition: transform 150ms; }
        .jn-card:first-of-type { margin-top: 0; }
        .jn-card:hover, .jn-card[aria-current='true'] { transform: translateY(-6px); }
        .jn-card b { display: block; font-size: 13px; color: #8b1e1e; }
        .jn-card small { display: block; font-size: 11.5px; color: #4a4030; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @container (max-width: 680px) { .jn { grid-template-columns: 1fr; } .jn-tabs { right: -12px; } .jn-tab { width: 50px; padding-left: 10px; } }
        @media (prefers-reduced-motion: reduce) { .jn-cover, .jn-tab, .jn-card { transition: none; } }
      `}</style>

      <div className="jn">
        <section className="jn-book" aria-label={`${owner}'s journal`}>
          <div className="jn-pages" aria-hidden={!open}>
            <span className="jn-ribbon" aria-hidden="true" />
            <div className="jn-date">{date}</div>
            <h2>{sec}</h2>
            <textarea className="jn-text" value={notes[sec]} onChange={(e) => setNotes({ ...notes, [sec]: e.target.value })} aria-label={`${sec} page`} tabIndex={open ? 0 : -1} spellCheck={false} />
            <div className="jn-tabs" role="tablist" aria-label="Sections">
              {TABS.map(([t, c]) => <button key={t} role="tab" className="jn-tab" aria-selected={t === sec} aria-current={t === sec ? 'page' : undefined} tabIndex={open ? 0 : -1} style={{ background: `linear-gradient(180deg, ${c}, color-mix(in srgb, ${c}, black 30%))` }} onClick={() => setSec(t)}>{t}</button>)}
            </div>
          </div>

          <div className={`jn-cover${open ? ' open' : ''}`}>
            <div className="jn-face">
              <div className="jn-title"><b>{owner}’s Journal</b><small>Est. 2026</small></div>
              <button className="jn-open" onClick={() => setOpen(true)} disabled={locked} tabIndex={open ? -1 : 0}>{locked ? 'Locked — undo the clasp' : 'Open journal'}</button>
            </div>
            <div className="jn-back" />
          </div>
          <button className="jn-clasp" aria-pressed={locked} aria-label={locked ? 'Unlock clasp' : 'Lock clasp'} onClick={toggleLock}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">{locked ? <path d="M6 9V6.5a4 4 0 0 1 8 0V9M4.5 9h11v8h-11z" /> : <path d="M6 9V6.5a4 4 0 0 1 7.5-2M4.5 9h11v8h-11z" />}</svg>
          </button>
        </section>

        <aside className="jn-drawer" aria-label="Index cards">
          <h3>Index</h3>
          {Object.entries(notes).map(([t, body]) => (
            <button key={t} className="jn-card" aria-current={open && t === sec} onClick={() => { if (!locked) { setOpen(true); setSec(t) } }} disabled={locked} title={locked ? 'Unlock the journal first' : `Open ${t}`}>
              <b>{t}</b><small>{body.split('\n')[0]}</small>
            </button>
          ))}
        </aside>
      </div>
    </div>
  )
}
