import { Suspense, lazy } from 'react'

// A regulation bristle dartboard with three steel-tip darts. Click to throw
// from the oche: real projectile flight, darts landing nose-up, sticking
// with a wobble or bouncing out off the wire, and scoring. (Thin wrapper:
// the scene lives in darts/DartsScene.jsx.)
const Scene = lazy(() => import('../darts/DartsScene.jsx'))

export default function DartboardModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
