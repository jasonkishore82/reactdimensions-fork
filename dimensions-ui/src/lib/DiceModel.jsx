import { Suspense, lazy } from 'react'

// Six-sided dice in a tray with real rigid-body physics: roll them and they
// tumble, bounce off the rim and each other, slide, tip over and settle flat,
// and the faces that land up are added up. Drag a die to pick it up and fling
// it; click one to flip it. Standard pips: opposite faces add up to 7.
// (Thin wrapper: the scene lives in dice/DiceScene.jsx.)
const Scene = lazy(() => import('../dice/DiceScene.jsx'))

export default function DiceModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
