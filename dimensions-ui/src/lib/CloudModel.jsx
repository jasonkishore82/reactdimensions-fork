import { Suspense, lazy } from 'react'

// A single cumulus cloud, raymarched as a true volume under a physical sky:
// a puffy silhouette carved by baked Perlin-Worley noise, lit by marching
// toward the sun with multiple scattering, a silver-lining phase function and
// sky light from above. It drifts and billows; fly around it or into it.
// (Thin wrapper: the scene lives in cloud/CloudScene.jsx.)
const Scene = lazy(() => import('../cloud/CloudScene.jsx'))

export default function CloudModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
