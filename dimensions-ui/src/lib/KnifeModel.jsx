import { Suspense, lazy } from 'react'

// A pocket multi-tool: a main blade, a small blade, a bottle opener with a flat
// screwdriver, and a saw, on two rivets in separate layers between steel
// liners. Drag a tool to fold it out and it snaps to closed, half open or open;
// click it to flick it fully open or shut. The camera eases out to keep
// everything in view. Drag the background to orbit.
// (Thin wrapper: the scene lives in knife/KnifeScene.jsx.)
const Scene = lazy(() => import('../knife/KnifeScene.jsx'))

export default function KnifeModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
