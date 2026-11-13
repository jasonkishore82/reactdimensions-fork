import { Suspense, lazy } from 'react'

// A cricket wicket and bat with real rigid-body physics. Bowl and the ball
// pitches and comes on to the stumps: leave it and the struck stump is driven
// back in the soil (or uprooted at pace) while the bails jump their grooves
// and tumble; swing the bat in time and the ball comes off the face.
// Drag the background to orbit.
// (Thin wrapper: the scene lives in cricket/CricketScene.jsx.)
const Scene = lazy(() => import('../cricket/CricketScene.jsx'))

export default function CricketModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
