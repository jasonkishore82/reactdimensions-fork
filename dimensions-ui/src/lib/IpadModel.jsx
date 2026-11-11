import { Suspense, lazy } from 'react'

// A tablet on a slotted-arm stand with a ball joint and a rolling base. The
// screen is a face: eyes that follow the pointer and blink, six moods, and a
// mouth that moves while it speaks. The body colour and the glow of the face
// are props. Click it to put it to sleep or wake it; drag to orbit.
// (Thin wrapper: the scene lives in ipad/IpadScene.jsx.)
const Scene = lazy(() => import('../ipad/IpadScene.jsx'))

export default function IpadModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
