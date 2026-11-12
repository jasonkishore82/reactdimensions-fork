import { Suspense, lazy } from 'react'

// A long-sleeve button-up shirt on a ghost mannequin, simulated as real cloth.
// Click a button to undo it and that part of the front falls open; do it up
// and it pulls closed. Drag the fabric to pull it; the sleeves bunch at the
// cuffs. Oxford, poplin, linen or denim, each with its own weave, sheen and
// stiffness. (Thin wrapper: the scene lives in shirt/ShirtScene.jsx.)
const Scene = lazy(() => import('../shirt/ShirtScene.jsx'))

export default function ShirtModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
