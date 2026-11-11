import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { CATEGORIES, COMPONENTS, defaultsFor, sourceFor, usageFor, valueControls } from './registry.jsx'
import { highlight } from './highlight.js'
import { markdownFor, promptFor, sourceText, typesFor } from './ai.js'
import { Icon } from '../Nav.jsx'
import './library.css'

const CAT_ICON = {
  All: <path d="M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z" />,
  Text: <path d="M4 5.5V4h12v1.5M10 4v12M7.5 16h5" />,
  Interactions: <path d="m5 3.5 9 5.2-3.9 1.2 2.4 4.1-1.8 1-2.4-4.1-2.7 2.9z" />,
  '3D & Materials': <path d="M10 2.5 16.5 6v8L10 17.5 3.5 14V6zM10 10 3.5 6M10 10l6.5-4M10 10v7.5" />,
  Annotations: <path d="M3 13.500 13.500 3l3.500 3.500L6.500 17H3zM10.500 5.500l3.5 3.5M7 9.5l1.5 1.5M9.5 7l1.5 1.5" />,
  Backgrounds: <path d="M3.500 3.500h13v13h-13zM3.500 8h13M3.500 12h13M8 3.500v13M12 3.500v13" />,
}

const PM = { npm: 'npm i', pnpm: 'pnpm add', yarn: 'yarn add', bun: 'bun add' }
const WIDTHS = { desktop: '100%', tablet: '768px', mobile: '390px' }

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="lib-copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {})
        setDone(true)
        setTimeout(() => setDone(false), 1400)
      }}
    >
      {done ? 'Copied' : label}
    </button>
  )
}

function CodeBlock({ title, code }) {
  const html = useMemo(() => highlight(code), [code])
  return (
    <div className="lib-code">
      <div className="lib-code-bar">
        <span>{title}</span>
        <CopyButton text={code} />
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}

function Control({ c, value, onChange, onPatch, current }) {
  const id = `ctl-${c.name}`
  if (c.type === 'presets') {
    return (
      <div className="ctl ctl-presets">
        <span className="ctl-name">{c.name}</span>
        <div className="presets" role="group" aria-label={c.name}>
          {c.options.map((o) => {
            const on = Object.entries(o.values).every(([k, v]) => String(current[k]).toLowerCase() === String(v).toLowerCase())
            return (
              <button key={o.name} className={on ? 'on' : ''} onClick={() => onPatch(o.values)} aria-pressed={on}>
                <span className="dots">
                  {Object.values(o.values)
                    .filter((v) => /^#/.test(v))
                    .slice(0, 3)
                    .map((v, i) => (
                      <i key={i} style={{ background: v }} />
                    ))}
                </span>
                {o.name}
              </button>
            )
          })}
        </div>
      </div>
    )
  }
  if (c.type === 'toggle') {
    return (
      <label className="ctl ctl-toggle" htmlFor={id}>
        <span className="ctl-name">{c.name}</span>
        <input id={id} type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch" aria-hidden="true" />
      </label>
    )
  }
  if (c.type === 'select') {
    return (
      <div className="ctl">
        <label className="ctl-name" htmlFor={id}>
          {c.name}
        </label>
        <div className="seg" role="radiogroup" aria-label={c.name}>
          {c.options.map((o) => (
            <button key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>
              {o}
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (c.type === 'text') {
    return (
      <div className="ctl">
        <label className="ctl-name" htmlFor={id}>
          {c.name}
        </label>
        <input id={id} className="ctl-text" value={value} maxLength={32} onChange={(e) => onChange(e.target.value)} />
      </div>
    )
  }
  if (c.type === 'color') {
    return (
      <label className="ctl ctl-color" htmlFor={id}>
        <span className="ctl-name">{c.name}</span>
        <span className="ctl-color-val">{value}</span>
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    )
  }
  return (
    <div className="ctl">
      <label className="ctl-name" htmlFor={id}>
        {c.name}
        <span className="ctl-val">
          {value}
          {c.unit || ''}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={c.min}
        max={c.max}
        step={c.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--p': `${((value - c.min) / (c.max - c.min)) * 100}%` }}
      />
    </div>
  )
}


// Favourites live in localStorage and are shared by the sidebar and the toolbar.
const FAV_KEY = 'rd-favs'
function readFavs() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]')
  } catch {
    return []
  }
}
function useFavs() {
  const [favs, setFavs] = useState(readFavs)
  useEffect(() => {
    const on = () => setFavs(readFavs())
    window.addEventListener('rd:favs', on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener('rd:favs', on)
      window.removeEventListener('storage', on)
    }
  }, [])
  const toggle = (slug) => {
    const next = favs.includes(slug) ? favs.filter((x) => x !== slug) : [...favs, slug]
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next))
    } catch {}
    setFavs(next)
    window.dispatchEvent(new Event('rd:favs'))
  }
  return [favs, toggle]
}

// "Copy for AI": prompt, Markdown or plain source, ready to paste into an assistant.
function AiMenu({ comp, props }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState('')
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const on = (e) => !box.current?.contains(e.target) && setOpen(false)
    const key = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', on)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', on)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  const copy = (label, text) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setDone(label)
    setOpen(false)
    setTimeout(() => setDone(''), 1800)
  }
  return (
    <div className="ai-menu" ref={box}>
      <button className="tool-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {done ? `✓ ${done}` : '✦ Copy for AI ▾'}
      </button>
      {open && (
        <div className="ai-pop" role="menu">
          <button role="menuitem" onClick={() => copy('Prompt copied', promptFor(comp, props))}>
            <strong>Copy as prompt</strong>
            <small>Description, props, usage and source, ready to paste into an assistant</small>
          </button>
          <button role="menuitem" onClick={() => copy('Markdown copied', markdownFor(comp, props))}>
            <strong>Copy as Markdown</strong>
            <small>This page as a .md document</small>
          </button>
          <button role="menuitem" onClick={() => copy('Source copied', sourceText(comp))}>
            <strong>Copy source only</strong>
            <small>{comp.files.length} file{comp.files.length > 1 ? 's' : ''}, with file names as comments</small>
          </button>
        </div>
      )}
    </div>
  )
}

function Section({ id, title, note, actions, children }) {
  return (
    <section className="lib-section" id={id}>
      <header>
        <h2>
          {title}
          {note && <small>{note}</small>}
        </h2>
        {actions}
      </header>
      {children}
    </section>
  )
}

function Sidebar({ active, open, onClose, favs }) {
  const [hover, setHover] = useState(null)
  const [cat, setCat] = useState('All')
  const [query, setQuery] = useState('')
  const [edge, setEdge] = useState({ top: true, bottom: false })
  const scroller = useRef(null)
  const search = useRef(null)
  const tabs = ['All', ...CATEGORIES]
  const q = query.trim().toLowerCase()
  const catMatch = cat === 'All' ? CATEGORIES : [cat]
  const visible = CATEGORIES.map((c) => ({
    name: c,
    items: COMPONENTS.filter((x) => x.category === c && catMatch.includes(c) && (!q || x.name.toLowerCase().includes(q) || c.toLowerCase().includes(q))),
  })).filter((g) => g.items.length)
  // favourites float to the top when browsing everything
  if (!q && cat === 'All') {
    const fav = COMPONENTS.filter((x) => favs.includes(x.slug))
    if (fav.length) visible.unshift({ name: 'Favourites', items: fav, fav: true })
  }

  const showHover = (c, el) => {
    if (window.matchMedia('(max-width: 900px)').matches) return
    const r = el.getBoundingClientRect()
    const side = el.closest('.lib-side').getBoundingClientRect()
    const h = 276
    setHover({ c, top: Math.min(Math.max(r.top - 8, 72), window.innerHeight - h - 12), left: side.right + 12 })
  }

  const measure = () => {
    const el = scroller.current
    if (el) setEdge({ top: el.scrollTop < 6, bottom: el.scrollTop + el.clientHeight > el.scrollHeight - 6 })
  }
  useEffect(measure, [cat, query])
  // keep the current page in view in the list
  useEffect(() => {
    scroller.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <>
      <div className={`lib-backdrop${open ? ' show' : ''}`} onClick={onClose} />
      <aside className={`lib-side${open ? ' open' : ''}`} aria-label="Components">
        <div className="lib-side-top">
          <div className="cat-picker" role="tablist" aria-label="Category" style={{ '--n': tabs.length, '--i': tabs.indexOf(cat) }}>
            <span className="pill-bg" aria-hidden="true" />
            {tabs.map((t) => (
              <button key={t} role="tab" aria-selected={cat === t} aria-label={t} title={t} onClick={() => setCat(t)}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {CAT_ICON[t]}
                </svg>
              </button>
            ))}
          </div>
          <div className="lib-filter">
            {Icon.search}
            <input ref={search} placeholder={`Filter ${COMPONENTS.length} components…`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter components" />
          </div>
        </div>
        <nav className={`lib-list${edge.top ? ' at-top' : ''}${edge.bottom ? ' at-bottom' : ''}`} ref={scroller} onScroll={measure}>
          {visible.map((g) => (
            <div className={`lib-cat${g.fav ? ' favs' : ''}`} key={g.name}>
              <h4>{g.fav ? '★ ' : ''}{g.name}</h4>
              {g.items.map((c) => (
                <Link
                  key={c.slug}
                  to={`/library/${c.slug}`}
                  className={c.slug === active ? 'active' : ''}
                  onClick={onClose}
                  onMouseEnter={(e) => showHover(c, e.currentTarget)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={(e) => showHover(c, e.currentTarget)}
                  onBlur={() => setHover(null)}
                >
                  {c.name}
                  {c.isNew && <span className="badge">New</span>}
                </Link>
              ))}
            </div>
          ))}
          {!visible.length && <p className="lib-none">No matching components</p>}
        </nav>
      </aside>
      {hover && (
        <div className="hover-card" style={{ top: hover.top, left: hover.left }} aria-hidden="true">
          <img src={`/previews/${hover.c.slug}.jpg`} alt="" />
          <div>
            <strong>{hover.c.name}</strong>
            <small>{hover.c.category}</small>
          </div>
        </div>
      )}
    </>
  )
}

export default function Library() {
  const { slug } = useParams()
  const index = COMPONENTS.findIndex((c) => c.slug === slug)
  const comp = COMPONENTS[index]
  const [tab, setTab] = useState('preview')
  const [values, setValues] = useState(() => (comp ? defaultsFor(comp) : {}))
  const [reload, setReload] = useState(0)
  const [width, setWidth] = useState('desktop')
  const [pm, setPm] = useState('npm')
  const [drawer, setDrawer] = useState(false)
  const [spy, setSpy] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [favs, toggleFav] = useFavs()
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem('rd-lang') || 'js'
    } catch {
      return 'js'
    }
  })
  const setLang = (l) => {
    setLangState(l)
    try {
      localStorage.setItem('rd-lang', l)
    } catch {}
  }

  useEffect(() => {
    if (!comp) return
    setValues(defaultsFor(comp))
    setTab('preview')
    setReload(0)
    setWidth('desktop')
    setDrawer(false)
    document.title = `${comp.name} — React Dimensions`
    window.scrollTo({ top: 0 })
  }, [slug])

  // the header's menu button opens the component list on small screens
  useEffect(() => {
    const on = () => setDrawer((d) => !d)
    window.addEventListener('rd:sidebar', on)
    return () => window.removeEventListener('rd:sidebar', on)
  }, [])

  // highlight the section being read in "On this page"
  useEffect(() => {
    const ids = tab === 'preview' ? ['preview', 'customize', 'props', 'dependencies'] : ['install', 'usage', 'types', 'source']
    setSpy(ids[0])
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (hit) setSpy(hit.target.id)
      },
      { rootMargin: '-90px 0px -60% 0px' },
    )
    ids.forEach((id) => document.getElementById(id) && io.observe(document.getElementById(id)))
    return () => io.disconnect()
  }, [tab, slug])

  if (!comp) return <Navigate to={`/library/${COMPONENTS[0].slug}`} replace />

  // Values from the previous component can linger for one render after navigation.
  const props = { ...defaultsFor(comp), ...Object.fromEntries(Object.entries(values).filter(([k]) => valueControls(comp).some((c) => c.name === k))) }
  const vc = valueControls(comp)
  const prev = COMPONENTS[index - 1]
  const next = COMPONENTS[index + 1]
  const changed = vc.some((c) => props[c.name] !== c.default)
  const related = [...COMPONENTS.filter((c) => c.category === comp.category && c.slug !== slug), ...COMPONENTS.filter((c) => c.category !== comp.category && c.slug !== slug)].slice(0, 3)
  const ts = lang === 'ts'
  const isFav = favs.includes(slug)
  const toc = tab === 'preview' ? [['preview', 'Preview'], ['customize', 'Customize'], ['props', 'Props'], ['dependencies', 'Dependencies']] : [['install', 'Install'], ['usage', 'Usage'], ...(ts ? [['types', 'Types']] : []), ['source', 'Source']]
  const deps = ['react', ...comp.deps]
  const installText = `${PM[pm]} ${deps.join(' ')}` + (ts ? `\n${PM[pm]} -D typescript @types/react${comp.deps.includes('three') ? ' @types/three' : ''}` : '')
  const typeOf = (c) => (c.type === 'range' ? 'number' : c.type === 'toggle' ? 'boolean' : c.type === 'select' ? c.options.map((o) => `'${o}'`).join(' | ') : 'string')

  return (
    <div className="lib">
      <Sidebar active={slug} open={drawer} onClose={() => setDrawer(false)} favs={favs} />

      <div className="lib-main">
        <p className="lib-crumb">
          Library <span>/</span> {comp.category} <span>/</span> <b>{comp.name}</b>
        </p>
        <h1 className="lib-title">
          {comp.name}
          {comp.isNew && <span className="badge badge-lg">New</span>}
        </h1>
        <p className="lib-desc">{comp.description}</p>
        <div className="lib-meta">
          <span>{comp.category}</span>
          <span>{vc.length} props</span>
          <span>{deps.length} dependencies</span>
        </div>

        <div className="docs-toolbar">
          <div className="pillswitch" role="tablist" style={{ '--i': tab === 'preview' ? 0 : 1 }}>
            <span className="pill-bg" aria-hidden="true" />
            {['preview', 'code'].map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                {t === 'preview' ? 'Preview' : 'Code'}
              </button>
            ))}
          </div>
          <div className="tool-actions">
            {tab === 'preview' && (
              <div className="width-presets" role="group" aria-label="Preview width">
                {Object.keys(WIDTHS).map((w) => (
                  <button key={w} className={width === w ? 'on' : ''} aria-pressed={width === w} onClick={() => setWidth(w)}>
                    {w}
                  </button>
                ))}
              </div>
            )}
            <AiMenu comp={comp} props={props} />
            <button
              className={`tool-btn fav-btn${isFav ? ' on' : ''}`}
              onClick={() => toggleFav(slug)}
              aria-pressed={isFav}
              title={isFav ? 'Remove from favourites' : 'Add to favourites'}
              aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
            >
              {isFav ? '★' : '☆'}
            </button>
            <button className="tool-btn" onClick={() => setReload((n) => n + 1)} title="Reload the preview" aria-label="Reload the preview">
              ↻<span> Reload</span>
            </button>
            <button
              className="tool-btn"
              title="Copy a link to this page"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href).catch(() => {})
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 1400)
              }}
            >
              {linkCopied ? '✓ Copied' : '⎘ Link'}
            </button>
          </div>
        </div>

        {tab === 'preview' ? (
          <>
            <div className="stage-shell" id="preview">
              <div className={`lib-stage${comp.fill ? ' fill' : ''}`} style={{ maxWidth: WIDTHS[width] }}>
                <div className="lib-stage-inner" key={`${slug}-${reload}`}>
                  {comp.preview(props, (patch) => setValues((s) => ({ ...s, ...patch })))}
                </div>
              </div>
            </div>

            <Section
              id="customize"
              title="Customize"
              actions={
                changed && (
                  <button className="lib-reset" onClick={() => setValues(defaultsFor(comp))}>
                    Reset
                  </button>
                )
              }
            >
              <div className="ctl-grid">
                {comp.controls.map((c) => (
                  <Control key={c.name} c={c} value={props[c.name]} current={props} onChange={(v) => setValues((s) => ({ ...s, [c.name]: v }))} onPatch={(patch) => setValues((s) => ({ ...s, ...patch }))} />
                ))}
              </div>
            </Section>

            <Section id="props" title="Props">
              <div className="lib-table-wrap">
                <table className="lib-table">
                  <thead>
                    <tr>
                      <th>Prop</th>
                      <th>Type</th>
                      <th>Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vc.map((c) => (
                      <tr key={c.name}>
                        <td>
                          <code>{c.name}</code>
                        </td>
                        <td>{typeOf(c)}</td>
                        <td>
                          <code>{String(c.default)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="dependencies" title="Dependencies">
              <div className="dep-list">
                {deps.map((d) => (
                  <code key={d}>{d}</code>
                ))}
              </div>
            </Section>
          </>
        ) : (
          <>
            <div className="lang-row">
              <div className="seg lang-seg" role="radiogroup" aria-label="Language">
                {[['js', 'JavaScript'], ['ts', 'TypeScript']].map(([k, label]) => (
                  <button key={k} role="radio" aria-checked={lang === k} className={lang === k ? 'on' : ''} onClick={() => setLang(k)}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="lang-note">
                {ts ? 'The components are plain JSX; TypeScript projects add the types below.' : 'Styling is inline, so there is no CSS or Tailwind variant to choose.'}
              </span>
            </div>
            <Section id="install" title="Install">
              <div className="pm-tabs" role="tablist" aria-label="Package manager">
                {Object.keys(PM).map((k) => (
                  <button key={k} role="tab" aria-selected={pm === k} className={pm === k ? 'on' : ''} onClick={() => setPm(k)}>
                    {k}
                  </button>
                ))}
              </div>
              <CodeBlock title="Terminal" code={installText}
              />
            </Section>
            <Section id="usage" title="Usage" note={changed ? 'with your settings' : undefined}>
              <CodeBlock title={ts ? 'App.tsx' : 'App.jsx'} code={usageFor(comp, props)} />
            </Section>
            {ts && (
              <Section id="types" title="Types" note="props">
                <CodeBlock title={`${comp.files[0].replace(/^.*\//, '').replace(/\.jsx$/, '')}.d.ts`} code={typesFor(comp)} />
              </Section>
            )}
            <Section id="source" title="Source" note={`${comp.files.length} file${comp.files.length > 1 ? 's' : ''}`}>
              {sourceFor(comp).map((f) => (
                <CodeBlock key={f.file} title={f.file} code={f.code} />
              ))}
            </Section>
          </>
        )}

        <section className="lib-related">
          <h2>Related components</h2>
          <div className="related-grid">
            {related.map((c) => (
              <Link key={c.slug} to={`/library/${c.slug}`}>
                <img className="rel-img" src={`/previews/${c.slug}.jpg`} alt="" loading="lazy" />
                <span className="rel-cat">{c.category}</span>
                <strong>
                  {c.name}
                  {c.isNew && <span className="badge">New</span>}
                </strong>
                <small>{c.description.length > 96 ? `${c.description.slice(0, 96)}…` : c.description}</small>
              </Link>
            ))}
          </div>
        </section>

        <nav className="lib-pager">
          {prev ? (
            <Link to={`/library/${prev.slug}`}>
              <small>Previous</small>← {prev.name}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/library/${next.slug}`} className="next">
              <small>Next</small>
              {next.name} →
            </Link>
          )}
        </nav>
      </div>

      <aside className="lib-toc" aria-label="On this page">
        <h4>On this page</h4>
        {toc.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className={spy === id ? 'on' : ''}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            {label}
          </a>
        ))}
      </aside>
    </div>
  )
}
