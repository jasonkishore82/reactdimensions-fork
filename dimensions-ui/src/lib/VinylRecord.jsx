import { Suspense, lazy } from 'react'

// A 3D vinyl record with a printed label and microgrooves, in solid, marbled
// or splatter finishes. It spins by itself (set spin, rpm); drag it to spin it
// by hand and let go to feel its momentum; it leans towards the pointer.
// Turn on `sleeve` to stand it in a paper sleeve and slide it out with pullOut.
// (Thin wrapper: the scene lives in vinyl/VinylScene.jsx.)
const Scene = lazy(() => import('../vinyl/VinylScene.jsx'))

export default function VinylRecord({ height = 500, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
