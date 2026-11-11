import { Suspense, lazy } from 'react'

// A 3D smartphone with flat metal sides, a glass back with a three-lens camera
// bump, a pill cut-out, side buttons and a USB-C port, drawn to real size in
// millimetres. The frame, back, camera trim and wallpaper colours ease to new
// values. Click it to flip it over; drag to orbit.
// (Thin wrapper: the scene lives in phone/PhoneScene.jsx.)
const Scene = lazy(() => import('../phone/PhoneScene.jsx'))

export default function PhoneModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
