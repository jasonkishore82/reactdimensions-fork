import { useState } from 'react'

// Minimal settings: grouped rows with the label on the left and the control
// on the right, divided by hairlines. Toggles act instantly (no Save), plain
// chevron rows lead deeper, and the one destructive action is red text with
// a confirm step. On wide screens a text list of groups sits on the left;
// on phones it becomes a back arrow and a title.

const GROUPS = ['Account', 'Notifications', 'Privacy', 'Appearance']

export default function MinSettings({ accent = '#111111', style }) {
  const [group, setGroup] = useState('Account')
  const [menu, setMenu] = useState(true)
  const [s, setS] = useState({ push: true, email: false, weekly: true, mentions: true, profile: true, activity: false, ads: false, theme: 'System', size: 'Default' })
  const [confirm, setConfirm] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [peek, setPeek] = useState(null)
  const toggle = (k) => setS({ ...s, [k]: !s[k] })

  const Toggle = ({ k, label, hint }) => (
    <div className="ms-row">
      <span><span className="ms-label">{label}</span>{hint && <span className="ms-hint">{hint}</span>}</span>
      <button className="ms-switch" role="switch" aria-checked={s[k]} aria-label={label} onClick={() => toggle(k)}><i /></button>
    </div>
  )
  const Link = ({ label, value }) => (
    <button className="ms-row ms-link" onClick={() => setPeek(label)}>
      <span className="ms-label">{label}</span>
      <span className="ms-value">{value}<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg></span>
    </button>
  )
  const Choice = ({ k, label, options }) => (
    <div className="ms-row">
      <span className="ms-label" id={`ms-${k}`}>{label}</span>
      <span className="ms-choice" role="radiogroup" aria-labelledby={`ms-${k}`}>
        {options.map((o) => <button key={o} role="radio" aria-checked={s[k] === o} onClick={() => setS({ ...s, [k]: o })}>{o}</button>)}
      </span>
    </div>
  )

  return (
    <div className={`ms-wrap${menu ? ' menu' : ''}`} style={{ '--accent': accent, ...style }}>
      <style>{`
        .ms-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: #fff; color: #111; font: 400 15px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; display: grid; grid-template-columns: 200px 1fr; }
        :where(.ms-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: left; }
        .ms-nav { padding: 40px 0 24px 32px; display: flex; flex-direction: column; gap: 2px; }
        .ms-nav h2 { margin: 0 0 16px; font-size: 20px; font-weight: 600; }
        .ms-nav button { padding: 7px 0; color: #555; }
        .ms-nav button[aria-current='page'] { color: #111; font-weight: 600; }
        .ms-main { padding: 40px 36px 48px; max-width: 600px; }
        .ms-main h1 { margin: 0 0 24px; font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
        .ms-back { display: none; }
        .ms-sec { margin-bottom: 32px; }
        .ms-sec h3 { margin: 0 0 4px; font-size: 12px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: #6b6b6b; }
        .ms-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; width: 100%; padding: 14px 0; border-bottom: 1px solid #ededeb; }
        .ms-label { display: block; }
        .ms-hint { display: block; font-size: 13px; color: #6b6b6b; }
        .ms-value { display: flex; align-items: center; gap: 6px; color: #6b6b6b; }
        .ms-link:hover .ms-label { text-decoration: underline; text-underline-offset: 3px; }
        .ms-switch { position: relative; width: 42px; height: 24px; border-radius: 999px; background: #d6d6d4; flex: none; transition: background 150ms; }
        .ms-switch i { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform 150ms; }
        .ms-switch[aria-checked='true'] { background: var(--accent); }
        .ms-switch[aria-checked='true'] i { transform: translateX(18px); }
        .ms-choice { display: flex; gap: 16px; }
        .ms-choice button { color: #6b6b6b; padding: 2px 0; }
        .ms-choice button[aria-checked='true'] { color: #111; text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 1.5px; }
        .ms-danger { color: #b42318; padding: 14px 0; }
        .ms-confirm { padding: 14px 0; display: flex; flex-wrap: wrap; gap: 16px; align-items: center; color: #444; }
        .ms-confirm button { text-decoration: underline; text-underline-offset: 3px; }
        .ms-confirm button.yes { color: #b42318; }
        .ms-peek { font-size: 13px; color: #6b6b6b; margin-top: 8px; }
        @container (max-width: 600px) {
          .ms-wrap { grid-template-columns: 1fr; }
          .ms-nav { display: none; }
          .ms-wrap.menu .ms-nav { display: flex; padding: 24px 20px; }
          .ms-wrap.menu .ms-main { display: none; }
          .ms-main { padding: 24px 20px 40px; }
          .ms-back { display: inline-grid; place-items: center; width: 28px; height: 28px; }
        }
        @media (prefers-reduced-motion: reduce) { .ms-switch, .ms-switch i { transition: none; } }
      `}</style>

        <nav className="ms-nav" aria-label="Settings groups">
          <h2>Settings</h2>
          {GROUPS.map((g) => <button key={g} aria-current={g === group ? 'page' : undefined} onClick={() => { setGroup(g); setMenu(false); setPeek(null) }}>{g}</button>)}
        </nav>

        <main className="ms-main">
          <h1>
            <button className="ms-back" aria-label="All settings" onClick={() => setMenu(true)}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
            </button>
            {group}
          </h1>

          {group === 'Account' && (
            <>
              <section className="ms-sec"><h3>Profile</h3>{Link({ label: "Name", value: "Sam Rivera" })}{Link({ label: "Email", value: "sam@hey.example" })}{Link({ label: "Password", value: "Changed 3 months ago" })}</section>
              <section className="ms-sec">
                <h3>Danger zone</h3>
                {deleted ? <p className="ms-confirm" role="status">Account scheduled for deletion. You have 30 days to change your mind.</p> : confirm ? (
                  <div className="ms-confirm" role="alert">Delete your account and all data?<button className="yes" onClick={() => { setDeleted(true); setConfirm(false) }}>Yes, delete</button><button onClick={() => setConfirm(false)}>Cancel</button></div>
                ) : <button className="ms-danger" onClick={() => setConfirm(true)}>Delete account</button>}
              </section>
            </>
          )}
          {group === 'Notifications' && (
            <section className="ms-sec"><h3>Alerts</h3>{Toggle({ k: "push", label: "Push notifications", hint: "On this device" })}{Toggle({ k: "mentions", label: "Mentions", hint: "When someone tags you" })}{Toggle({ k: "email", label: "Email updates" })}{Toggle({ k: "weekly", label: "Weekly summary", hint: "Mondays at 9:00" })}</section>
          )}
          {group === 'Privacy' && (
            <section className="ms-sec"><h3>Visibility</h3>{Toggle({ k: "profile", label: "Public profile" })}{Toggle({ k: "activity", label: "Show activity status" })}{Toggle({ k: "ads", label: "Personalised ads", hint: "Off by default" })}</section>
          )}
          {group === 'Appearance' && (
            <section className="ms-sec"><h3>Display</h3>{Choice({ k: "theme", label: "Theme", options: ['Light', 'Dark', 'System'] })}{Choice({ k: "size", label: "Text size", options: ['Small', 'Default', 'Large'] })}</section>
          )}
          {peek && <p className="ms-peek" role="status">{peek} would open its own page here.</p>}
        </main>
    </div>
  )
}
