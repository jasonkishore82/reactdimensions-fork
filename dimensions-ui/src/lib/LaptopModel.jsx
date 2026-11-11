import { Suspense, lazy } from 'react'

// A 3D laptop with a thin aluminium body, an island keyboard, a large trackpad
// and a display showing a live desktop. The body, keys and wallpaper colours
// ease smoothly to new values when you change them. Click it to open or close
// the lid; drag to orbit.
// (Thin wrapper: the scene lives in laptop/LaptopScene.jsx.)
const Scene = lazy(() => import('../laptop/LaptopScene.jsx'))

export default function LaptopModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
