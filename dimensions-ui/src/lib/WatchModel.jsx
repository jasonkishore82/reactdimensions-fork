import { Suspense, lazy } from 'react'

// A 3D watch, analog or smart, on a strap. Swap the watch (type) or the strap
// (leather, sport, nylon, metal) and the old one pops off while the new one
// pops on. Case, strap, dial, hands and accent colours are all props. Click
// the watch to swap it, click the strap to change it; drag to orbit.
// (Thin wrapper: the scene lives in watch/WatchScene.jsx.)
const Scene = lazy(() => import('../watch/WatchScene.jsx'))

export default function WatchModel({ height = 500, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
