import { useEffect, useState } from 'react'

// Bento feature section for a landing page: one big hero tile and smaller
// tiles, each showing one idea with a tiny live demo (a typing editor,
// orbiting integrations, a counter, live cursors, a sparkline). Tiles lift
// on hover; a sticky nav pill ends in a dark "Get started" cap.

const LINKS = ['Features', 'Pricing', 'Customers', 'Changelog']
const CODE = 'deploy --prod ./site'

function Typing() {
  const [n, setN] = useState(0)
  useEffect(() => { const id = setInterval(() => setN((v) => (v + 1) % (CODE.length + 12)), 120); return () => clearInterval(id) }, [])
  return (
    <div className="bf-term">
      <div className="bf-dots"><i /><i /><i /></div>
      <code>$ {CODE.slice(0, Math.min(n, CODE.length))}<span className="bf-caret" /></code>
      {n > CODE.length + 2 && <code className="bf-ok">✓ Live in 1.8s · edge, 42 regions</code>}
    </div>
  )
}

function Counter({ to }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf, start
    const tick = (t) => { start ??= t; const k = Math.min(1, (t - start) / 1400); setV(Math.round(to * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{v}</>
}

export default function BentoFeatures({ accent = '#c6f432', dark = true, style }) {
  const [active, setActive] = useState(0)
  const ink = dark ? '#f4f4f0' : '#111'
  return (
    <div className="bf-wrap" style={{ '--accent': accent, '--bg': dark ? '#0b0b0f' : '#f4f3ee', '--tile': dark ? '#16161c' : '#ffffff', '--ink': ink, '--muted': dark ? '#9a9aa6' : '#5d5d66', '--line': dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)', ...style }}>
      <style>{`
        .bf-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: var(--bg); color: var(--ink); font: 500 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.bf-wrap) button, :where(.bf-wrap) a { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: none; }
        .bf-nav { position: sticky; top: 12px; z-index: 5; margin: 12px auto 0; width: max-content; max-width: calc(100% - 24px); display: flex; align-items: center; gap: 2px; padding: 5px; border-radius: 999px; background: color-mix(in srgb, var(--tile) 85%, transparent); border: 1px solid var(--line); backdrop-filter: blur(12px); }
        .bf-nav b { padding: 0 12px 0 8px; font-weight: 900; letter-spacing: -0.03em; }
        .bf-nav a { padding: 7px 12px; border-radius: 999px; color: var(--muted); font-weight: 600; }
        .bf-nav a[aria-current='page'] { color: var(--ink); background: var(--line); }
        .bf-nav .bf-go { background: var(--ink); color: var(--bg); padding: 8px 14px; border-radius: 999px; font-weight: 700; margin-left: 6px; }
        .bf-wrap .bf-go { color: var(--bg); }
        .bf { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 150px; gap: 12px; padding: 16px; }
        .bf-tile { position: relative; background: var(--tile); border: 1px solid var(--line); border-radius: 22px; padding: 16px; overflow: hidden; display: flex; flex-direction: column; gap: 6px; transition: transform 200ms, border-color 200ms; }
        .bf-tile:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--accent) 50%, transparent); }
        .bf-tile h3 { margin: 0; font-size: 15px; font-weight: 750; letter-spacing: -0.01em; }
        .bf-tile p { margin: 0; color: var(--muted); font-size: 12.5px; }
        .bf-arrow { position: absolute; right: 12px; top: 12px; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--line); opacity: 0; transform: translate(-4px, 4px); transition: 200ms; }
        .bf-tile:hover .bf-arrow { opacity: 1; transform: none; }
        .bf-hero { grid-column: span 2; grid-row: span 2; background: radial-gradient(circle at 85% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 55%), var(--tile); }
        .bf-hero h2 { margin: 0; font-size: 28px; line-height: 1.05; font-weight: 850; letter-spacing: -0.03em; }
        .bf-hero h2 span { color: var(--accent); }
        .bf-term { margin-top: auto; background: #050507; color: #e8e8e8; border-radius: 14px; padding: 12px 14px; font: 12.5px/1.6 ui-monospace, Menlo, monospace; display: flex; flex-direction: column; gap: 2px; border: 1px solid rgba(255,255,255,.08); }
        .bf-dots { display: flex; gap: 5px; margin-bottom: 4px; }
        .bf-dots i { width: 8px; height: 8px; border-radius: 50%; background: #3a3a44; }
        .bf-caret { display: inline-block; width: 7px; height: 14px; background: var(--accent); vertical-align: -2px; margin-left: 2px; animation: bf-blink 1s steps(1) infinite; }
        @keyframes bf-blink { 50% { opacity: 0; } }
        .bf-ok { color: var(--accent); }
        .bf-orbit { position: relative; flex: 1; }
        .bf-orbit i { position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px; border-radius: 8px; animation: bf-spin 9s linear infinite; }
        @keyframes bf-spin { from { transform: rotate(var(--a)) translateX(46px) rotate(calc(-1 * var(--a))); } to { transform: rotate(calc(var(--a) + 360deg)) translateX(46px) rotate(calc(-1 * var(--a) - 360deg)); } }
        .bf-core { position: absolute; left: 50%; top: 50%; width: 34px; height: 34px; margin: -17px; border-radius: 10px; background: var(--accent); }
        .bf-big { font-size: 46px; font-weight: 850; letter-spacing: -0.04em; line-height: 1; margin-top: auto; }
        .bf-big small { font-size: 16px; color: var(--muted); margin-left: 4px; }
        .bf-cursors { position: relative; flex: 1; }
        .bf-cur { position: absolute; display: flex; align-items: flex-start; gap: 2px; font-size: 10.5px; font-weight: 700; animation: bf-wander 6s ease-in-out infinite alternate; }
        .bf-cur span { padding: 2px 6px; border-radius: 6px; color: #111; margin-top: 10px; }
        @keyframes bf-wander { 33% { transform: translate(30px, 10px); } 66% { transform: translate(-10px, 24px); } 100% { transform: translate(20px, -6px); } }
        .bf-wide { grid-column: span 2; }
        .bf-spark { width: 100%; flex: 1; }
        .bf-lock { flex: 1; display: grid; place-items: center; }
        @container (max-width: 760px) { .bf { grid-template-columns: repeat(2, 1fr); } .bf-nav a:not(.bf-go) { display: none; } }
        @container (max-width: 440px) { .bf { grid-template-columns: 1fr; grid-auto-rows: minmax(150px, auto); } .bf-hero, .bf-wide { grid-column: span 1; } }
        @media (prefers-reduced-motion: reduce) { .bf-wrap * { animation: none !important; } }
      `}</style>

      <nav className="bf-nav">
        <b>shipyard</b>
        {LINKS.map((l, n) => <a key={l} href={`#${l}`} aria-current={n === active ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setActive(n) }}>{l}</a>)}
        <a href="#start" className="bf-go" onClick={(e) => e.preventDefault()}>Get started</a>
      </nav>

      <section className="bf">
        <article className="bf-tile bf-hero">
          <h2>Ship the site.<br /><span>Skip the ops.</span></h2>
          <p>Push to deploy, previews for every branch, and rollbacks in one click.</p>
          <Typing />
        </article>

        <article className="bf-tile">
          <span className="bf-arrow">↗</span>
          <h3>Integrations</h3>
          <div className="bf-orbit" aria-hidden="true">
            <span className="bf-core" />
            {['#ff6b6b', '#4dabf7', '#ffd43b', '#b197fc', '#63e6be'].map((c, i) => <i key={c} style={{ background: c, '--a': `${i * 72}deg` }} />)}
          </div>
        </article>

        <article className="bf-tile">
          <span className="bf-arrow">↗</span>
          <h3>Cold starts</h3>
          <p>Median across all regions</p>
          <div className="bf-big"><Counter to={38} /><small>ms</small></div>
        </article>

        <article className="bf-tile">
          <span className="bf-arrow">↗</span>
          <h3>Multiplayer</h3>
          <div className="bf-cursors" aria-hidden="true">
            {[['Ana', '#ffa94d', 6, 4], ['Rui', '#74c0fc', 60, 30], ['Mei', 'var(--accent)', 20, 50]].map(([n, c, x, y], i) => (
              <span key={n} className="bf-cur" style={{ left: x, top: y, animationDelay: `${-i * 2}s` }}>
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 1l5 12 2-5 5-2z" fill={c} /></svg>
                <span style={{ background: c }}>{n}</span>
              </span>
            ))}
          </div>
        </article>

        <article className="bf-tile">
          <span className="bf-arrow">↗</span>
          <h3>Secure by default</h3>
          <div className="bf-lock" aria-hidden="true">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round"><rect x="5" y="10" width="14" height="10" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" /></svg>
          </div>
        </article>

        <article className="bf-tile bf-wide">
          <span className="bf-arrow">↗</span>
          <h3>Analytics built in</h3>
          <p>Real traffic, no cookie banner.</p>
          <svg className="bf-spark" viewBox="0 0 200 50" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="bf-g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={accent} stopOpacity=".35" /><stop offset="1" stopColor={accent} stopOpacity="0" /></linearGradient></defs>
            <path d="M0 40 L20 34 L40 37 L60 26 L80 30 L100 18 L120 22 L140 12 L160 16 L180 6 L200 9 V50 H0Z" fill="url(#bf-g)" />
            <path d="M0 40 L20 34 L40 37 L60 26 L80 30 L100 18 L120 22 L140 12 L160 16 L180 6 L200 9" fill="none" stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        </article>

        <article className="bf-tile bf-wide" style={{ background: 'var(--accent)', color: '#111', justifyContent: 'center' }}>
          <h3 style={{ fontSize: 22 }}>Start free. Scale when it works.</h3>
          <p style={{ color: '#111', opacity: 0.75 }}>No card needed · 3 projects on the free plan</p>
        </article>
      </section>
    </div>
  )
}
