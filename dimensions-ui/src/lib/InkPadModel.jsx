import { Suspense, lazy } from 'react'

// A stamp ink pad in a moulded plastic case. Click it and the latch tongue
// flexes off its catch before the lid swings up on its pinned hinge; close it
// and the hook rides over the ridge and clicks home. Press and drag on the
// felt and it gives under the pointer, ink welling up wet where you pressed.
// Drag the background to orbit.
// (Thin wrapper: the scene lives in inkpad/InkPadScene.jsx.)
const Scene = lazy(() => import('../inkpad/InkPadScene.jsx'))

export default function InkPadModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
