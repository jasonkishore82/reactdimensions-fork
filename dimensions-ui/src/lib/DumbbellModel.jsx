import { Suspense, lazy } from 'react'

// A pair of round rubber dumbbells with real rigid-body physics: true mass
// and inertia for the chosen weight, rubber that grips, barely bounces and
// rolls to a stop. Pick one up anywhere and it hangs and swings from that
// point; let go to drop or throw it. Click one to roll it.
// (Thin wrapper: the scene lives in dumbbell/DumbbellScene.jsx.)
const Scene = lazy(() => import('../dumbbell/DumbbellScene.jsx'))

export default function DumbbellModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
