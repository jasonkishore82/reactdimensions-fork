import { Suspense, lazy } from 'react'

// A wooden ladder against a wall, on real physics: friction at the floor and
// the wall decides whether it holds. Drag the foot out and past the critical
// angle it slides down the wall and crashes; drag the top to tip it off the
// wall. Hang the paint can on a rung and the centre of mass moves, changing
// the angle at which it slips. A readout shows the angle and the limit.
// (Thin wrapper: the scene lives in ladder/LadderScene.jsx.)
const Scene = lazy(() => import('../ladder/LadderScene.jsx'))

export default function LadderModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
