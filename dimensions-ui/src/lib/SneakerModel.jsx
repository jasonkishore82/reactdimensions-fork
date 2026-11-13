import { Suspense, lazy } from 'react'

// A low-top leather court sneaker with a moulded upper, suede overlays,
// perforated toe, mesh quarters, laces and a treaded cupsole. Drag the toe to
// flex the forefoot; click the shoe and it hops, lands and rocks to rest.
// (Thin wrapper: the scene lives in sneaker/SneakerScene.jsx.)
const Scene = lazy(() => import('../sneaker/SneakerScene.jsx'))

export default function SneakerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
