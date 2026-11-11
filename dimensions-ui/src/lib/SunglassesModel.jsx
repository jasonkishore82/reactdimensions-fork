import { Suspense, lazy } from 'react'

// Parametric 3D sunglasses: six frame shapes (wayfarer, aviator, round,
// cat-eye, square, hexagon) with adjustable lens size, bridge, rim thickness,
// wrap and arm length; four finishes; tinted, gradient or mirrored lenses; and
// arms that fold (click the glasses). Every colour is a prop. Drag to orbit.
// (Thin wrapper: the scene lives in sunglasses/SunglassesScene.jsx.)
const Scene = lazy(() => import('../sunglasses/SunglassesScene.jsx'))

export default function SunglassesModel({ height = 500, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
