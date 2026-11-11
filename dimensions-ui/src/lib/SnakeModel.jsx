import { Suspense, lazy } from 'react'

// A procedural 3D snake with scales, belly plates, eyes and a flicking forked
// tongue. Its head follows your pointer, or set mode="slither" and it crawls
// after the pointer along the floor. Every colour is a prop.
// (Thin wrapper: the scene lives in snake/SnakeScene.jsx.)
const Scene = lazy(() => import('../snake/SnakeScene.jsx'))

export default function SnakeModel({ height = 480, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
