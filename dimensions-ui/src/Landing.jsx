import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

const Hero3D = lazy(() => import('./Hero3D.jsx'))

// Adds .in to elements with [data-reveal] as they scroll into view.
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.18, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

// Horizontal / vertical dimension line, CAD style, that draws itself in.
function Dim({ label, vertical = false, className = '' }) {
  return (
    <div className={`dim ${vertical ? 'dim-v' : 'dim-h'} ${className}`} aria-hidden="true">
      <span className="dim-line" />
      <span className="dim-label">{label}</span>
    </div>
  )
}

function CopyInstall() {
  const [copied, setCopied] = useState(false)
  const cmd = 'npm i react-dimensions'
  return (
    <button
      className="install"
      onClick={() => {
        navigator.clipboard?.writeText(cmd).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
    >
      <span className="prompt">$</span>
      {cmd}
      <span className="copy">{copied ? 'copied' : 'copy'}</span>
    </button>
  )
}

function Hero() {
  const readout = useRef()
  useEffect(() => {
    const on = (e) => {
      if (!readout.current) return
      const x = ((e.clientX / window.innerWidth) * 2 - 1).toFixed(2)
      const y = (-(e.clientY / window.innerHeight) * 2 + 1).toFixed(2)
      readout.current.textContent = `x ${x.padStart(5, ' ')}   y ${y.padStart(5, ' ')}`
    }
    window.addEventListener('pointermove', on)
    return () => window.removeEventListener('pointermove', on)
  }, [])

  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow load" style={{ '--d': 0 }}>
          <span className="tag">Sheet 01</span> Physically based UI for React
        </p>
        <h1 className="load" style={{ '--d': 1 }}>
          Interfaces with <em>depth</em> you can measure.
        </h1>
        <p className="lede load" style={{ '--d': 2 }}>
          React Dimensions is a library of real-time 3D components with clear-coat, brushed steel, real light and spring
          physics. They drop into your app like any other component, at true scale.
        </p>
        <div className="actions load" style={{ '--d': 3 }}>
          <a className="btn" href="#access">
            Get early access <span aria-hidden="true">→</span>
          </a>
          <CopyInstall />
        </div>
      </div>

      <div className="stage load" style={{ '--d': 2 }}>
        <Dim label="85.60 mm" className="dim-top" />
        <Dim label="53.98" vertical className="dim-left" />
        <span className="crop tl" />
        <span className="crop tr" />
        <span className="crop bl" />
        <span className="crop br" />
        <div className="canvas-wrap">
          <Suspense fallback={<div className="loading">loading model…</div>}>
            <Hero3D />
          </Suspense>
        </div>
        <div className="stage-foot">
          <span>Drag · flick to flip · double-click to turn</span>
          <span className="readout" ref={readout}>
            x  0.00   y  0.00
          </span>
        </div>
      </div>

      <dl className="titleblock load" style={{ '--d': 4 }}>
        <div>
          <dt>Project</dt>
          <dd>React Dimensions</dd>
        </div>
        <div>
          <dt>Sheet</dt>
          <dd>01 / 05</dd>
        </div>
        <div>
          <dt>Scale</dt>
          <dd>1 : 1</dd>
        </div>
        <div>
          <dt>Rev</dt>
          <dd>A</dd>
        </div>
      </dl>
    </section>
  )
}

const SPECS = [
  'Clear-coat',
  'Anisotropic steel',
  'Iridescence',
  'Studio light rigs',
  'AgX tone mapping',
  'Damped springs',
  'Inertia',
  'Suspension',
  'Bloom',
  'Real-world scale',
]

function Ticker() {
  const row = SPECS.map((s, i) => (
    <span key={i}>
      {s}
      <i>✕</i>
    </span>
  ))
  return (
    <div className="ticker" aria-label={SPECS.join(', ')}>
      <div className="ticker-track" aria-hidden="true">
        {row}
        {row}
      </div>
    </div>
  )
}

function Spheres() {
  return (
    <div className="spheres" aria-hidden="true">
      <span className="sph chrome" />
      <span className="sph gold" />
      <span className="sph ink" />
      <span className="sph glass" />
    </div>
  )
}

function ToneCurve() {
  return (
    <svg className="plot" viewBox="0 0 220 140" aria-hidden="true">
      <path className="axis" d="M20 120H210M20 120V10" />
      <path className="grid" d="M20 30H210M20 75H210M115 10V120" />
      {/* Linear: clips hard at white */}
      <path className="muted draw" d="M20 120 L95 30 L210 30" />
      {/* Filmic: smooth shoulder */}
      <path className="accent draw" d="M20 120 C60 112 70 70 100 52 S170 32 210 31" />
      <text x="140" y="24">white</text>
      <text x="152" y="62" className="t-accent">filmic</text>
      <text x="58" y="56" className="t-muted">linear</text>
    </svg>
  )
}

function SpringCurve() {
  return (
    <svg className="plot" viewBox="0 0 220 140" aria-hidden="true">
      <path className="axis" d="M20 120H210M20 120V10" />
      <path className="grid" d="M20 65H210" />
      <path
        className="accent draw"
        d="M20 120 C40 0 52 10 62 65 S82 112 94 65 S112 40 122 65 S138 80 146 65 S160 58 168 65 S186 68 210 65"
      />
      <text x="160" y="58">rest</text>
    </svg>
  )
}

function Primitives() {
  const items = [
    {
      n: '01',
      title: 'Material',
      body: 'Clear-coat, brushed steel, foil, tinted glass. Layered PBR materials tuned against real reference, not guesswork.',
      art: <Spheres />,
    },
    {
      n: '02',
      title: 'Light',
      body: 'Studio rigs built from light panels, reflections that drift, and filmic tone mapping that rolls highlights off instead of clipping them.',
      art: <ToneCurve />,
    },
    {
      n: '03',
      title: 'Motion',
      body: 'Damped springs, inertia and suspension. Flick it, drop it, drive it: things settle the way physical objects do.',
      art: <SpringCurve />,
    },
  ]
  return (
    <section className="section" id="primitives">
      <header className="section-head" data-reveal>
        <span className="tag">Sheet 02</span>
        <h2>
          Three primitives. <em>Everything</em> else is composition.
        </h2>
      </header>
      <div className="prims">
        {items.map((it, i) => (
          <article className="prim" key={it.n} data-reveal style={{ '--d': i }}>
            <div className="prim-n">{it.n}</div>
            <div className="prim-art">{it.art}</div>
            <h3>{it.title}</h3>
            <p>{it.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function Models() {
  return (
    <section className="section" id="models">
      <header className="section-head" data-reveal>
        <span className="tag">Sheet 03</span>
        <h2>
          Built with it. <em>Measured</em> to the millimetre.
        </h2>
      </header>
      <div className="models">
        <article className="model model-a" data-reveal>
          <Dim label="85.60 × 53.98 × 0.76 mm" className="dim-top" />
          <figure>
            <img src="/card.png" alt="A black clear-coat card with a gold chip, tilted toward the light" loading="lazy" />
          </figure>
          <div className="model-meta">
            <h3>Card</h3>
            <ul>
              <li>Clear-coat over foil lettering</li>
              <li>Gold EMV chip, engraved pads</li>
              <li>Flick-to-flip spring physics</li>
            </ul>
          </div>
        </article>

        <article className="model model-b" data-reveal style={{ '--d': 1 }}>
          <Dim label="5,680 × 2,030 × 1,790 mm" className="dim-top" />
          <figure>
            <img src="/truck.png" alt="An angular stainless-steel pickup on a glossy studio floor" loading="lazy" />
          </figure>
          <div className="model-meta">
            <h3>Pickup</h3>
            <ul>
              <li>Anisotropic brushed steel</li>
              <li>Headlights that light the floor</li>
              <li>Drivable: steering, roll, dive</li>
            </ul>
          </div>
        </article>

        <article className="model model-c" data-reveal style={{ '--d': 2 }}>
          <figure>
            <img src="/truck-drive.png" alt="The pickup driving through a slalom of traffic cones" loading="lazy" />
          </figure>
          <p className="caption">
            <span className="tag">Fig. 3</span> Chase cam through the cone slalom. Cones are rigid bodies too.
          </p>
        </article>

        <a className="model model-next" href="#access" data-reveal style={{ '--d': 3 }}>
          <span className="plus">+</span>
          <span>Your product, next.</span>
        </a>
      </div>
    </section>
  )
}

function Code() {
  return (
    <section className="section code-section" id="code">
      <div className="code-copy" data-reveal>
        <span className="tag">Sheet 04</span>
        <h2>
          Ships as components. <em>Not</em> a renderer to babysit.
        </h2>
        <p>
          Sizes are in millimetres, physics are plain props, and lighting presets come tuned. You write JSX; we handle
          shaders, tone mapping and frame budgets.
        </p>
        <dl className="stats">
          <div>
            <dt>0</dt>
            <dd>texture files shipped — everything is drawn in code</dd>
          </div>
          <div>
            <dt>1:1</dt>
            <dd>real-world scale, in millimetres</dd>
          </div>
          <div>
            <dt>AgX</dt>
            <dd>filmic tone mapping by default</dd>
          </div>
        </dl>
      </div>
      <pre className="code" data-reveal style={{ '--d': 1 }}>
        <span className="code-bar">
          <i />
          <i />
          <i />
          <span>Hero.jsx</span>
        </span>
        <code>
          <span className="k">import</span> {'{ '}Stage, Card, Material{' }'} <span className="k">from</span>{' '}
          <span className="s">'react-dimensions'</span>
          {'\n\n'}
          <span className="k">export default function</span> <span className="f">Hero</span>() {'{'}
          {'\n  '}
          <span className="k">return</span> ({'\n    '}
          {'<'}
          <span className="t">Stage</span> <span className="a">lighting</span>=<span className="s">"studio"</span>{' '}
          <span className="a">toneMapping</span>=<span className="s">"agx"</span>
          {'>\n      <'}
          <span className="t">Card</span>
          {'\n        '}
          <span className="a">size</span>={'{'}[<span className="n">85.6</span>, <span className="n">53.98</span>]
          {'}'}
          {'\n        '}
          <span className="a">material</span>={'{'}Material.<span className="f">clearcoat</span>({'{ '}base:{' '}
          <span className="s">'#141517'</span>
          {' }'}){'}'}
          {'\n        '}
          <span className="a">physics</span>={'{{ '}stiffness: <span className="n">55</span>, damping:{' '}
          <span className="n">7.5</span>
          {' }}'}
          {'\n        '}
          <span className="a">flip</span>=<span className="s">"flick"</span>
          {'\n      />\n    </'}
          <span className="t">Stage</span>
          {'>\n  )\n}'}
        </code>
      </pre>
    </section>
  )
}

function Access() {
  const [sent, setSent] = useState(false)
  return (
    <section className="access" id="access">
      <div className="access-inner" data-reveal>
        <span className="tag tag-light">Sheet 05</span>
        <h2>
          Build something with <em>weight</em>.
        </h2>
        <p>Early access opens in small batches. Leave an email and we'll send a build when your slot is ready.</p>
        {sent ? (
          <p className="thanks">You're on the list. We'll be in touch.</p>
        ) : (
          <form
            className="signup"
            onSubmit={(e) => {
              e.preventDefault()
              setSent(true)
            }}
          >
            <label className="sr-only" htmlFor="email">
              Email address
            </label>
            <input id="email" type="email" required placeholder="you@studio.com" autoComplete="email" />
            <button className="btn btn-signal" type="submit">
              Request access <span aria-hidden="true">→</span>
            </button>
          </form>
        )}
      </div>
      <Dim label="∞" className="dim-access" />
    </section>
  )
}

export default function Landing() {
  useReveal()
  const { hash } = useLocation()
  // Coming from another page with #section: scroll to it once it exists.
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView()
  }, [hash])
  return (
    <>
      <main>
        <Hero />
        <Ticker />
        <Primitives />
        <Models />
        <Code />
        <Access />
      </main>
    </>
  )
}
