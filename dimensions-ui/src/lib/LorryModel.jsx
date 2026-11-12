import { Suspense, lazy } from 'react'

// An articulated lorry: a cab-over tractor and a box trailer on its fifth
// wheel. Steer and the front wheels turn about a real turning centre while the
// trailer pivots on its kingpin to the matching angle; drive and the yard rolls
// under it round that centre. Click the cab for the lights and the trailer for
// the rear doors, which fold right back against its sides. Paint, banner and
// number plate are props. Drag the background to orbit.
// (Thin wrapper: the scene lives in lorry/LorryScene.jsx.)
const Scene = lazy(() => import('../lorry/LorryScene.jsx'))

export default function LorryModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
