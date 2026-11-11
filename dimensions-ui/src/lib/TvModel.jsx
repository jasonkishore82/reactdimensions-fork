import { Suspense, lazy } from 'react'

// A 3D television you can size from 32 to 100 inches. The screen is true 16:9
// at real-world scale, so a bigger size really does look bigger next to the
// console and the person standing beside it. Width and height are measured
// live, and the screen shows a streaming home screen. Mount it on feet, a
// pedestal or the wall. Every colour is a prop. Drag to orbit.
// (Thin wrapper: the scene lives in tv/TvScene.jsx.)
const Scene = lazy(() => import('../tv/TvScene.jsx'))

export default function TvModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
