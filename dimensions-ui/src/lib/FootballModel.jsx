import { Suspense, lazy } from 'react'

// A classic 32-panel football at real size and weight, with real ball
// physics: it bounces with a pressure-dependent restitution, squashes on
// impact, rolls with friction and rolling resistance, and curls in the air
// from the Magnus force when it spins. Tap it to kick it (off-centre for
// spin), drag it to throw it. (Thin wrapper: the scene lives in
// football/FootballScene.jsx.)
const Scene = lazy(() => import('../football/FootballScene.jsx'))

export default function FootballModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
