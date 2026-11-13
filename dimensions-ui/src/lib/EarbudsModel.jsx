import { Suspense, lazy } from 'react'

// Wireless earbuds in their charging case. The lid is held shut by a magnet,
// flips open past its detent and rests on a stop; drag it or click it. Lift a
// bud out and drop it to watch it bounce and settle; bring it back near its
// well and the magnet pulls it in. Docked buds charge from the case, and the
// battery panel and status light show it.
// (Thin wrapper: the scene lives in earbuds/EarbudsScene.jsx.)
const Scene = lazy(() => import('../earbuds/EarbudsScene.jsx'))

export default function EarbudsModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
