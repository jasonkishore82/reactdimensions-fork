import { Suspense, lazy } from 'react'

// A playable 3D twisty puzzle cube (2×2 to 5×5). Drag any face to turn its
// layer: the layer follows the pointer, keeps its momentum when released and
// springs into the nearest quarter turn with a click. Scramble it, solve it
// against the clock, or let Solve undo every move. Keyboard: U D L R F B
// (and M E S on odd sizes), Shift for the reverse turn.
// (Thin wrapper: the scene lives in cube/CubeScene.jsx.)
const Scene = lazy(() => import('../cube/CubeScene.jsx'))

export default function PuzzleCubeModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
