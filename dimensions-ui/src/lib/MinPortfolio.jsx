import { useState } from 'react'

// Minimal portfolio: large images with thin captions, a monochrome palette
// and one sans-serif face. The name sits left, three text links right;
// links are underlined text, not buttons. "Index" swaps the gallery for a
// plain list, and a project opens on its own quiet page.

const WORK = [
  { title: 'Salt House', kind: 'Architecture', year: 2026, art: ['#e9e7e2', '#cfccc4', '#2b2b2b'], text: 'A coastal house photographed over one winter week. Concrete, salt air and very little else.' },
  { title: 'Paper Studies', kind: 'Still life', year: 2025, art: ['#f1f0ec', '#1f1f1f', '#bdb9b0'], text: 'Folded paper under a single north light. An exercise in shadow and patience.' },
  { title: 'Lisbon, 6 a.m.', kind: 'Street', year: 2025, art: ['#d9d6cf', '#8a867d', '#f7f6f2'], text: 'Empty streets before the trams start. Shot on foot, without a plan.' },
  { title: 'Chair No. 4', kind: 'Product', year: 2024, art: ['#ecebe7', '#3a3a3a', '#a9a59c'], text: 'A catalogue for a small furniture workshop. One chair, many angles.' },
]
const LINKS = ['Work', 'About', 'Contact']

function Art({ art, i }) {
  const [a, b, c] = art
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="300" fill={a} />
      {i % 4 === 0 && <><rect x="60" y="120" width="280" height="140" fill={b} /><rect x="60" y="100" width="280" height="20" fill={c} /><rect x="250" y="160" width="40" height="100" fill={a} /></>}
      {i % 4 === 1 && <><path d="M80 220 L200 70 L320 220 Z" fill={c} /><path d="M200 70 L320 220 L230 220 Z" fill={b} /></>}
      {i % 4 === 2 && <><rect x="0" y="210" width="400" height="90" fill={b} />{[40, 120, 200, 280].map((x) => <rect key={x} x={x} y={90} width="50" height="120" fill={c} />)}</>}
      {i % 4 === 3 && <><rect x="150" y="80" width="100" height="90" fill={b} /><rect x="150" y="170" width="100" height="16" fill={b} /><rect x="156" y="186" width="8" height="70" fill={b} /><rect x="236" y="186" width="8" height="70" fill={b} /></>}
    </svg>
  )
}

export default function MinPortfolio({ name = 'Ines Moreau', role = 'Photographer, Lisbon', style }) {
  const [link, setLink] = useState('Work')
  const [index, setIndex] = useState(false)
  const [open, setOpen] = useState(null)

  return (
    <div className="mpf-wrap" style={style}>
      <style>{`
        .mpf-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: #fff; color: #111; font: 400 14px/1.5 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        :where(.mpf-wrap) button, :where(.mpf-wrap) a { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: none; }
        .mpf-top { display: flex; justify-content: space-between; align-items: baseline; padding: 28px 40px; }
        .mpf-top b { font-weight: 500; }
        .mpf-top nav { display: flex; gap: 24px; }
        .mpf-link { color: #555; }
        .mpf-link:hover, .mpf-link[aria-current='page'] { color: #111; text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 1px; }
        .mpf-bar { display: flex; justify-content: space-between; padding: 0 40px 16px; color: #555; }
        .mpf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px 32px; padding: 8px 40px 64px; }
        .mpf-card { text-align: left; }
        .mpf-card svg { display: block; width: 100%; aspect-ratio: 4 / 3; transition: opacity 200ms; }
        .mpf-card:hover svg { opacity: .88; }
        .mpf-cap { display: flex; justify-content: space-between; margin-top: 10px; font-size: 13px; }
        .mpf-cap span { color: #555; }
        .mpf-index { list-style: none; margin: 0; padding: 8px 40px 64px; }
        .mpf-index button { display: grid; grid-template-columns: 1fr 1fr 60px; width: 100%; padding: 14px 0; border-bottom: 1px solid #e6e6e6; text-align: left; }
        .mpf-index button:hover .mpf-t { text-decoration: underline; text-underline-offset: 4px; }
        .mpf-index span { color: #555; }
        .mpf-detail { padding: 8px 40px 64px; max-width: 760px; }
        .mpf-detail svg { display: block; width: 100%; aspect-ratio: 16 / 9; margin: 16px 0 20px; }
        .mpf-detail h1 { margin: 0; font-size: 22px; font-weight: 500; }
        .mpf-detail p { max-width: 52ch; color: #333; }
        .mpf-about { padding: 24px 40px 64px; max-width: 52ch; font-size: 18px; line-height: 1.55; }
        @container (max-width: 600px) { .mpf-grid { grid-template-columns: 1fr; } .mpf-top, .mpf-bar, .mpf-grid, .mpf-index, .mpf-detail, .mpf-about { padding-left: 20px; padding-right: 20px; } .mpf-top { flex-wrap: wrap; gap: 8px; } }
        @media (prefers-reduced-motion: reduce) { .mpf-card svg { transition: none; } }
      `}</style>

      <header className="mpf-top">
        <b>{name}</b>
        <nav aria-label="Main">
          {LINKS.map((l) => <a key={l} href={`#${l}`} className="mpf-link" aria-current={l === link ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setLink(l); setOpen(null) }}>{l}</a>)}
        </nav>
      </header>

      {link === 'Work' && open === null && (
        <>
          <div className="mpf-bar">
            <span>{role}</span>
            <a href="#index" className="mpf-link" aria-pressed={index} role="button" onClick={(e) => { e.preventDefault(); setIndex(!index) }}>{index ? 'Gallery' : 'Index'}</a>
          </div>
          {index ? (
            <ul className="mpf-index">
              {WORK.map((w, i) => <li key={w.title}><button onClick={() => setOpen(i)}><span className="mpf-t">{w.title}</span><span>{w.kind}</span><span>{w.year}</span></button></li>)}
            </ul>
          ) : (
            <div className="mpf-grid">
              {WORK.map((w, i) => (
                <button key={w.title} className="mpf-card" onClick={() => setOpen(i)} aria-label={`${w.title}, ${w.kind}, ${w.year}`}>
                  <Art art={w.art} i={i} />
                  <span className="mpf-cap"><b style={{ fontWeight: 400 }}>{w.title}</b><span>{w.year}</span></span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {link === 'Work' && open !== null && (
        <article className="mpf-detail">
          <a href="#back" className="mpf-link" onClick={(e) => { e.preventDefault(); setOpen(null) }}>← All work</a>
          <Art art={WORK[open].art} i={open} />
          <h1>{WORK[open].title}</h1>
          <p style={{ color: '#555', margin: '4px 0 16px' }}>{WORK[open].kind}, {WORK[open].year}</p>
          <p>{WORK[open].text}</p>
          <a href="#next" className="mpf-link" onClick={(e) => { e.preventDefault(); setOpen((open + 1) % WORK.length) }}>Next project →</a>
        </article>
      )}

      {link === 'About' && <p className="mpf-about">I photograph buildings, objects and quiet streets, mostly in natural light. Based in Lisbon, working anywhere.</p>}
      {link === 'Contact' && <p className="mpf-about">For commissions: <a className="mpf-link" href="#mail" onClick={(e) => e.preventDefault()} style={{ textDecoration: 'underline', textUnderlineOffset: 4 }}>hello@inesmoreau.studio</a></p>}
    </div>
  )
}
