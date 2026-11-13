import { Suspense, lazy } from 'react'

// A matte glazed mug of a hot drink. Slide it across the table and the drink
// sloshes in its real first mode (a Bessel-shaped wave at about 3.5 Hz); push
// too hard and it slops over the rim into puddles. Pour more from a stream
// that stays put (move the mug and it misses), hear the pour rise in pitch as
// it fills, and watch it steam less as it cools by Newton's law.
// (Thin wrapper: the scene lives in mug/MugScene.jsx.)
const Scene = lazy(() => import('../mug/MugScene.jsx'))

export default function MugModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
