import { Suspense, lazy } from 'react'

// A polished metal band ring standing on its edge, in four classic profiles.
// Click it (or flick it) and it spins like a coin on a table: upright at
// first, then it tips and rolls round its rim faster and faster, Euler's-disk
// style, until it rattles down flat. Click it again to stand it back up.
// (Thin wrapper: the scene lives in ring/RingScene.jsx.)
const Scene = lazy(() => import('../ring/RingScene.jsx'))

export default function RingModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
