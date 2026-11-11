import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'

const Hero3D = lazy(() => import('./Hero3D.jsx'))

// Horizontal / vertical dimension line, CAD style, that draws itself in.
function Dim({ label, vertical = false, className = '' }) {
  return (
    <div className={`dim ${vertical ? 'dim-v' : 'dim-h'} ${className}`} aria-hidden="true">
      <span className="dim-line" />
      <span className="dim-label">{label}</span>
    </div>
  )
}

export default function Landing() {
  return (
    <main>
      <section className="hero hero-lander">
        <div className="hero-copy">
          <h1 className="load" style={{ '--d': 0 }}>
            Interfaces with <em>depth</em> you can measure.
          </h1>
          <p className="lede load" style={{ '--d': 1 }}>
            A library of real-time 3D components for React, with real light, materials and spring physics.
          </p>
          <div className="actions load" style={{ '--d': 2 }}>
            <Link className="btn" to="/library">
              Go to library <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className="stage load" style={{ '--d': 1 }}>
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
          </div>
        </div>
      </section>
    </main>
  )
}
