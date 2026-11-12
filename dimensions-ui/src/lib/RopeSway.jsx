import { Suspense, lazy } from 'react'

// A cable hanging from the hook of a stand, with a plug on its free end. Drag
// the plug anywhere and the whole cable follows; let go and it swings and
// settles. A verlet rope of 30 links solved in sub-steps: it never stretches
// past its length, and stays above the floor and out of the stand. Drag the
// background to orbit.
// (Thin wrapper: the scene lives in ix/RopeSway.jsx.)
const Scene = lazy(() => import('../ix/RopeSway.jsx'))

export default function RopeSway({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
