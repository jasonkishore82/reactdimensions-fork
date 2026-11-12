import { Suspense, lazy } from 'react'

// Reading progress as a 3D ring that fills as you scroll through an article,
// with the percentage and minutes left, and a pop when you finish.
// (Thin wrapper: the scene lives in ix/ReadingRing.jsx.)
const Scene = lazy(() => import('../ix/ReadingRing.jsx'))

export default function ReadingRing({ height = '100%', style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
