import { Suspense, lazy } from 'react'

// Scroll to explode: a phone separates into its six layers along its stack
// axis as you scroll down the component's own scroll track, and reassembles
// as you scroll back. The gaps only ever grow, so no two parts touch at any
// progress; labels fade in beside each layer once it is apart.
// (Thin wrapper: the scene lives in ix/ScrollExplode.jsx.)
const Scene = lazy(() => import('../ix/ScrollExplode.jsx'))

export default function ScrollExplode({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
