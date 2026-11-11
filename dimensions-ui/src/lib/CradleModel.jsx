import { Suspense, lazy } from 'react'

// Newton's cradle. Each chrome ball is a pendulum on two strings, and
// neighbours collide elastically, so a swing passes through the row and the far
// ball flies out. Drag an end ball to lift it and let go; choose the number of
// balls, the string length, the damping and the colours. It stays still until
// you set it going. Drag the background to orbit.
// (Thin wrapper: the scene lives in cradle/CradleScene.jsx.)
const Scene = lazy(() => import('../cradle/CradleScene.jsx'))

export default function CradleModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
