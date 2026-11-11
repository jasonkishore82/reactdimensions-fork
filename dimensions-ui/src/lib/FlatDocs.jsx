import { useState } from 'react'

// Flat UI documentation page: plain white pages, one accent colour for links
// and code highlights, a sidebar where the active page gets an accent bar, a
// segmented control that switches the code sample's framework, and small
// outlined Copy / Edit buttons.

const NAV = [
  ['Getting started', ['Introduction', 'Installation', 'Quick start']],
  ['Components', ['Button', 'Card', 'Dialog', 'Tabs']],
  ['Guides', ['Theming', 'Dark mode']],
]

const FRAMEWORKS = ['React', 'Vue', 'Svelte']

const CODE = {
  React: [
    ['k', 'import'], ['t', ' { Button } '], ['k', 'from'], ['s', " 'flatkit/react'"], ['t', '\n\n'],
    ['k', 'export default function'], ['t', ' App() {\n  '], ['k', 'return'], ['t', ' <Button variant='], ['s', '"solid"'], ['t', '>Save</Button>\n}'],
  ],
  Vue: [
    ['t', '<script setup>\n'], ['k', 'import'], ['t', ' { Button } '], ['k', 'from'], ['s', " 'flatkit/vue'"], ['t', '\n</script>\n\n<template>\n  <Button variant='], ['s', '"solid"'], ['t', '>Save</Button>\n</template>'],
  ],
  Svelte: [
    ['t', '<script>\n  '], ['k', 'import'], ['t', ' { Button } '], ['k', 'from'], ['s', " 'flatkit/svelte'"], ['t', '\n</script>\n\n<Button variant='], ['s', '"solid"'], ['t', '>Save</Button>'],
  ],
}

const plain = (fw) => CODE[fw].map(([, t]) => t).join('')

export default function FlatDocs({ accent = '#2563eb', codeTheme = 'light', showSidebar = true, style }) {
  const [page, setPage] = useState('Installation')
  const [fw, setFw] = useState('React')
  const [copied, setCopied] = useState(false)
  const dark = codeTheme === 'dark'

  const copy = () => {
    navigator.clipboard?.writeText(plain(fw)).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className={`fdoc${showSidebar ? '' : ' fdoc-noside'}`} style={{ '--accent': accent, ...style }}>
      <style>{`
        .fdoc { container-type: inline-size; display: grid; grid-template-rows: auto 1fr; width: 100%; height: 100%; background: #fff; color: #1f2328; font: 400 13.5px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif; overflow: hidden; }
        .fdoc * { box-sizing: border-box; }
        .fdoc button { font: inherit; cursor: pointer; }
        .fdoc-top { display: flex; align-items: center; gap: 14px; padding: 10px 20px; border-bottom: 1px solid #e5e7eb; }
        .fdoc-top b { font-weight: 800; font-size: 15px; }
        .fdoc-top b i { font-style: normal; color: var(--accent); }
        .fdoc-ver { font: 600 11px/1 ui-monospace, Menlo, monospace; color: var(--accent); border: 1px solid var(--accent); padding: 3px 6px; border-radius: 4px; }
        .fdoc-search { margin-left: auto; width: 200px; max-width: 40%; background: #f3f4f6; border: 0; border-radius: 6px; padding: 7px 10px; color: #6b7280; font-size: 12.5px; }
        .fdoc-body { display: grid; grid-template-columns: 190px 1fr; min-height: 0; }
        .fdoc-noside .fdoc-body { grid-template-columns: 1fr; }
        .fdoc-noside .fdoc-side { display: none; }
        .fdoc-side { padding: 16px 12px 16px 20px; border-right: 1px solid #e5e7eb; overflow: auto; }
        .fdoc-side h4 { margin: 0 0 4px; font-size: 11px; letter-spacing: .07em; text-transform: uppercase; color: #6b7280; }
        .fdoc-side ul { list-style: none; margin: 0 0 14px; padding: 0; }
        .fdoc-link { display: block; width: 100%; text-align: left; border: 0; background: none; color: #374151; padding: 4px 10px; border-left: 2px solid #e5e7eb; }
        .fdoc-link:hover { color: #111827; }
        .fdoc-link[aria-current='page'] { color: var(--accent); border-left: 3px solid var(--accent); padding-left: 9px; font-weight: 600; }
        .fdoc-page { padding: 18px 28px; overflow: auto; }
        .fdoc-crumb { color: #6b7280; font-size: 12px; }
        .fdoc-page h1 { margin: 2px 0 6px; font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
        .fdoc-page p { margin: 0 0 12px; color: #4b5563; max-width: 62ch; }
        .fdoc-page a { color: var(--accent); font-weight: 600; text-decoration: none; }
        .fdoc-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
        .fdoc-seg { display: inline-flex; background: #f3f4f6; border-radius: 6px; padding: 3px; }
        .fdoc-seg button { border: 0; background: none; color: #4b5563; font-weight: 600; padding: 5px 12px; border-radius: 4px; }
        .fdoc-seg button[aria-selected='true'] { background: var(--accent); color: #fff; }
        .fdoc-actions { display: flex; gap: 6px; }
        .fdoc-btn { border: 1.5px solid var(--accent); background: #fff; color: var(--accent); font-weight: 600; font-size: 12px; padding: 4px 10px; border-radius: 5px; }
        .fdoc-btn:hover { background: color-mix(in srgb, var(--accent) 8%, #fff); }
        .fdoc-code { margin: 0; padding: 14px 16px; border-radius: 6px; font: 12.5px/1.6 ui-monospace, Menlo, monospace; white-space: pre; overflow: auto; background: #f6f8fa; color: #1f2328; }
        .fdoc-code.dark { background: #161b22; color: #e6edf3; }
        .fdoc-code .k { color: var(--accent); font-weight: 600; }
        .fdoc-code.dark .k { color: color-mix(in srgb, var(--accent), white 35%); }
        .fdoc-code .s { color: #0f7b45; }
        .fdoc-code.dark .s { color: #7ee2a8; }
        @container (max-width: 620px) { .fdoc-body { grid-template-columns: 1fr; } .fdoc-side { display: none; } .fdoc-search { display: none; } .fdoc-page { padding: 16px; } }
      `}</style>

      <header className="fdoc-top">
        <b>flat<i>kit</i></b>
        <span className="fdoc-ver">v2.4</span>
        <input className="fdoc-search" placeholder="Search docs…" aria-label="Search docs" />
      </header>

      <div className="fdoc-body">
        <nav className="fdoc-side" aria-label="Docs">
          {NAV.map(([group, pages]) => (
            <div key={group}>
              <h4>{group}</h4>
              <ul>
                {pages.map((pg) => (
                  <li key={pg}>
                    <button className="fdoc-link" aria-current={pg === page ? 'page' : undefined} onClick={() => setPage(pg)}>{pg}</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <article className="fdoc-page">
          <div className="fdoc-crumb">Docs / {NAV.find(([, p]) => p.includes(page))[0]}</div>
          <h1>{page}</h1>
          <p>
            Add flatkit to your project, then import the components you need. Every component works the same way in each
            framework. See <a href="#theming" onClick={(e) => { e.preventDefault(); setPage('Theming') }}>Theming</a> to change the accent colour.
          </p>

          <div className="fdoc-bar">
            <div className="fdoc-seg" role="tablist" aria-label="Framework">
              {FRAMEWORKS.map((f) => (
                <button key={f} role="tab" aria-selected={f === fw} onClick={() => setFw(f)}>{f}</button>
              ))}
            </div>
            <div className="fdoc-actions">
              <button className="fdoc-btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
              <button className="fdoc-btn">Edit on GitHub</button>
            </div>
          </div>

          <pre className={`fdoc-code${dark ? ' dark' : ''}`}>
            {CODE[fw].map(([kind, text], i) => (kind === 't' ? text : <span key={i} className={kind}>{text}</span>))}
          </pre>
        </article>
      </div>
    </div>
  )
}
