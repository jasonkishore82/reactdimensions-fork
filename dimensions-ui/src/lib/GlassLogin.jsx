import { useState } from 'react'

// Glassmorphism sign-in over a Swiss-style poster: bold shapes and giant
// type drift slowly behind one frosted card, so the blur always has
// something to bend. Glass toggle for Sign in / Create account, glass
// fields, a solid white primary button, glass alternatives and a help bubble.

const POSTERS = {
  vermillion: { bg: '#ff5a2c', a: '#141b3d', b: '#ffd23f', c: '#ffc2d1', type: '#ffe4d6' },
  ultramarine: { bg: '#2433d6', a: '#ff6a3d', b: '#f6f1e7', c: '#7ad7c3', type: '#9aa4ff' },
  mint: { bg: '#2fbf8f', a: '#18233a', b: '#ffe36e', c: '#ff8fa3', type: '#bff0dd' },
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

export default function GlassLogin({ poster = 'vermillion', blur = 22, frost = 0.18, style }) {
  const p = POSTERS[poster] ?? POSTERS.vermillion
  const [mode, setMode] = useState(0)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)
  const [done, setDone] = useState(false)
  const [help, setHelp] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    const msg = mode === 1 && !name.trim() ? 'Add your name.' : !isEmail(email) ? 'That email doesn’t look right.' : pw.length < 6 ? 'Password needs 6+ characters.' : ''
    setError(msg)
    if (msg) setShake((n) => n + 1)
    else setDone(true)
  }

  return (
    <div className="gl-wrap" style={{ '--bg': p.bg, '--a': p.a, '--b': p.b, '--c': p.c, '--type': p.type, '--blur': `${blur}px`, '--frost': frost, ...style }}>
      <style>{`
        .gl-wrap { container-type: size; position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--bg); color: #fff; font: 400 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; display: grid; place-items: center; }
        :where(.gl-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .gl-poster { position: absolute; inset: 0; pointer-events: none; }
        .gl-poster > * { position: absolute; }
        .gl-type { left: -2%; bottom: -6%; font: 900 clamp(90px, 34cqh, 240px)/0.8 system-ui, sans-serif; letter-spacing: -0.06em; color: var(--type); opacity: .55; white-space: nowrap; }
        .gl-circle { width: 46cqh; aspect-ratio: 1; border-radius: 50%; background: var(--a); left: 54%; top: 6%; animation: gl-a 14s ease-in-out infinite alternate; }
        .gl-half { width: 40cqh; aspect-ratio: 2 / 1; border-radius: 999px 999px 0 0; background: var(--b); left: 18%; top: 14%; animation: gl-b 18s ease-in-out infinite alternate; }
        .gl-bar { width: 12px; height: 70%; background: var(--a); left: 38%; top: -4%; transform: rotate(18deg); }
        .gl-square { width: 18cqh; aspect-ratio: 1; background: var(--c); right: 10%; bottom: 14%; animation: gl-c 11s ease-in-out infinite alternate; }
        .gl-lines { inset: 0; background: repeating-linear-gradient(90deg, transparent 0 79px, rgba(0,0,0,.08) 79px 80px); }
        @keyframes gl-a { to { transform: translate(-40px, 30px); } }
        @keyframes gl-b { to { transform: translate(50px, 10px) rotate(8deg); } }
        @keyframes gl-c { to { transform: translate(-30px, -20px) rotate(-12deg); } }
        .gl-glass { background: rgba(255,255,255,var(--frost)); border: 1px solid rgba(255,255,255,.4); box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 24px 60px rgba(0,0,0,.18); -webkit-backdrop-filter: blur(var(--blur)) saturate(160%); backdrop-filter: blur(var(--blur)) saturate(160%); }
        .gl-card { position: relative; width: min(330px, 100% - 32px); border-radius: 24px; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
        .gl-card.shake { animation: gl-shake 380ms; }
        @keyframes gl-shake { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
        .gl-toggle { position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 3px; border-radius: 999px; background: rgba(0,0,0,.12); }
        .gl-toggle button { position: relative; z-index: 1; padding: 7px 0; font-weight: 700; font-size: 12px; }
        .gl-toggle i { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px); border-radius: 999px; background: rgba(255,255,255,.38); transition: transform 280ms cubic-bezier(.3,1.3,.5,1); }
        .gl-card h2 { margin: 4px 0 0; font-size: 21px; font-weight: 800; letter-spacing: -0.02em; }
        .gl-card p { margin: 0; opacity: .85; }
        .gl-field { position: relative; }
        .gl-field input { width: 100%; box-sizing: border-box; border-radius: 12px; padding: 10px 12px; font: inherit; color: #fff; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.35); outline: none; transition: background 150ms, border-color 150ms; }
        .gl-field input::placeholder { color: rgba(255,255,255,.7); }
        .gl-field input:focus { background: rgba(255,255,255,.24); border-color: #fff; }
        .gl-eye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-weight: 700; font-size: 11px; padding: 4px 6px; border-radius: 8px; opacity: .85; }
        .gl-primary { background: #fff; color: #111; font-weight: 800; padding: 11px; border-radius: 12px; transition: transform 100ms; }
        .gl-wrap .gl-primary { color: var(--a); }
        .gl-primary:active { transform: scale(.98); }
        .gl-err { color: #fff; background: rgba(0,0,0,.25); border-radius: 8px; padding: 6px 9px; font-weight: 600; font-size: 12px; }
        .gl-or { display: flex; align-items: center; gap: 8px; font-size: 11px; opacity: .8; }
        .gl-or::before, .gl-or::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,.4); }
        .gl-alts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .gl-alt { border-radius: 12px; padding: 9px 6px; font-weight: 700; font-size: 12px; display: flex; gap: 6px; align-items: center; justify-content: center; }
        .gl-alt:hover { background: rgba(255,255,255,.3); }
        .gl-done { text-align: center; padding: 18px 4px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .gl-check { width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; }
        .gl-help { position: absolute; right: 16px; bottom: 16px; width: 38px; height: 38px; border-radius: 50%; font-weight: 800; font-size: 16px; }
        .gl-tip { position: absolute; right: 16px; bottom: 62px; width: 200px; border-radius: 14px; padding: 10px 12px; font-size: 12px; }
        @media (prefers-reduced-motion: reduce) { .gl-wrap * { animation: none !important; } }
      `}</style>

      <div className="gl-poster" aria-hidden="true">
        <div className="gl-lines" />
        <div className="gl-half" />
        <div className="gl-circle" />
        <div className="gl-bar" />
        <div className="gl-square" />
        <div className="gl-type">hello.</div>
      </div>

      <form key={shake} className={`gl-card gl-glass${shake ? ' shake' : ''}`} onSubmit={submit} noValidate>
        {done ? (
          <div className="gl-done">
            <div className="gl-check gl-glass">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
            </div>
            <h2>{mode ? `Welcome, ${name.split(' ')[0]}` : 'Welcome back'}</h2>
            <p>Signed in as {email}</p>
            <button type="button" className="gl-alt gl-glass" onClick={() => { setDone(false); setPw('') }}>Sign out</button>
          </div>
        ) : (
          <>
            <div className="gl-toggle" role="tablist">
              <i style={{ transform: `translateX(${mode * 100}%)` }} />
              {['Sign in', 'Create account'].map((m, n) => (
                <button key={m} type="button" role="tab" aria-selected={mode === n} onClick={() => { setMode(n); setError('') }}>{m}</button>
              ))}
            </div>
            <h2>{mode ? 'Make an account' : 'Good to see you'}</h2>
            <p>{mode ? 'It takes less than a minute.' : 'Sign in to pick up where you left off.'}</p>
            {mode === 1 && <div className="gl-field"><input aria-label="Name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} /></div>}
            <div className="gl-field"><input aria-label="Email" type="email" placeholder="you@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="gl-field">
              <input aria-label="Password" type={show ? 'text' : 'password'} placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button type="button" className="gl-eye" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
            </div>
            {error && <div className="gl-err" role="alert">{error}</div>}
            <button type="submit" className="gl-primary">{mode ? 'Create account' : 'Sign in'}</button>
            <div className="gl-or">or</div>
            <div className="gl-alts">
              <button type="button" className="gl-alt gl-glass">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3M21 12v2" /></svg>
                Passkey
              </button>
              <button type="button" className="gl-alt gl-glass">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18v12H3zM3 6l9 7 9-7" /></svg>
                Email link
              </button>
            </div>
          </>
        )}
      </form>

      {help && <div className="gl-tip gl-glass" role="status">Forgot your password? Use <b>Email link</b> and we’ll send you a one-tap sign-in.</div>}
      <button className="gl-help gl-glass" aria-label="Help" aria-expanded={help} onClick={() => setHelp(!help)}>?</button>
    </div>
  )
}
