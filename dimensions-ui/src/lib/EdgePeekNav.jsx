import { useState } from 'react'

// Edge hover: moving the pointer to the edge of the area peeks a hidden nav
// (a strip of just its icons); moving onto it widens it to show the labels,
// and leaving tucks it away again. On touch, tap the edge tab. Keyboard: the
// tab is a button. The peek is a clip on the nav, not a slide, so the strip
// that shows is always the icon column.

const NAV = [
  ['Home', 'M3 10l7-6 7 6v7H3z'],
  ['Library', 'M4 4h5v12H4zM11 4h5v12h-5z'],
  ['Saved', 'M6 3h8v14l-4-3-4 3z'],
  ['Settings', 'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18'],
]

export default function EdgePeekNav({ side = 'left', edge = 28, peek = 56, width = 220, accent = '#ff4d1a', children, style }) {
  const [state, setState] = useState('hidden') // hidden | peek | open
  const [active, setActive] = useState(0)
  const right = side === 'right'

  const onMove = (e) => {
    if (e.pointerType !== 'mouse' || state === 'open') return
    // moves over the nav itself bubble up here too; the nav opens itself on enter
    if (e.target.closest?.('.ep-nav')) return
    const r = e.currentTarget.getBoundingClientRect()
    const d = right ? r.right - e.clientX : e.clientX - r.left
    setState(d < edge ? 'peek' : 'hidden')
  }

  // hidden: slid out past the edge; peek: in place, clipped to the icon strip; open: all of it
  const offset = state === 'hidden' ? width + 24 : 0
  const cut = state === 'open' ? 0 : width - peek
  const clip = right ? `inset(0 0 0 ${cut}px round 14px)` : `inset(0 ${cut}px 0 0 round 14px)`

  return (
    <div
      onPointerMove={onMove}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setState('hidden')}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f4f1ea', font: '400 14px/1.4 system-ui, sans-serif', userSelect: 'none', WebkitUserSelect: 'none', ...style }}
    >
      <style>{`
        .ep-nav { position: absolute; top: 12px; bottom: 12px; z-index: 2; background: #1c1a16; color: #f4f1ea; border-radius: 14px; padding: 14px 10px; display: flex; flex-direction: column; gap: 4px; transition: transform 320ms cubic-bezier(.2,.8,.2,1), clip-path 320ms cubic-bezier(.2,.8,.2,1); }
        .ep-nav button { all: unset; display: flex; align-items: center; gap: 14px; padding: 10px 12px; border-radius: 9px; cursor: pointer; white-space: nowrap; }
        .ep-nav button:hover, .ep-nav button:focus-visible { background: rgba(255,255,255,.08); }
        .ep-nav button[aria-current='page'] { background: ${accent}; color: #1c1a16; }
        .ep-nav svg { flex: none; }
        .ep-tab { all: unset; position: absolute; top: 50%; width: 18px; height: 64px; margin-top: -32px; border-radius: 9px; background: #1c1a16; cursor: pointer; z-index: 1; transition: opacity 200ms; }
        .ep-tab::after { content: ''; position: absolute; left: 50%; top: 50%; width: 3px; height: 22px; margin: -11px 0 0 -1.5px; border-radius: 2px; background: #f4f1ea; opacity: .5; }
        .ep-tab:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }
        .ep-nav button span { transition: opacity 200ms; }
        @media (prefers-reduced-motion: reduce) { .ep-nav, .ep-nav button span { transition: none; } }
      `}</style>

      <button
        className="ep-tab"
        aria-label="Open navigation"
        aria-expanded={state === 'open'}
        onClick={() => setState((s) => (s === 'open' ? 'hidden' : 'open'))}
        style={{ [right ? 'right' : 'left']: -9, opacity: state === 'hidden' ? 1 : 0 }}
      />

      <nav
        className="ep-nav"
        aria-label="Main"
        onPointerEnter={() => setState('open')}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setState('hidden')}
        style={{ [right ? 'right' : 'left']: 12, width, transform: `translateX(${right ? offset : -offset}px)`, clipPath: clip, WebkitClipPath: clip }}
      >
        {NAV.map(([label, d], i) => (
          <button
            key={label}
            aria-current={i === active ? 'page' : undefined}
            onClick={() => { setActive(i); setState('hidden') }}
            onFocus={() => setState('open')}
            style={{ flexDirection: right ? 'row-reverse' : 'row' }}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
            <span style={{ opacity: state === 'open' ? 1 : 0 }}>{label}</span>
          </button>
        ))}
      </nav>

      {children ?? (
        <div style={{ height: '100%', display: 'grid', placeContent: 'center', textAlign: 'center', color: '#6b665c', gap: 6, padding: 24 }}>
          <b style={{ font: '400 30px/1.1 Georgia, serif', color: '#1c1a16' }}>{NAV[active][0]}</b>
          <span>Move to the {side} edge to peek the menu.</span>
        </div>
      )}
    </div>
  )
}
