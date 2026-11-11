import { useEffect, useState } from 'react'

// Neumorphic settings panel. Setting groups sit on softly raised cards; the
// sidebar item you're on presses in. Toggles have a recessed track and a
// raised knob, and "on" also fills the track with the accent and says so.
// The Appearance control really switches this panel between light and dark,
// and Save stays pressed in until something changes.

const NEU = {
  light: { base: '#e6ebf2', hi: '#ffffff', lo: '#b6c0ce', ink: '#243044', muted: '#56627a' },
  dark: { base: '#2a2e37', hi: '#363b47', lo: '#1b1e25', ink: '#e8ebf1', muted: '#a3abb9' },
}

const SECTIONS = [
  ['General', 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4'],
  ['Privacy', 'M10 2.5l6 2.5v4.5c0 4-2.6 6.8-6 8-3.4-1.2-6-4-6-8V5z'],
  ['Notifications', 'M5 14V9a5 5 0 0 1 10 0v5l1.5 2h-13zM8.5 18h3'],
  ['Devices', 'M3 4h14v9H3zM7 17h6M10 13v4'],
]

const ROWS = {
  General: [['autoUpdate', 'Automatic updates', 'Install new versions overnight'], ['sounds', 'Interface sounds', 'Soft clicks on taps and toggles']],
  Privacy: [['analytics', 'Share usage data', 'Helps us fix bugs faster'], ['location', 'Location access', 'Only while the app is open'], ['faceUnlock', 'Face unlock', 'Use your camera to sign in']],
  Notifications: [['push', 'Push notifications', 'Alerts on this device'], ['email', 'Email digest', 'One summary every Monday'], ['quiet', 'Quiet hours', 'Mute alerts 22:00 to 07:00']],
  Devices: [['sync', 'Sync across devices', 'Keep settings the same everywhere'], ['wifiOnly', 'Sync on Wi-Fi only', 'Save mobile data']],
}

const DEFAULTS = { autoUpdate: true, sounds: false, analytics: false, location: true, faceUnlock: true, push: true, email: false, quiet: true, sync: true, wifiOnly: true, textSize: 100, theme: 'light' }

const Icon = ({ d, size = 18 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={d} /></svg>
)

export default function NeuSettings({ mode = 'light', accent = '#ff7a45', style }) {
  const [saved, setSaved] = useState({ ...DEFAULTS, theme: mode })
  const [draft, setDraft] = useState({ ...DEFAULTS, theme: mode })
  const [section, setSection] = useState(0)
  const [flash, setFlash] = useState(false)
  // follow the library's mode control when it changes
  useEffect(() => { setDraft((d) => ({ ...d, theme: mode })); setSaved((d) => ({ ...d, theme: mode })) }, [mode])
  const t = NEU[draft.theme] ?? NEU.light
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)
  const name = SECTIONS[section][0]
  const set = (k, v) => setDraft({ ...draft, [k]: v })

  return (
    <div className="ns-wrap" style={{ '--base': t.base, '--hi': t.hi, '--lo': t.lo, '--ink': t.ink, '--muted': t.muted, '--accent': accent, ...style }}>
      <style>{`
        .ns-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: hidden; background: var(--base); color: var(--ink); font: 500 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; transition: background 300ms, color 300ms; }
        :where(.ns-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .ns-up { background: var(--base); box-shadow: 6px 6px 14px var(--lo), -6px -6px 14px var(--hi); }
        .ns-in { background: var(--base); box-shadow: inset 4px 4px 9px var(--lo), inset -4px -4px 9px var(--hi); }
        .ns { display: grid; grid-template-columns: 190px 1fr; gap: 22px; padding: 20px; height: 100%; box-sizing: border-box; }
        .ns-side { display: flex; flex-direction: column; gap: 12px; }
        .ns-side h2 { margin: 0 0 6px 4px; font-size: 18px; font-weight: 800; }
        .ns-nav { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 14px; font-weight: 700; text-align: left; color: var(--muted); transition: box-shadow 200ms, color 200ms; }
        .ns-nav[aria-current='page'] { color: var(--accent); box-shadow: inset 4px 4px 9px var(--lo), inset -4px -4px 9px var(--hi); }
        .ns-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; overflow: auto; padding: 6px 10px 10px 6px; margin: -6px -10px -10px -6px; }
        .ns-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .ns-head h3 { margin: 0; font-size: 17px; font-weight: 800; }
        .ns-save { padding: 10px 20px; border-radius: 999px; font-weight: 800; color: var(--accent); transition: box-shadow 200ms, color 200ms; }
        .ns-save:disabled { cursor: default; color: var(--muted); box-shadow: inset 4px 4px 9px var(--lo), inset -4px -4px 9px var(--hi); }
        .ns-card { border-radius: 20px; padding: 6px 18px; }
        .ns-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; }
        .ns-row + .ns-row { border-top: 1px solid color-mix(in srgb, var(--lo) 50%, transparent); }
        .ns-row b { display: block; font-weight: 700; }
        .ns-row small { color: var(--muted); font-size: 12px; }
        .ns-sw { display: flex; align-items: center; gap: 10px; flex: none; }
        .ns-sw .ns-state { font-size: 11px; font-weight: 800; width: 24px; text-align: right; color: var(--muted); }
        .ns-sw[aria-checked='true'] .ns-state { color: var(--accent); }
        .ns-track { position: relative; width: 54px; height: 28px; border-radius: 999px; transition: background 200ms; }
        .ns-sw[aria-checked='true'] .ns-track { background: color-mix(in srgb, var(--accent) 30%, var(--base)); }
        .ns-knob { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; box-shadow: 3px 3px 6px var(--lo), -2px -2px 5px var(--hi); background: color-mix(in srgb, var(--base), white 16%); transition: transform 220ms cubic-bezier(.3,1.3,.5,1), background 200ms; }
        .ns-sw[aria-checked='true'] .ns-knob { transform: translateX(26px); background: var(--accent); }
        .ns-seg { position: relative; display: grid; grid-template-columns: repeat(3, 66px); padding: 4px; border-radius: 999px; flex: none; }
        .ns-seg button { position: relative; z-index: 1; padding: 6px 0; font-weight: 700; font-size: 12px; color: var(--muted); }
        .ns-seg button[aria-checked='true'] { color: var(--accent); }
        .ns-seg i { position: absolute; top: 4px; bottom: 4px; left: 4px; width: 66px; border-radius: 999px; transition: transform 260ms cubic-bezier(.3,1.3,.5,1); }
        .ns-range { display: flex; align-items: center; gap: 10px; flex: none; }
        .ns-range input { -webkit-appearance: none; appearance: none; width: 140px; height: 10px; border-radius: 999px; background: var(--base); box-shadow: inset 3px 3px 6px var(--lo), inset -3px -3px 6px var(--hi); margin: 0; cursor: pointer; }
        .ns-range input::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); box-shadow: 3px 3px 6px var(--lo), -2px -2px 5px var(--hi); }
        .ns-range input::-moz-range-thumb { width: 22px; height: 22px; border: 0; border-radius: 50%; background: var(--accent); }
        .ns-range span { width: 38px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .ns-toast { color: var(--accent); font-weight: 800; font-size: 12px; }
        @container (max-width: 640px) { .ns { grid-template-columns: 1fr; grid-template-rows: auto 1fr; } .ns-side { flex-direction: row; overflow-x: auto; padding: 8px; margin: -8px; } .ns-side h2 { display: none; } .ns-nav { flex: none; } .ns-nav span { display: none; } .ns-row { flex-wrap: wrap; } }
      `}</style>

      <div className="ns">
        <nav className="ns-side" aria-label="Settings sections">
          <h2>Settings</h2>
          {SECTIONS.map(([s, d], n) => (
            <button key={s} className={`ns-nav ${n === section ? '' : 'ns-up'}`} aria-current={n === section ? 'page' : undefined} onClick={() => setSection(n)} title={s}>
              <Icon d={d} /><span>{s}</span>
            </button>
          ))}
        </nav>

        <main className="ns-main">
          <div className="ns-head">
            <h3>{name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {flash && <span className="ns-toast" role="status">Saved ✓</span>}
              <button className={`ns-save ${dirty ? 'ns-up' : ''}`} disabled={!dirty} onClick={() => { setSaved(draft); setFlash(true); setTimeout(() => setFlash(false), 1400) }}>
                {dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          </div>

          {section === 0 && (
            <section className="ns-card ns-up">
              <div className="ns-row">
                <span><b>Appearance</b><small>Light, dark, or match the system</small></span>
                <div className="ns-seg ns-in" role="radiogroup" aria-label="Appearance">
                  <i className="ns-up" style={{ transform: `translateX(${['light', 'dark', 'auto'].indexOf(draft.theme) * 100}%)` }} />
                  {['light', 'dark', 'auto'].map((m) => (
                    <button key={m} role="radio" aria-checked={draft.theme === m} onClick={() => set('theme', m)}>{m[0].toUpperCase() + m.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div className="ns-row">
                <span><b>Text size</b><small>Applies across the app</small></span>
                <label className="ns-range">
                  <input type="range" min="80" max="140" step="10" value={draft.textSize} onChange={(e) => set('textSize', +e.target.value)} aria-label="Text size" />
                  <span>{draft.textSize}%</span>
                </label>
              </div>
            </section>
          )}

          <section className="ns-card ns-up">
            {ROWS[name].map(([k, label, hint]) => (
              <div key={k} className="ns-row">
                <span><b>{label}</b><small>{hint}</small></span>
                <button className="ns-sw" role="switch" aria-checked={draft[k]} aria-label={label} onClick={() => set(k, !draft[k])}>
                  <span className="ns-state">{draft[k] ? 'On' : 'Off'}</span>
                  <span className="ns-track ns-in"><span className="ns-knob" /></span>
                </button>
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  )
}
