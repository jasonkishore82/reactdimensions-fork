import { Suspense, lazy } from 'react'

// A smart speaker with pulsing hotspots on its surface. Click one to open a
// note card pinned beside it while the camera eases round to face it; only one
// is open at a time. Markers round the back of the speaker fade out (a raycast
// each frame tests whether the speaker hides them). Click away or press Escape
// to close.
// (Thin wrapper: the scene lives in ix/HotspotNotes.jsx.)
const Scene = lazy(() => import('../ix/HotspotNotes.jsx'))

export default function HotspotNotes({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
