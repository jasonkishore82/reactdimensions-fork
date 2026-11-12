import { useRef, useState } from 'react'

// Minimal reading app: one serif face, a ~65-character measure, wide
// margins and nothing else on the page. Scroll up and a thin pill appears
// with the chapter and your progress; "Contents" slides in a plain list.
// Text-only controls change size and paper (light, sepia, dark).

const BOOK = [
  ['I. The quiet hour', [
    'There is an hour before the city wakes when the streets belong to bakers, cyclists and people walking dogs who will not be hurried. Nothing is asked of you yet. The light is grey and patient.',
    'I started going out at that hour by accident, after a run of bad sleep, and kept going on purpose. The walk was the same each day: down the hill, along the river, back past the closed market. What changed was how much I noticed.',
    'You notice more when there is less. The shopfront you pass every afternoon, half hidden by crowds, turns out to have a tiled doorstep in three blues. A bench you never sat on has a name carved into the armrest.',
  ]],
  ['II. Fewer things', [
    'Around the same time I began giving things away. Not in a single dramatic sweep, but a little each week: a jacket I never liked, a stack of magazines, a second set of plates. Each time the flat felt lighter in a way that was hard to explain.',
    'Space, it turns out, is not empty. It is room for attention. With fewer objects competing for it, the ones that stayed seemed better: the good knife, the chair by the window, the mug with the chipped handle.',
  ]],
  ['III. What remains', [
    'I still keep too much, and I still sleep badly some weeks. But I have learned to trust the quiet hour, and to make a little of it during the day: a page read slowly, a window left open, a walk with no errand.',
    'What remains, when you take things away, is usually what mattered. It was there the whole time. It just needed some space around it.',
  ]],
]
const PAPERS = { Light: ['#fbfaf7', '#1f1f1f', '#6b6b6b'], Sepia: ['#f3ead8', '#3a2f22', '#6e5f4b'], Dark: ['#161616', '#e8e6e1', '#a3a19c'] }

export default function MinReader({ title = 'The Quiet Hour', author = 'June Halden', style }) {
  const scroller = useRef(null)
  const last = useRef(0)
  const [bar, setBar] = useState(false)
  const [progress, setProgress] = useState(0)
  const [chapter, setChapter] = useState(0)
  const [toc, setToc] = useState(false)
  const [size, setSize] = useState(17)
  const [paper, setPaper] = useState('Light')
  const [bg, ink, muted] = PAPERS[paper]

  const onScroll = () => {
    const el = scroller.current
    const y = el.scrollTop
    // show the pill when scrolling up, hide it when scrolling down or at the top
    if (y < 40) setBar(false)
    else if (y < last.current - 2) setBar(true)
    else if (y > last.current + 2) setBar(false)
    last.current = y
    setProgress(Math.min(1, y / Math.max(1, el.scrollHeight - el.clientHeight)))
    const heads = [...el.querySelectorAll('h2')]
    // the chapter whose heading has passed 40% of the way down the view (or the last one at the end)
    const atEnd = y >= el.scrollHeight - el.clientHeight - 4
    const i = atEnd ? heads.length - 1 : heads.findLastIndex((h) => h.offsetTop <= y + el.clientHeight * 0.4)
    setChapter(Math.max(0, i))
  }
  const goTo = (i) => {
    const h = scroller.current.querySelectorAll('h2')[i]
    scroller.current.scrollTo({ top: h.offsetTop - 40, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    setToc(false)
  }

  return (
    <div className="mr-wrap" style={{ '--bg': bg, '--ink': ink, '--muted': muted, '--size': `${size}px`, ...style }}>
      <style>{`
        .mr-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--bg); color: var(--ink); transition: background 250ms, color 250ms; }
        :where(.mr-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .mr-scroll { position: absolute; inset: 0; overflow: auto; outline: none; }
        .mr-page { max-width: 65ch; margin: 0 auto; padding: 64px 28px 120px; font: 400 var(--size)/1.7 Georgia, 'Iowan Old Style', 'Times New Roman', serif; }
        .mr-page h1, .mr-page h2, .mr-toc h3 { font-family: inherit; }
        .mr-page header { text-align: center; margin-bottom: 56px; }
        .mr-page h1 { margin: 0; font-weight: 400; font-size: 1.9em; letter-spacing: -0.01em; }
        .mr-page header p { margin: 8px 0 0; color: var(--muted); font-variant: small-caps; letter-spacing: .08em; }
        .mr-page h2 { margin: 56px 0 18px; font-weight: 400; font-size: 1em; font-variant: small-caps; letter-spacing: .1em; color: var(--muted); text-align: center; }
        .mr-page p { margin: 0 0 1.1em; }
        .mr-end { text-align: center; color: var(--muted); margin-top: 48px; }
        .mr-bar { position: absolute; left: 50%; top: 12px; transform: translate(-50%, -150%); display: flex; align-items: center; gap: 14px; padding: 7px 14px; border-radius: 999px; background: var(--bg); box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 14%, transparent); font: 400 13px/1 Georgia, serif; font-variant: small-caps; letter-spacing: .06em; transition: transform 250ms ease; white-space: nowrap; z-index: 2; }
        .mr-bar.show, .mr-bar:focus-within { transform: translate(-50%, 0); }
        .mr-bar span { color: var(--muted); }
        .mr-line { position: absolute; left: 0; top: 0; height: 2px; background: var(--ink); z-index: 3; }
        .mr-ctrl { position: absolute; right: 14px; bottom: 12px; display: flex; gap: 14px; font: 400 13px/1 Georgia, serif; font-variant: small-caps; letter-spacing: .06em; color: var(--muted); z-index: 2; }
        .mr-ctrl button:hover, .mr-ctrl button[aria-pressed='true'] { color: var(--ink); text-decoration: underline; text-underline-offset: 4px; }
        .mr-toc { position: absolute; top: 0; left: 0; bottom: 0; width: min(280px, 85%); background: var(--bg); box-shadow: 1px 0 0 color-mix(in srgb, var(--ink) 14%, transparent); padding: 56px 24px; transform: translateX(-102%); transition: transform 250ms ease; z-index: 4; font: 400 15px/1.5 Georgia, serif; }
        .mr-toc.open { transform: none; }
        .mr-toc h3 { margin: 0 0 16px; font-weight: 400; font-variant: small-caps; letter-spacing: .1em; color: var(--muted); font-size: 13px; }
        .mr-toc button { display: block; padding: 8px 0; text-align: left; }
        .mr-toc button[aria-current='true'] { text-decoration: underline; text-underline-offset: 4px; }
        @media (prefers-reduced-motion: reduce) { .mr-bar, .mr-toc, .mr-wrap { transition: none; } }
      `}</style>

      <div className="mr-line" style={{ width: `${progress * 100}%` }} aria-hidden="true" />
      <div className={`mr-bar${bar ? ' show' : ''}`}>
        <button onClick={() => setToc(true)} aria-expanded={toc}>Contents</button>
        <span>{BOOK[chapter][0]}</span>
        <span aria-label={`${Math.round(progress * 100)} percent read`}>{Math.round(progress * 100)}%</span>
      </div>

      <div ref={scroller} className="mr-scroll" onScroll={onScroll} tabIndex={0} role="region" aria-label={title}>
        <article className="mr-page">
          <header><h1>{title}</h1><p>{author}</p></header>
          {BOOK.map(([h, ps]) => (
            <section key={h}>
              <h2>{h}</h2>
              {ps.map((p, i) => <p key={i}>{p}</p>)}
            </section>
          ))}
          <p className="mr-end">~</p>
        </article>
      </div>

      <aside className={`mr-toc${toc ? ' open' : ''}`} aria-hidden={!toc}>
        <h3>Contents</h3>
        {BOOK.map(([h], i) => <button key={h} tabIndex={toc ? 0 : -1} aria-current={i === chapter} onClick={() => goTo(i)}>{h}</button>)}
        <button tabIndex={toc ? 0 : -1} onClick={() => setToc(false)} style={{ marginTop: 24, color: 'var(--muted)' }}>Close</button>
      </aside>

      <div className="mr-ctrl">
        <button onClick={() => setToc(true)} aria-label="Open contents">Contents</button>
        <button onClick={() => setSize(Math.max(14, size - 1))} aria-label="Smaller text">A−</button>
        <button onClick={() => setSize(Math.min(22, size + 1))} aria-label="Larger text">A+</button>
        {Object.keys(PAPERS).map((k) => <button key={k} aria-pressed={k === paper} onClick={() => setPaper(k)}>{k}</button>)}
      </div>
    </div>
  )
}
