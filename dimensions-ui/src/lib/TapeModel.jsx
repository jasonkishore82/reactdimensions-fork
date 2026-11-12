import { Suspense, lazy } from 'react'

// A retractable tape measure. Drag the hook to draw the cupped steel blade
// straight out of the case. Let go and it reels back in until the hook thunks
// against the case, unless the lock is on. Metric or imperial markings,
// measured from the hook. Drag the background to orbit.
// (Thin wrapper: the scene lives in tape/TapeScene.jsx.)
const Scene = lazy(() => import('../tape/TapeScene.jsx'))

export default function TapeModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
