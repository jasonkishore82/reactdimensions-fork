import { Suspense, lazy } from 'react'

// A flip-top windproof lighter. Click it and the lid snaps open on its hinge;
// click the flint wheel to strike, and sparks catch the wick. The flame
// flickers and leans with the wind, and closing the lid puts it out. Five
// metal finishes and an engraving on the front. Drag the background to orbit.
// (Thin wrapper: the scene lives in lighter/LighterScene.jsx.)
const Scene = lazy(() => import('../lighter/LighterScene.jsx'))

export default function LighterModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
