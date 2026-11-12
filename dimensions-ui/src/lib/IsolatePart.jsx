import { Suspense, lazy } from 'react'

// A stylised camera, slightly exploded into its parts. Tap a part to isolate it:
// the rest fade to faint grey ghosts, the camera eases round to frame the part
// and a label names it. Tap another part to move on; tap empty space or press
// Escape to restore. Drag to orbit.
// (Thin wrapper: the scene lives in ix/IsolatePart.jsx.)
const Scene = lazy(() => import('../ix/IsolatePart.jsx'))

export default function IsolatePart({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
