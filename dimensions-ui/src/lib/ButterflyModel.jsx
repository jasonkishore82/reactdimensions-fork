import { Suspense, lazy } from 'react'

// A butterfly basking on a coneflower, slowly opening and closing its wings.
// Click it to take off: it flutters round the flower, rising on each
// downstroke and banking into turns, and follows the pointer. Click the
// flower and it hovers overhead, then settles back down. Six species.
// (Thin wrapper: the scene lives in butterfly/ButterflyScene.jsx.)
const Scene = lazy(() => import('../butterfly/ButterflyScene.jsx'))

export default function ButterflyModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
