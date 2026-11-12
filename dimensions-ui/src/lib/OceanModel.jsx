import { Suspense, lazy } from 'react'

// An open sea: eight Gerstner waves under a physical sky, with Fresnel
// reflections, light scattering through the crests and whitecap foam. A
// marker buoy rides the same wave sum on the CPU, so it sits on the surface;
// click the water to send it there. Set the sun to move from dawn to noon.
// (Thin wrapper: the scene lives in ocean/OceanScene.jsx.)
const Scene = lazy(() => import('../ocean/OceanScene.jsx'))

export default function OceanModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
