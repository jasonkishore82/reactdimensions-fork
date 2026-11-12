import { Suspense, lazy } from 'react'

// 3D over-ear headphones: a broad, thin padded headband, round ear cups with soft
// oval cushions and fabric speaker grilles, and metal yoke pins. Colour the
// band, cushions, shells and pins separately; pick leather, matte or gloss;
// slide the cups down; click it to fold the cups flat. Drag to orbit.
// (Thin wrapper: the scene lives in headphones/HeadphonesScene.jsx.)
const Scene = lazy(() => import('../headphones/HeadphonesScene.jsx'))

export default function HeadphonesModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
