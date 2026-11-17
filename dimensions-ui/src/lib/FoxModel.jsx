import { Suspense, lazy } from 'react'

// A fluffy fox kit on a 404 page. Its fur is real shell fur built in code;
// it turns its head to follow the pointer anywhere on the page (eyes leading),
// and blinks, twitches its ears and sways its tail while it studies its map.
// (Thin wrapper: the scene lives in fox/FoxScene.jsx.)
const Scene = lazy(() => import('../fox/FoxScene.jsx'))

export default function FoxModel({ height = 620, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
