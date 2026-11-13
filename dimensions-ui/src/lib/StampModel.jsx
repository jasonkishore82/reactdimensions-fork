import { Suspense, lazy } from 'react'

// A custom rubber stamp: varnished hardwood block, turned knob, red foam
// cushion and a black rubber die cut with your own text or pattern. Click it
// to print onto the paper (each print a little fainter as the ink runs low),
// drag it to move it, and turn it over to see the die in mirror image.
// Drag the background to orbit.
// (Thin wrapper: the scene lives in stamp/StampScene.jsx.)
const Scene = lazy(() => import('../stamp/StampScene.jsx'))

export default function StampModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
