import { Suspense, lazy } from 'react'

// Real-time 3D electric pickup: faceted brushed-steel body, tinted glass,
// off-road tyres, headlight beams and damped suspension. Drag to orbit.
// Turn on `drivable` to drive it with W A S D / arrow keys.
// (Thin wrapper: the scene lives in pickup/PickupScene.jsx.)
const Scene = lazy(() => import('../pickup/PickupScene.jsx'))

export default function PickupModel({
  lightsOn = true,
  autoRotate = true,
  drivable = false,
  color = '#d4d7da',
  roughness = 0.36,
  bounce = 0,
  height = 460,
  style,
}) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene lightsOn={lightsOn} autoRotate={autoRotate} drivable={drivable} color={color} roughness={roughness} bounce={bounce} />
      </Suspense>
    </div>
  )
}
