import { useRef, useState } from 'react'

// Minimal to-do list: one column, lots of space, a single accent for the
// checkbox. One floating "+" adds a task inline; a small pill switches
// Today / Upcoming / Done; projects sit in a plain text list with counts.
// A quiet "3 of 7 done" line keeps you oriented (simple, not lost).

const SEED = [
  { id: 1, text: 'Reply to Rui about the launch date', project: 'Work', when: 'Today', done: false },
  { id: 2, text: 'Book dentist', project: 'Personal', when: 'Today', done: false },
  { id: 3, text: 'Sketch onboarding flow', project: 'Work', when: 'Today', done: true },
  { id: 4, text: 'Buy oat milk and lemons', project: 'Home', when: 'Today', done: false },
  { id: 5, text: 'Read chapter 4', project: 'Personal', when: 'Upcoming', done: false },
  { id: 6, text: 'Renew passport', project: 'Personal', when: 'Upcoming', done: false },
  { id: 7, text: 'Water the plants', project: 'Home', when: 'Today', done: true },
]
const VIEWS = ['Today', 'Upcoming', 'Done']

export default function MinTodo({ accent = '#2f6f4f', style }) {
  const [tasks, setTasks] = useState(SEED)
  const [view, setView] = useState('Today')
  const [project, setProject] = useState('All')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const input = useRef(null)
  const nextId = useRef(100)

  const projects = ['All', ...new Set(SEED.map((t) => t.project))]
  const inProject = (t) => project === 'All' || t.project === project
  const shown = tasks.filter((t) => inProject(t) && (view === 'Done' ? t.done : t.when === view))
  const today = tasks.filter((t) => t.when === 'Today' && inProject(t))
  const doneToday = today.filter((t) => t.done).length

  const add = (e) => {
    e.preventDefault()
    if (draft.trim()) setTasks([{ id: nextId.current++, text: draft.trim(), project: project === 'All' ? 'Personal' : project, when: view === 'Upcoming' ? 'Upcoming' : 'Today', done: false }, ...tasks])
    setDraft('')
    setAdding(false)
  }
  const open = () => { setAdding(true); setView(view === 'Done' ? 'Today' : view); setTimeout(() => input.current?.focus(), 0) }

  return (
    <div className="mt-wrap" style={{ '--accent': accent, ...style }}>
      <style>{`
        .mt-wrap { container-type: inline-size; position: relative; width: 100%; height: 100%; overflow: auto; background: #fff; color: #1a1a1a; font: 400 15px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; display: grid; grid-template-columns: 180px 1fr; }
        :where(.mt-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .mt-side { padding: 48px 0 24px 32px; }
        .mt-side h3 { margin: 0 0 12px; font-size: 12px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: #6b6b6b; }
        .mt-proj { display: flex; justify-content: space-between; width: 100%; padding: 6px 12px 6px 0; color: #4a4a4a; text-align: left; }
        .mt-proj span { color: #6b6b6b; font-variant-numeric: tabular-nums; }
        .mt-proj[aria-current='true'] { color: #1a1a1a; font-weight: 600; }
        .mt-main { padding: 40px 32px 96px; max-width: 560px; }
        .mt-head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 8px; }
        .mt-head h1 { margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.02em; }
        .mt-pill { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: #f2f2f0; }
        .mt-pill button { padding: 5px 12px; border-radius: 999px; font-size: 13px; color: #555; }
        .mt-pill button[aria-pressed='true'] { background: #fff; color: #1a1a1a; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
        .mt-sum { margin: 0 0 28px; color: #6b6b6b; font-size: 14px; }
        .mt-list { list-style: none; margin: 0; padding: 0; }
        .mt-item { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid #f0f0ee; }
        .mt-check { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid #8a8a8a; display: grid; place-items: center; flex: none; transition: background 150ms, border-color 150ms; }
        .mt-check[aria-checked='true'] { background: var(--accent); border-color: var(--accent); }
        .mt-check svg { opacity: 0; }
        .mt-check[aria-checked='true'] svg { opacity: 1; }
        .mt-text { flex: 1; }
        .mt-item.done .mt-text { color: #6b6b6b; text-decoration: line-through; text-decoration-color: #b5b5b5; }
        .mt-meta { font-size: 12px; color: #6b6b6b; }
        .mt-del { opacity: 0; color: #6b6b6b; font-size: 18px; line-height: 1; padding: 0 4px; }
        .mt-item:hover .mt-del, .mt-del:focus-visible { opacity: 1; }
        .mt-form input { width: 100%; color: #1a1a1a; border: 0; border-bottom: 1px solid #1a1a1a; padding: 12px 0; font: inherit; outline: none; background: transparent; }
        .mt-empty { color: #6b6b6b; padding: 24px 0; }
        .mt-fab { position: absolute; right: 28px; bottom: 24px; width: 48px; height: 48px; border-radius: 50%; background: #1a1a1a; color: #fff; font-size: 26px; line-height: 1; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(0,0,0,.15); }
        .mt-wrap .mt-fab { color: #fff; }
        @container (max-width: 560px) { .mt-wrap { grid-template-columns: 1fr; } .mt-side { display: none; } .mt-main { padding: 28px 20px 96px; } .mt-head { flex-wrap: wrap; } }
        @media (prefers-reduced-motion: reduce) { .mt-check { transition: none; } }
      `}</style>

      <aside className="mt-side" aria-label="Projects">
        <h3>Projects</h3>
        {projects.map((p) => (
          <button key={p} className="mt-proj" aria-current={p === project} onClick={() => setProject(p)}>
            {p}<span>{tasks.filter((t) => !t.done && (p === 'All' || t.project === p)).length}</span>
          </button>
        ))}
      </aside>

      <main className="mt-main">
        <div className="mt-head">
          <h1>{view}</h1>
          <div className="mt-pill" role="group" aria-label="View">
            {VIEWS.map((v) => <button key={v} aria-pressed={v === view} onClick={() => { setView(v); setAdding(false) }}>{v}</button>)}
          </div>
        </div>
        <p className="mt-sum" role="status">{doneToday} of {today.length} done today{project !== 'All' ? ` · ${project}` : ''}</p>

        {adding && (
          <form className="mt-form" onSubmit={add}>
            <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (!draft.trim()) setAdding(false) }} onKeyDown={(e) => e.key === 'Escape' && setAdding(false)} placeholder="New task, then press Enter" aria-label="New task" />
          </form>
        )}

        <ul className="mt-list">
          {shown.map((t) => (
            <li key={t.id} className={`mt-item${t.done ? ' done' : ''}`}>
              <button className="mt-check" role="checkbox" aria-checked={t.done} aria-label={t.text} onClick={() => setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 6.5l2.5 2.5 4.5-5" /></svg>
              </button>
              <span className="mt-text">{t.text}<br /><span className="mt-meta">{t.project}</span></span>
              <button className="mt-del" aria-label={`Delete ${t.text}`} onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}>×</button>
            </li>
          ))}
        </ul>
        {!shown.length && <p className="mt-empty">{view === 'Done' ? 'Nothing finished yet.' : 'All clear.'}</p>}
      </main>

      <button className="mt-fab" aria-label="Add task" onClick={open}>+</button>
    </div>
  )
}
