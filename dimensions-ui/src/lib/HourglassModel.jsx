import { Suspense, lazy } from 'react'

// A turned-walnut hourglass with real sand behaviour: a constant flow rate
// (Beverloo law), a crater above and a cone below at the angle of repose,
// a free-falling stream, and a flip with momentum. (Thin wrapper: the scene
// lives in hourglass/HourglassScene.jsx.)
const Scene = lazy(() => import('../hourglass/HourglassScene.jsx'))

export default function HourglassModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
