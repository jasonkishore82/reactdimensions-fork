import { Suspense, lazy } from 'react'

// A little robot that builds itself as you scroll. The scroll happens inside
// the component (a tall track under a sticky canvas), not on the page: each of
// its seven parts flies from a scattered pose to its place in turn, eased, with
// a caption and a progress rail for the current stage. Scroll back up to take
// it apart again.
// (Thin wrapper: the scene lives in ix/ScrollAssembly.jsx.)
const Scene = lazy(() => import('../ix/ScrollAssembly.jsx'))

export default function ScrollAssembly({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
