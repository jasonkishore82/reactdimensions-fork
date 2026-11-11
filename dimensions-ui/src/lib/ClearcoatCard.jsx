import { Suspense, lazy } from 'react'

// Real-time 3D card with a clear-coat finish, foil lettering, a gold chip
// and spring physics. Drag to rotate, flick to flip, double-click to turn.
// (Thin wrapper: the scene lives in Hero3D.jsx and the model in Card.jsx.)
const Scene = lazy(() => import('../Hero3D.jsx'))

export default function ClearcoatCard({
  stiffness = 55,
  damping = 7.5,
  iridescence = 0.25,
  gloss = 0.94,
  color = '#141517',
  height = 420,
  style,
}) {
  return (
    <div style={{ width: '100%', height, touchAction: 'pan-y', ...style }}>
      <Suspense fallback={null}>
        <Scene stiffness={stiffness} damping={damping} iridescence={iridescence} gloss={gloss} color={color} />
      </Suspense>
    </div>
  )
}
