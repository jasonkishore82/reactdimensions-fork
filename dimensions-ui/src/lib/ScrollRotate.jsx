import { Suspense, lazy } from 'react'

// Scroll to rotate: a pump bottle turns a full circle as you scroll through
// the component's own scroll track. The canvas stays pinned while the track
// scrolls over it, the turn eases toward the scroll position, and a thin rail
// and angle readout show progress. Arrow keys step 15 degrees when focused.
// (Thin wrapper: the scene lives in ix/ScrollRotate.jsx.)
const Scene = lazy(() => import('../ix/ScrollRotate.jsx'))

export default function ScrollRotate({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
