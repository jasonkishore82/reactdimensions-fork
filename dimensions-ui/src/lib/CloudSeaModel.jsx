import { Suspense, lazy } from 'react'

// The view from above the clouds: an endless cumulus deck rolling past below,
// a thin high overcast above and the sun breaking through between them. The
// deck is raymarched with the same noise and lighting as the Cloud component,
// with steps that lengthen toward the horizon. Drag to look around.
// (Thin wrapper: the scene lives in cloud/CloudSeaScene.jsx.)
const Scene = lazy(() => import('../cloud/CloudSeaScene.jsx'))

export default function CloudSeaModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
