import { Suspense, lazy } from 'react'

// Sticky product shot: copy scrolls past while the pinned product takes on each
// block's colourway, blending as you go.
// (Thin wrapper: the scene lives in ix/StickyColor.jsx.)
const Scene = lazy(() => import('../ix/StickyColor.jsx'))

export default function StickyColor({ height = '100%', style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
