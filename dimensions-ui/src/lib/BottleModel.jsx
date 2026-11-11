import { Suspense, lazy } from 'react'

// An empty glass swing-top bottle: real refracting glass, a ceramic stopper on
// a red gasket, and a wire clamp that swings open. Glass colour and tint, the
// stopper, gasket and wire colours, condensation and frost are all props. Click
// it to open or close; drag to orbit.
// (Thin wrapper: the scene lives in bottle/BottleScene.jsx.)
const Scene = lazy(() => import('../bottle/BottleScene.jsx'))

export default function BottleModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
