import { Suspense, lazy } from 'react'

// A little portable radio you can carry across the floor. Press on it and it
// lifts off; it follows the pointer on a spring and leans with its speed, as if
// held from above, then drops and settles with a small bounce when you let go.
// The soft shadow under it spreads and fades as it rises. Drag the background
// to orbit.
// (Thin wrapper: the scene lives in ix/DragModel.jsx.)
const Scene = lazy(() => import('../ix/DragModel.jsx'))

export default function DragModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
