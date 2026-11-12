import { Suspense, lazy } from 'react'

// A balanced-arm desk lamp with a real spotlight. Drag an arm and the head
// follows the pointer, the elbow found from the two arm lengths; the springs
// stretch as the joints open. Drag the shade to tilt it, the base to turn it,
// and click the switch to light the desk. Drag the background to orbit.
// (Thin wrapper: the scene lives in lamp/LampScene.jsx.)
const Scene = lazy(() => import('../lamp/LampScene.jsx'))

export default function LampModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
