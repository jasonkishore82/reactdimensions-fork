import { Suspense, lazy } from 'react'

// An 8-panel pebbled basketball at real size and weight, with real ball
// physics: a regulation bounce, squash on impact, rolling friction, backspin
// on throws and Magnus lift. Dribble it, slap it, throw it or spin it.
// (Thin wrapper: the scene lives in basketball/BasketballScene.jsx.)
const Scene = lazy(() => import('../basketball/BasketballScene.jsx'))

export default function BasketballModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
