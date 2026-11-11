import { useEffect, useRef, useState } from 'react'
import { useLens, specular } from '../liquid/lens.js'
import { useOnScreen, useReducedMotion } from '../ui/onscreen.js'

// Liquid glass landing hero: a huge headline sits behind a big glass orb
// that drifts and follows the pointer, bending the letters as it passes.
// A floating glass nav pill has a small lens that slides to the hovered
// link, and the call to action is a glass capsule over a solid colour.

const LINKS = ['Product', 'Pricing', 'Stories', 'Docs']

export default function LiquidHero({ headline = 'Bend the light.', accent = '#e0401f', orbSize = 260, zoom = 1.45, strength = 60, style }) {
  const wrap = useRef(null)
  const orb = useRef(null)
  const nav = useRef(null)
  const chip = useRef(null)
  const cta = useRef(null)
  const orbGlass = useLens(orb, { radius: orbSize / 2, depth: orbSize / 2, zoom, soften: 0 })
  const navGlass = useLens(nav, { radius: 24, depth: 14, strength: strength * 0.6, soften: 3 })
  const chipGlass = useLens(chip, { radius: 18, depth: 16, strength: strength * 0.6, soften: 1 })
  const ctaGlass = useLens(cta, { radius: 28, depth: 20, strength: strength * 0.6, soften: 1 })
  const [hover, setHover] = useState(0)
  const [menu, setMenu] = useState(false)
  const target = useRef({ x: 0.62, y: 0.52, follow: false })
  const pos = useRef({ x: 0.62, y: 0.52 })
  const visible = useOnScreen(wrap)
  const still = useReducedMotion()

  // Ease the orb toward the pointer, or let it drift in a slow loop.
  useEffect(() => {
    if (!visible) return
    let raf
    const tick = (now) => {
      const tg = target.current
      const drift = still ? 0 : 1
      const gx = tg.follow ? tg.x : 0.58 + Math.cos(now / 4200) * 0.14 * drift
      const gy = tg.follow ? tg.y : 0.5 + Math.sin(now / 3100) * 0.12 * drift
      pos.current.x += (gx - pos.current.x) * 0.06
      pos.current.y += (gy - pos.current.y) * 0.06
      if (orb.current) {
        orb.current.style.left = `${pos.current.x * 100}%`
        orb.current.style.top = `${pos.current.y * 100}%`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, still])

  const move = (e) => {
    const r = wrap.current.getBoundingClientRect()
    target.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, follow: true }
  }

  return (
    <div ref={wrap} className="lh-wrap" style={{ '--accent': accent, ...style }} onPointerMove={move} onPointerLeave={() => { target.current.follow = false }}>
      {orbGlass.filter}{navGlass.filter}{chipGlass.filter}{ctaGlass.filter}
      <style>{`
        .lh-wrap { container-type: size; position: relative; width: 100%; height: 100%; overflow: hidden; background: #f3efe7; color: #141414; font: 500 14px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; }
        :where(.lh-wrap) button, :where(.lh-wrap) a { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: none; }
        .lh-glass { background: rgba(255,255,255,.06); box-shadow: inset 0 1px 1px rgba(255,255,255,.95), inset 0 -2px 3px rgba(0,0,0,.08), inset 0 0 0 1px rgba(255,255,255,.45), 0 20px 50px rgba(40,30,20,.16); }
        .lh-head { position: absolute; left: 6%; right: 6%; top: 50%; transform: translateY(-58%); margin: 0; font: 900 clamp(56px, 15cqw, 170px)/0.86 system-ui, sans-serif; letter-spacing: -0.065em; }
        .lh-head span { color: var(--accent); }
        .lh-sub { position: absolute; left: 6%; bottom: 9%; max-width: 360px; color: #4c4842; }
        .lh-stripes { position: absolute; right: -4%; top: 12%; width: 34%; height: 76%; background: repeating-linear-gradient(90deg, #141414 0 10px, transparent 10px 26px); opacity: .9; }
        .lh-orb { position: absolute; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; z-index: 2; }
        .lh-orb::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle at 32% 24%, rgba(255,255,255,.75), transparent 28%), radial-gradient(circle at 70% 82%, rgba(255,255,255,.25), transparent 30%); }
        .lh-nav { position: absolute; left: 50%; top: 16px; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; padding: 6px; border-radius: 24px; z-index: 3; }
        .lh-logo { font-weight: 900; letter-spacing: -0.04em; padding: 0 12px 0 8px; font-size: 16px; }
        .lh-links { position: relative; display: grid; grid-template-columns: repeat(4, 78px); }
        .lh-links a { position: relative; z-index: 1; text-align: center; padding: 8px 0; font-weight: 600; font-size: 13px; }
        .lh-chip { position: absolute; top: 0; bottom: 0; left: 0; width: 78px; border-radius: 18px; background: rgba(255,255,255,.35); transition: transform 300ms cubic-bezier(.3,1.3,.5,1); }
        .lh-menu { display: none; padding: 8px 14px; font-weight: 700; }
        .lh-drop { position: absolute; left: 50%; top: 68px; transform: translateX(-50%); width: 220px; border-radius: 22px; padding: 8px; display: flex; flex-direction: column; z-index: 3; }
        .lh-drop a { padding: 10px 12px; border-radius: 14px; font-weight: 600; }
        .lh-drop a:hover { background: rgba(255,255,255,.4); }
        .lh-cta-wrap { position: absolute; right: 6%; bottom: 8%; background: var(--accent); border-radius: 34px; padding: 10px; z-index: 3; }
        .lh-cta { position: relative; display: block; border-radius: 28px; padding: 16px 26px; font-weight: 800; font-size: 15px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform 150ms; }
        .lh-wrap .lh-cta { color: #fff; }
        .lh-cta:hover { transform: translateY(-1px); box-shadow: inset 0 1px 1px rgba(255,255,255,1), inset 0 0 0 1px rgba(255,255,255,.7), 0 14px 30px rgba(0,0,0,.2); }
        .lh-cta::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: radial-gradient(circle at var(--gx, 30%) var(--gy, 0%), rgba(255,255,255,.6), transparent 45%); mix-blend-mode: soft-light; }
        @container (max-width: 640px) { .lh-links { display: none; } .lh-menu { display: block; } .lh-stripes { display: none; } .lh-sub { display: none; } .lh-cta-wrap { left: 6%; right: auto; } }
        @media (prefers-reduced-motion: reduce) { .lh-orb { transition: none; } }
      `}</style>

      <div className="lh-stripes" aria-hidden="true" />
      <h1 className="lh-head">{headline.split(' ').slice(0, -1).join(' ')} <span>{headline.split(' ').slice(-1)}</span></h1>
      <p className="lh-sub">Liquid interfaces that react to light, motion and touch. Built for the web, ready today.</p>

      <div ref={orb} className="lh-glass lh-orb" style={{ ...orbGlass.style, width: orbSize, height: orbSize }} aria-hidden="true" />

      <nav ref={nav} className="lh-glass lh-nav" style={navGlass.style} onPointerLeave={() => setHover(0)}>
        <span className="lh-logo">refract</span>
        <div className="lh-links">
          <span ref={chip} className="lh-glass lh-chip" style={{ ...chipGlass.style, transform: `translateX(${hover * 100}%)` }} />
          {LINKS.map((l, n) => <a key={l} href={`#${l.toLowerCase()}`} onClick={(e) => e.preventDefault()} onPointerEnter={() => setHover(n)} onFocus={() => setHover(n)}>{l}</a>)}
        </div>
        <button className="lh-menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? 'Close' : 'Menu'}</button>
      </nav>
      {menu && (
        <div className="lh-glass lh-drop" style={navGlass.style}>
          {LINKS.map((l) => <a key={l} href={`#${l.toLowerCase()}`} onClick={(e) => { e.preventDefault(); setMenu(false) }}>{l}</a>)}
        </div>
      )}

      <div className="lh-cta-wrap">
        <a ref={cta} href="#start" className="lh-glass lh-cta" style={ctaGlass.style} onPointerMove={specular} onClick={(e) => e.preventDefault()}>Get early access →</a>
      </div>
    </div>
  )
}
